/* Shared, DOM-free render + net-pay logic for the cost-of-living calculator.
   Loaded as a plain <script> in the browser (attaches window.CalcRender) and
   eval'd by scripts/build-calculator.mjs in Node so the crawlable default block
   and the live client render from ONE source of truth. No DOM here. */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Affiliate resource slots. Swap these without touching render logic. *
   * Set href to enable a slot; an empty href hides it. affiliate:true    *
   * adds the disclosure line. One slot per category id.                  *
   * ------------------------------------------------------------------ */
  var RESOURCE_SLOTS = {
    housing: {
      label: 'Recommended',
      heading: 'Find a place before you land',
      blurb: 'Housing is the hardest thing to sort out from abroad. This is where a relocation or apartment-search resource goes.',
      ctaText: 'Browse housing help',
      href: '',
      affiliate: false
    },
    healthcare: {
      label: 'Recommended',
      heading: 'Sort your health insurance the right way',
      blurb: 'Getting your public or private cover set up correctly is the single most important admin step for a newcomer. A health-insurance broker resource goes here.',
      ctaText: 'Compare insurance',
      href: '',
      affiliate: false
    },
    taxes: {
      label: 'Recommended',
      heading: 'File your US taxes from abroad',
      blurb: 'Americans in Germany still owe a US tax return every year, and it is easy to get wrong. This is the expat-focused filing service I would point you to for the Foreign Earned Income Exclusion, foreign tax credits, and staying compliant with the IRS from overseas.',
      ctaText: 'File with MyExpatTaxes',
      href: 'https://app.myexpattaxes.com/wizard?ref=fwefphge',
      affiliate: true
    }
  };

  /* ------------------------------ helpers ------------------------------ */
  function usd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function eur(n) { return '€' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) { return Math.round(n) + '%'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --------------------------- net-pay models -------------------------- */
  // German income tax, 2026-approx piecewise formula (single, tax class I).
  function deIncomeTax(zvE) {
    if (zvE <= 12096) return 0;
    if (zvE <= 17443) { var y = (zvE - 12096) / 10000; return (932.30 * y + 1400) * y; }
    if (zvE <= 68480) { var z = (zvE - 17443) / 10000; return (176.64 * z + 2397) * z + 1015.13; }
    if (zvE <= 277825) return 0.42 * zvE - 10911.92;
    return 0.45 * zvE - 19246.67;
  }
  function germanNet(gross) {
    var tax = deIncomeTax(gross);
    var soliThreshold = 19950;
    var soli = tax <= soliThreshold ? 0 : Math.min(0.055 * tax, 0.119 * (tax - soliThreshold));
    var pensionUnempCeil = 96600, healthCareCeil = 66150;
    var pension = 0.093 * Math.min(gross, pensionUnempCeil);
    var unemployment = 0.013 * Math.min(gross, pensionUnempCeil);
    var health = 0.0855 * Math.min(gross, healthCareCeil);
    var care = 0.018 * Math.min(gross, healthCareCeil);
    var social = pension + unemployment + health + care;
    var net = gross - tax - soli - social;
    return {
      currency: 'eur', gross: gross, incomeTax: tax, soli: soli,
      social: social, health: health, pension: pension, care: care,
      unemployment: unemployment, net: net, pctNet: (net / gross) * 100
    };
  }
  // US federal + FICA + effective state/local, 2026-approx (single).
  function usNet(gross, stateLocalRate) {
    var taxable = Math.max(0, gross - 15000);
    var brackets = [
      [0, 0.10], [11925, 0.12], [48475, 0.22], [103350, 0.24],
      [197300, 0.32], [250525, 0.35], [626350, 0.37]
    ];
    var fed = 0;
    for (var i = 0; i < brackets.length; i++) {
      var lo = brackets[i][0];
      var hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
      if (taxable > lo) fed += (Math.min(taxable, hi) - lo) * brackets[i][1];
      else break;
    }
    var ssBase = 168600;
    var fica = gross <= ssBase ? 0.0765 * gross : 0.0765 * ssBase + 0.0145 * (gross - ssBase);
    var stateLocal = (stateLocalRate || 0) * gross;
    var net = gross - fed - fica - stateLocal;
    return {
      currency: 'usd', gross: gross, federal: fed, fica: fica,
      stateLocal: stateLocal, net: net, pctNet: (net / gross) * 100
    };
  }

  /* --------------------------- renderer factory ------------------------ */
  function makeRenderer(DATA) {
    var rate = DATA.meta.usdPerEur;

    function catBlurb(id) {
      var c = (DATA.categories || []).filter(function (x) { return x.id === id; })[0];
      return c ? c.blurb : '';
    }
    function baskets(us, de) {
      var uB = us.housing.outside1br + us.groceriesSingle + us.transport.transitPass +
        us.utilities.electricity + us.utilities.heating + us.utilities.internet;
      var dB = de.housing.outside1br + de.groceriesSingle + de.transport.transitPass +
        de.utilities.electricity + de.utilities.heating + de.utilities.internet;
      return { us: uB, de: dB, deUsd: dB * rate };
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
    function row2(label, usText, deText) {
      return '<div class="cmp-line"><span class="cmp-label">' + esc(label) + '</span>' +
        '<span class="cmp-us">' + usText + '</span>' +
        '<span class="cmp-de">' + deText + '</span></div>';
    }
    function compareBox(title, usName, deName, rowsHTML) {
      return '<div class="cmp"><div class="cmp-head"><span class="cmp-title">' + esc(title) + '</span>' +
        '<span class="cmp-us head">' + esc(usName) + '</span>' +
        '<span class="cmp-de head">' + esc(deName) + '</span></div>' + rowsHTML + '</div>';
    }
    function pRow(label, value) {
      return '<div class="payslip-row"><span class="label">' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }
    function pTotal(label, value) {
      return '<div class="payslip-total"><span>' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }
    function netPayHTML(us, de, salary) {
      if (!salary) {
        return '<div class="cmp salary-empty"><p>Enter a gross annual salary above to see estimated take-home pay in ' +
          esc(us.name) + ' (USD) and ' + esc(de.name) + ' (EUR).</p></div>';
      }
      var u = usNet(salary, us.stateLocalRate);
      var d = germanNet(salary);
      var usBox = '<div class="payslip"><div class="compare-title">' + esc(us.name) + ' · ' + usd(salary) + ' gross</div>' +
        pRow('Federal income tax', usd(u.federal)) +
        pRow('FICA (Social Security + Medicare)', usd(u.fica)) +
        pRow('State and local (effective)', usd(u.stateLocal)) +
        pTotal('Take-home', usd(u.net) + ' (' + pct(u.pctNet) + ')') + '</div>';
      var deBox = '<div class="payslip"><div class="compare-title">' + esc(de.name) + ' · ' + eur(salary) + ' gross</div>' +
        pRow('Income tax + solidarity surcharge', eur(d.incomeTax + d.soli)) +
        pRow('Pension + unemployment insurance', eur(d.pension + d.unemployment)) +
        pRow('Health + long-term care insurance', eur(d.health + d.care)) +
        pTotal('Take-home', eur(d.net) + ' (' + pct(d.pctNet) + ')') + '</div>';
      return '<div class="payslip-pair">' + usBox + deBox + '</div>' +
        '<p class="cat-note">' + esc(us.name) + ' keeps a bigger share on paper, but a large part of ' + esc(de.name) +
        '’s deductions is mandatory insurance (pension, health, care, unemployment) that in the US you would pay for separately or go without. Compare net-plus-benefits, not just the percentage.</p>';
    }

    function renderResults(fromKey, toKey, salary) {
      var us = DATA.usCities[fromKey], de = DATA.deCities[toKey];
      if (!us || !de) return '<p>Pick a US city and a German city to compare.</p>';
      var b = baskets(us, de);
      var ratio = (b.deUsd / b.us) * 100;
      var out = [];

      var verdict = ratio < 100 ? 'about ' + pct(100 - ratio) + ' less' : 'about ' + pct(ratio - 100) + ' more';
      out.push('<section class="cat-block headline" id="cat-headline">' +
        '<p class="headline-line">A single person’s core monthly essentials cost <strong>' +
        usd(b.us) + '</strong> in ' + esc(us.name) + ' and about <strong>' + usd(b.deUsd) +
        '</strong> (' + eur(b.de) + ') in ' + esc(de.name) + '.</p>' +
        '<p class="headline-sub">Living in ' + esc(de.name) + ' costs <strong>' + verdict +
        '</strong> for the same rent-plus-groceries-plus-transport-plus-utilities basket. Healthcare and take-home pay differ structurally and are broken out below.</p>' +
        '</section>');

      out.push('<section class="cat-block" id="cat-taxes"><h2>Taxes and net income</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('taxes')) + '</p>' + netPayHTML(us, de, salary) +
        slotHTML('taxes') + '</section>');

      out.push('<section class="cat-block" id="cat-housing"><h2>Housing</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('housing')) + '</p>' +
        compareBox('Monthly rent', us.name, de.name,
          row2('1-bed, city center', usd(us.housing.center1br), eur(de.housing.center1br)) +
          row2('1-bed, outside center', usd(us.housing.outside1br), eur(de.housing.outside1br)) +
          row2('3-bed family', usd(us.housing.family3br), eur(de.housing.family3br))) +
        slotHTML('housing') + '</section>');

      out.push('<section class="cat-block" id="cat-groceries"><h2>Groceries</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('groceries')) + '</p>' +
        compareBox('Monthly groceries', us.name, de.name,
          row2('Single person', usd(us.groceriesSingle), eur(de.groceriesSingle)) +
          row2('Family of four', usd(us.groceriesFamily), eur(de.groceriesFamily))) +
        '</section>');

      var deHealthMo = salary ? (salary * de.healthcare.rateOfIncome / 2) / 12 : null;
      out.push('<section class="cat-block" id="cat-healthcare"><h2>Healthcare</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('healthcare')) + '</p>' +
        compareBox('What you pay directly', us.name, de.name,
          row2('Monthly premium', usd(us.healthcare.premiumMonthly), 'Built into payroll') +
          row2('Annual deductible', usd(us.healthcare.deductible), 'None')) +
        '<p class="cat-note">In ' + esc(us.name) + ', that premium is money out of pocket on top of your paycheck, and the deductible is what you owe before insurance pays much of anything. In ' +
        esc(de.name) + ', public health insurance is about 14.6 percent of gross income, split with your employer, so it is already deducted before your net pay lands' +
        (deHealthMo ? '. At ' + eur(salary) + ' gross, your half is roughly ' + eur(deHealthMo) + ' a month' : '') +
        '.</p>' + slotHTML('healthcare') + '</section>');

      out.push('<section class="cat-block" id="cat-transport"><h2>Transportation</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('transport')) + '</p>' +
        compareBox('Getting around', us.name, de.name,
          row2('Car ownership (all-in)', usd(us.transport.carMonthly) + '/mo', eur(de.transport.carMonthly) + '/mo') +
          row2('Monthly transit pass', usd(us.transport.transitPass), eur(de.transport.transitPass) + ' (Deutschlandticket)')) +
        '</section>');

      out.push('<section class="cat-block" id="cat-utilities"><h2>Utilities</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('utilities')) + '</p>' +
        compareBox('Monthly utilities', us.name, de.name,
          row2('Electricity', usd(us.utilities.electricity), eur(de.utilities.electricity)) +
          row2('Heating', usd(us.utilities.heating), eur(de.utilities.heating)) +
          row2('Home internet', usd(us.utilities.internet), eur(de.utilities.internet))) +
        '</section>');

      out.push('<section class="cat-block" id="cat-context"><h2>Context notes</h2><ul class="context-list">' +
        '<li>Figures are monthly unless stated, in local currency, converted at €1 ≈ $' + rate.toFixed(2) + ' (rate set ' + esc(DATA.meta.generated) + ').</li>' +
        '<li>These are informed estimates anchored to published indices and city rent data, not invoices. ' + esc(us.name) + ' last checked ' + esc(us.lastVerified) + ', ' + esc(de.name) + ' last checked ' + esc(de.lastVerified) + '.</li>' +
        '<li>German public health insurance bundles things Americans often pay extra for: no separate premium bill, no deductible, and dependents are covered on one contribution.</li>' +
        '<li>Net-pay figures use a simplified single-filer 2026 model and will differ from your real payslip. Always run a real offer through a proper calculator before you accept it.</li>' +
        '</ul></section>');

      return out.join('\n');
    }

    return { renderResults: renderResults };
  }

  root.CalcRender = {
    RESOURCE_SLOTS: RESOURCE_SLOTS,
    makeRenderer: makeRenderer,
    germanNet: germanNet,
    usNet: usNet
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
