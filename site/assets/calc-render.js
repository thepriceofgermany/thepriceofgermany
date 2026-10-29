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
    housing: {
      label: 'Recommended',
      heading: 'Find a place before you land',
      blurb: 'Housing is the hardest thing to sort out from abroad. This is where a relocation or apartment-search resource goes.',
      ctaText: 'Browse housing help',
      href: '',
      affiliate: false
    },
    taxes: {
      label: 'Recommended',
      heading: 'Insurance built for expats in Germany',
      blurb: 'A big slice of your German paycheck is mandatory insurance, and the rest is on you to arrange. For health, liability, life, and the other policies Germany expects you to carry, Feather is the English-language insurance service I point expats toward, so you can compare and sign up without wrestling German paperwork or a commission-driven sales agent.',
      ctaText: 'Check out Feather',
      href: 'https://feather-insurance.com?utm_source=the-price-of-germany',
      affiliate: true
    }
  };

  /* ------------------------------ helpers ------------------------------ */
  function eur(n) { return '€' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) { return Math.round(n) + '%'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --------------------------- net-pay model --------------------------- */
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

  /* --------------------------- renderer factory ------------------------ */
  function makeRenderer(DATA) {
    function catBlurb(id) {
      var c = (DATA.categories || []).filter(function (x) { return x.id === id; })[0];
      return c ? c.blurb : '';
    }
    function basket(city) {
      return city.housing.outside1br + city.groceriesSingle + city.transport.transitPass +
        city.utilities.electricity + city.utilities.heating + city.utilities.internet;
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
    function row2(label, aText, bText) {
      return '<div class="cmp-line"><span class="cmp-label">' + esc(label) + '</span>' +
        '<span class="cmp-us">' + aText + '</span>' +
        '<span class="cmp-de">' + bText + '</span></div>';
    }
    function compareBox(title, aName, bName, rowsHTML) {
      return '<div class="cmp"><div class="cmp-head"><span class="cmp-title">' + esc(title) + '</span>' +
        '<span class="cmp-us head">' + esc(aName) + '</span>' +
        '<span class="cmp-de head">' + esc(bName) + '</span></div>' + rowsHTML + '</div>';
    }
    function pRow(label, value) {
      return '<div class="payslip-row"><span class="label">' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }
    function pTotal(label, value) {
      return '<div class="payslip-total"><span>' + esc(label) + '</span><span class="value">' + value + '</span></div>';
    }
    function netPayHTML(salary) {
      if (!salary) {
        return '<div class="cmp salary-empty"><p>Enter a gross annual salary above to see estimated take-home pay on a German payslip.</p></div>';
      }
      var d = germanNet(salary);
      var box = '<div class="payslip payslip-solo"><div class="compare-title">' + eur(salary) + ' gross · Germany</div>' +
        pRow('Income tax + solidarity surcharge', eur(d.incomeTax + d.soli)) +
        pRow('Pension + unemployment insurance', eur(d.pension + d.unemployment)) +
        pRow('Health + long-term care insurance', eur(d.health + d.care)) +
        pTotal('Take-home', eur(d.net) + ' (' + pct(d.pctNet) + ')') + '</div>';
      return '<div class="payslip-single">' + box + '</div>' +
        '<p class="cat-note">German income tax and social insurance are set nationally, so your take-home pay is the same in every city here. A large part of the deductions is mandatory insurance (pension, health, care, unemployment) rather than tax.</p>';
    }

    function renderResults(fromKey, toKey, salary) {
      var a = DATA.deCities[fromKey], b = DATA.deCities[toKey];
      if (!a || !b) return '<p>Pick two German cities to compare.</p>';
      var aB = basket(a), bB = basket(b);
      var ratio = (bB / aB) * 100;
      var out = [];

      var verdict = ratio < 100 ? 'about ' + pct(100 - ratio) + ' less' : 'about ' + pct(ratio - 100) + ' more';
      out.push('<section class="cat-block headline" id="cat-headline">' +
        '<p class="headline-line">A single person’s core monthly essentials cost <strong>' +
        eur(aB) + '</strong> in ' + esc(a.name) + ' and about <strong>' + eur(bB) +
        '</strong> in ' + esc(b.name) + '.</p>' +
        '<p class="headline-sub">Living in ' + esc(b.name) + ' costs <strong>' + verdict +
        '</strong> than ' + esc(a.name) + ' for the same rent-plus-groceries-plus-transport-plus-utilities basket.</p>' +
        '</section>');

      out.push('<section class="cat-block" id="cat-housing"><h2>Housing</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('housing')) + '</p>' +
        compareBox('Monthly rent', a.name, b.name,
          row2('1-bed, city center', eur(a.housing.center1br), eur(b.housing.center1br)) +
          row2('1-bed, outside center', eur(a.housing.outside1br), eur(b.housing.outside1br)) +
          row2('3-bed family', eur(a.housing.family3br), eur(b.housing.family3br))) +
        slotHTML('housing') + '</section>');

      out.push('<section class="cat-block" id="cat-groceries"><h2>Groceries</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('groceries')) + '</p>' +
        compareBox('Monthly groceries', a.name, b.name,
          row2('Single person', eur(a.groceriesSingle), eur(b.groceriesSingle)) +
          row2('Family of four', eur(a.groceriesFamily), eur(b.groceriesFamily))) +
        '</section>');

      out.push('<section class="cat-block" id="cat-transport"><h2>Transportation</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('transport')) + '</p>' +
        compareBox('Getting around', a.name, b.name,
          row2('Car ownership (all-in)', eur(a.transport.carMonthly) + '/mo', eur(b.transport.carMonthly) + '/mo') +
          row2('Monthly transit pass', eur(a.transport.transitPass) + ' (Deutschlandticket)', eur(b.transport.transitPass) + ' (Deutschlandticket)')) +
        '</section>');

      out.push('<section class="cat-block" id="cat-utilities"><h2>Utilities</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('utilities')) + '</p>' +
        compareBox('Monthly utilities', a.name, b.name,
          row2('Electricity', eur(a.utilities.electricity), eur(b.utilities.electricity)) +
          row2('Heating', eur(a.utilities.heating), eur(b.utilities.heating)) +
          row2('Home internet', eur(a.utilities.internet), eur(b.utilities.internet))) +
        '</section>');

      out.push('<section class="cat-block" id="cat-taxes"><h2>Taxes and net income</h2>' +
        '<p class="cat-blurb">' + esc(catBlurb('taxes')) + '</p>' + netPayHTML(salary) +
        slotHTML('taxes') + '</section>');

      out.push('<section class="cat-block" id="cat-context"><h2>Context notes</h2><ul class="context-list">' +
        '<li>Figures are monthly unless stated, in euros.</li>' +
        '<li>These are informed estimates anchored to published indices and city rent data, not invoices. ' + esc(a.name) + ' last checked ' + esc(a.lastVerified) + ', ' + esc(b.name) + ' last checked ' + esc(b.lastVerified) + '.</li>' +
        '<li>German public health insurance is about 14.6 percent of gross income, split with your employer, and already deducted before your net pay lands. It does not change from city to city.</li>' +
        '<li>Net-pay figures use a simplified single-filer 2026 model and will differ from your real payslip. Always run a real offer through a proper calculator before you accept it.</li>' +
        '</ul></section>');

      return out.join('\n');
    }

    return { renderResults: renderResults };
  }

  root.CalcRender = {
    RESOURCE_SLOTS: RESOURCE_SLOTS,
    makeRenderer: makeRenderer,
    germanNet: germanNet
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
