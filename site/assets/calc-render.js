/* Shared, DOM-free render + net-pay logic for the German cost-of-living
   calculator. Loaded as a plain <script> in the browser (attaches
   window.CalcRender) and eval'd by scripts/build-calculator.mjs in Node so the
   crawlable default block and the live client render from ONE source of truth.
   No DOM here. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Affiliate resource slots. Swap these without touching render logic. *
   * Set href to enable a slot; an empty href hides it. affiliate:true    *
   * adds the disclosure line. One slot per category id.                  *
   * ------------------------------------------------------------------ */
  var RESOURCE_SLOTS = {
    taxes: {
      label: 'Recommended',
      heading: 'Insurance built for expats in Germany',
      blurb: 'A big slice of your German paycheck is mandatory insurance, and the rest is on you to arrange. For health, liability, life, and the other policies Germany expects you to carry, Feather is the English-language insurance service I point expats toward, so you can compare and sign up without wrestling German paperwork or a commission-driven sales agent.',
      ctaText: 'Check out Feather',
      href: 'https://feather-insurance.com?utm_source=the-price-of-germany',
      affiliate: true
    }
  };

  /* 2026-approx constants used by the net-pay model. */
  var KINDERGELD_MONTHLY = 255;   // per child, 2026
  var CHURCH_TAX_RATE = 0.09;     // 9% of income tax (most states)

  /* ------------------------------ helpers ------------------------------ */
  function eur(n) { return '€' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) { return Math.round(n) + '%'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --------------------------- net-pay model --------------------------- */
  // German income tax, 2026-approx piecewise formula on taxable income (zvE).
  function deIncomeTax(zvE) {
    if (zvE <= 12096) return 0;
    if (zvE <= 17443) { var y = (zvE - 12096) / 10000; return (932.30 * y + 1400) * y; }
    if (zvE <= 68480) { var z = (zvE - 17443) / 10000; return (176.64 * z + 2397) * z + 1015.13; }
    if (zvE <= 277825) return 0.42 * zvE - 10911.92;
    return 0.45 * zvE - 19246.67;
  }

  // Employee-side social insurance on one person's own gross wage.
  function socialInsurance(gross, childless) {
    var pensionUnempCeil = 96600, healthCareCeil = 66150;
    var pension = 0.093 * Math.min(gross, pensionUnempCeil);
    var unemployment = 0.013 * Math.min(gross, pensionUnempCeil);
    var health = 0.0855 * Math.min(gross, healthCareCeil);
    // Long-term care: 1.8% employee share, +0.6% surcharge if childless (23+).
    var careRate = childless ? 0.024 : 0.018;
    var care = careRate * Math.min(gross, healthCareCeil);
    return {
      pension: pension, unemployment: unemployment, health: health, care: care,
      total: pension + unemployment + health + care
    };
  }

  // Full household model. Returns annual + monthly figures.
  //   p = { income, married, spouseIncome, children, churchTax }
  function householdNet(p) {
    var income = Math.max(0, p.income || 0);
    var married = !!p.married;
    var spouse = married ? Math.max(0, p.spouseIncome || 0) : 0;
    var children = Math.max(0, p.children || 0);
    var childless = children === 0;

    // Income tax: Ehegattensplitting for married couples, otherwise class I.
    var incomeTax;
    if (married) {
      incomeTax = 2 * deIncomeTax((income + spouse) / 2);
    } else {
      incomeTax = deIncomeTax(income);
    }

    // Solidarity surcharge: threshold doubles for married filers.
    var soliThreshold = married ? 39900 : 19950;
    var soli = incomeTax <= soliThreshold
      ? 0
      : Math.min(0.055 * incomeTax, 0.119 * (incomeTax - soliThreshold));

    var church = p.churchTax ? CHURCH_TAX_RATE * incomeTax : 0;

    // Social insurance is per-earner on each person's own gross.
    var socA = socialInsurance(income, childless);
    var socB = married && spouse > 0 ? socialInsurance(spouse, childless)
      : { pension: 0, unemployment: 0, health: 0, care: 0, total: 0 };
    var social = socA.total + socB.total;

    var grossTotal = income + spouse;
    var net = grossTotal - incomeTax - soli - church - social;
    var kindergeldYear = children * KINDERGELD_MONTHLY * 12;
    var takeHome = net + kindergeldYear;

    return {
      married: married, children: children, churchTax: !!p.churchTax,
      gross: grossTotal, grossMonthly: grossTotal / 12,
      incomeTax: incomeTax, soli: soli, church: church,
      social: social,
      pension: socA.pension + socB.pension,
      unemployment: socA.unemployment + socB.unemployment,
      health: socA.health + socB.health,
      care: socA.care + socB.care,
      net: net, netMonthly: net / 12,
      kindergeldMonthly: children * KINDERGELD_MONTHLY,
      takeHome: takeHome, takeHomeMonthly: takeHome / 12,
      pctNet: grossTotal > 0 ? (net / grossTotal) * 100 : 0
    };
  }

  /* --------------------------- renderer factory ------------------------ */
  function makeRenderer(DATA) {
    function catBlurb(id) {
      var c = (DATA.categories || []).filter(function (x) { return x.id === id; })[0];
      return c ? c.blurb : '';
    }
    var HOUSING_LABELS = {
      center1br: '1-bedroom, city center',
      outside1br: '1-bedroom, outside center',
      family3br: '3-bedroom family apartment'
    };
    function rentFor(city, housing) {
      var h = city.housing || {};
      return h[housing] != null ? h[housing] : h.outside1br;
    }
    // Groceries scale between the single (1 person) and family-of-four points.
    function groceriesFor(city, people) {
      var single = city.groceriesSingle, family = city.groceriesFamily;
      var n = Math.max(1, people);
      if (n >= 4) return family;
      return single + (n - 1) * (family - single) / 3;
    }
    function slotHTML(id) {
      var s = RESOURCE_SLOTS[id];
      if (!s || !s.href) return '';
      var disclosure = s.affiliate
        ? '<div class="disclosure">DISCLOSURE: The link above is an affiliate link. If you sign up through it, I may earn a commission at no extra cost to you, it helps support the site.</div>'
        : '';
      return '<div class="rec-card"><span class="rec-hole"></span>' +
        '<span class="rec-label">' + esc(s.label) + '</span>' +
        '<h3>' + esc(s.heading) + '</h3><p>' + esc(s.blurb) + '</p>' +
        '<a class="rec-btn" href="' + esc(s.href) + '" target="_blank" rel="noopener sponsored">' +
        esc(s.ctaText) + ' →</a></div>' + disclosure;
    }
    function costRow(label, value, note) {
      return '<div class="cost-line"><span class="cost-label">' + esc(label) +
        (note ? ' <span class="cost-note">' + esc(note) + '</span>' : '') +
        '</span><span class="cost-value">' + value + '</span></div>';
    }
    function pRow(label, value) {
      return '<div class="payslip-row"><span class="label">' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }
    function pTotal(label, value) {
      return '<div class="payslip-total"><span>' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }

    // input: { city, income, married, spouseIncome, children, housing, transport, church }
    function renderResults(input) {
      input = input || {};
      var city = DATA.deCities[input.city];
      if (!city) return '<p>Pick a German city to see your estimate.</p>';

      var married = !!input.married;
      var children = Math.max(0, input.children || 0);
      var people = (married ? 2 : 1) + children;
      var housing = HOUSING_LABELS[input.housing] ? input.housing
        : (people >= 3 ? 'family3br' : 'outside1br');
      var useCar = input.transport === 'car';

      var rent = rentFor(city, housing);
      var groceries = groceriesFor(city, people);
      var transport = useCar ? city.transport.carMonthly : city.transport.transitPass;
      var utilities = city.utilities.electricity + city.utilities.heating + city.utilities.internet;
      var living = rent + groceries + transport + utilities;

      var income = Math.max(0, input.income || 0);
      var hasIncome = income > 0;
      var net = householdNet({
        income: income, married: married, spouseIncome: input.spouseIncome,
        children: children, churchTax: input.church
      });

      var householdLabel = married
        ? 'a couple' + (children ? ' with ' + children + (children === 1 ? ' child' : ' children') : '')
        : (children ? 'a single parent with ' + children + (children === 1 ? ' child' : ' children') : 'a single person');

      var out = [];

      /* ---------- headline / bottom line ---------- */
      if (hasIncome) {
        var leftover = net.takeHomeMonthly - living;
        var verdict = leftover >= 0
          ? 'leaves about <strong>' + eur(leftover) + ' a month</strong> after these core costs'
          : 'falls about <strong>' + eur(-leftover) + ' a month short</strong> of these core costs';
        out.push('<section class="cat-block headline" id="cat-headline">' +
          '<p class="headline-line">In <strong>' + esc(city.name) + '</strong>, ' + esc(householdLabel) +
          ' on <strong>' + eur(net.gross) + '</strong> gross takes home about <strong>' +
          eur(net.takeHomeMonthly) + ' a month</strong>.</p>' +
          '<p class="headline-sub">Against roughly <strong>' + eur(living) +
          '</strong> in core monthly costs, that ' + verdict + '.</p>' +
          '</section>');
      } else {
        out.push('<section class="cat-block headline" id="cat-headline">' +
          '<p class="headline-line">Core monthly essentials for ' + esc(householdLabel) +
          ' in <strong>' + esc(city.name) + '</strong> come to about <strong>' + eur(living) + '</strong>.</p>' +
          '<p class="headline-sub">Add your gross annual income above to see estimated take-home pay and what is left each month.</p>' +
          '</section>');
      }

      /* ---------- take-home pay ---------- */
      out.push('<section class="cat-block" id="cat-taxes"><h2>Take-home pay</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('taxes')) + '</p>' +
        netPayHTML(net, hasIncome) + slotHTML('taxes') + '</section>');

      /* ---------- monthly living costs ---------- */
      var carNote = useCar ? 'car, all-in' : 'Deutschlandticket';
      out.push('<section class="cat-block" id="cat-costs"><h2>Monthly living costs</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('costs')) + '</p>' +
        '<div class="cost-box">' +
        costRow('Rent', eur(rent), HOUSING_LABELS[housing]) +
        costRow('Groceries', eur(groceries), people + (people === 1 ? ' person' : ' people')) +
        costRow('Transport', eur(transport), carNote) +
        costRow('Utilities', eur(utilities), 'electricity, heating, internet') +
        '<div class="cost-total"><span>Core total</span><span class="cost-value">' + eur(living) + '/mo</span></div>' +
        '</div>' +
        '<p class="cat-note">Rent is cold rent (Kaltmiete); heating and other utilities are listed separately. Groceries scale between a single person and a family of four. This is a core basket, not a full budget: it leaves out eating out, childcare, insurance premiums, and savings.</p>' +
        '</section>');

      /* ---------- context ---------- */
      out.push('<section class="cat-block" id="cat-context"><h2>Context notes</h2><ul class="context-list">' +
        '<li>Figures are monthly unless stated, in euros. ' + esc(city.name) + ' last checked ' + esc(city.lastVerified) + '.</li>' +
        '<li>City cost data is an informed estimate anchored to published indices and city rent data, not an invoice.</li>' +
        '<li>Income tax and social insurance are set nationally, so take-home pay does not change from city to city; only your living costs do.</li>' +
        (married ? '<li>Married couples are taxed with Ehegattensplitting, which is why a single high earner with a lower-earning spouse keeps more than two separate singles would.</li>' : '') +
        (children ? '<li>Kindergeld of ' + eur(KINDERGELD_MONTHLY) + ' per child per month is added to take-home pay. A non-earning spouse and children are usually co-insured on public health insurance at no extra premium.</li>' : '') +
        '<li>Net-pay figures use a simplified 2026 model (single filer or splitting) and will differ from your real payslip. Always run a real offer through a proper calculator before you accept it.</li>' +
        '</ul></section>');

      return out.join('\n');
    }

    function netPayHTML(net, hasIncome) {
      if (!hasIncome) {
        return '<div class="payslip salary-empty"><p>Enter a gross annual income above to see estimated take-home pay on a German payslip.</p></div>';
      }
      var grossRow = net.married
        ? pRow('Household gross (monthly)', eur(net.grossMonthly))
        : pRow('Gross (monthly)', eur(net.grossMonthly));
      var kinder = net.kindergeldMonthly > 0
        ? pRow('Kindergeld (' + net.children + (net.children === 1 ? ' child' : ' children') + ')', '+ ' + eur(net.kindergeldMonthly))
        : '';
      var church = net.church > 0 ? pRow('Church tax', eur(net.church / 12)) : '';
      var box = '<div class="payslip payslip-solo"><div class="compare-title">' +
        eur(net.gross) + ' gross · ' + (net.married ? 'couple' : 'single') + '</div>' +
        grossRow +
        pRow('Income tax + solidarity surcharge', eur((net.incomeTax + net.soli) / 12)) +
        church +
        pRow('Pension + unemployment insurance', eur((net.pension + net.unemployment) / 12)) +
        pRow('Health + long-term care insurance', eur((net.health + net.care) / 12)) +
        (kinder ? pRow('Net pay', eur(net.netMonthly)) + kinder : '') +
        pTotal('Take-home', eur(net.takeHomeMonthly) + '/mo (' + pct(net.pctNet) + ' of gross)') + '</div>';
      return '<div class="payslip-single">' + box + '</div>';
    }

    return { renderResults: renderResults };
  }

  root.CalcRender = {
    RESOURCE_SLOTS: RESOURCE_SLOTS,
    makeRenderer: makeRenderer,
    householdNet: householdNet
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
