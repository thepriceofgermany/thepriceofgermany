/* The Price of Germany - city cost-of-living calculator (controller).
   Render + net-pay logic lives in /assets/calc-render.js (window.CalcRender),
   shared with the Node build script so the crawlable default block and the
   live client stay identical. This file only wires up the DOM. */
(function () {
  'use strict';

  var DATA = null, renderer = null;
  var DEFAULT_CITY = 'berlin';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fillCities(sel, cities, selected) {
    var keys = Object.keys(cities).sort(function (a, b) {
      return cities[a].name.localeCompare(cities[b].name);
    });
    sel.innerHTML = keys.map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(cities[k].name) + '</option>';
    }).join('');
  }

  function el(id) { return document.getElementById(id); }

  function currentState() {
    return {
      city: el('sel-city').value,
      income: parseInt(el('salary').value, 10) || 0,
      married: el('sel-status').value === 'married',
      spouseIncome: parseInt(el('spouse').value, 10) || 0,
      children: parseInt(el('sel-children').value, 10) || 0,
      housing: el('sel-housing').value,
      transport: el('sel-transport').value,
      church: el('chk-church').checked
    };
  }

  function syncURL(s) {
    var q = '?city=' + encodeURIComponent(s.city) +
      (s.income ? '&income=' + s.income : '') +
      (s.married ? '&married=1' : '') +
      (s.married && s.spouseIncome ? '&spouse=' + s.spouseIncome : '') +
      (s.children ? '&children=' + s.children : '') +
      '&housing=' + encodeURIComponent(s.housing) +
      '&transport=' + encodeURIComponent(s.transport) +
      (s.church ? '&church=1' : '');
    history.replaceState(null, '', q);
  }

  function toggleSpouse(married) {
    var row = el('spouse-field');
    if (row) row.style.display = married ? '' : 'none';
  }

  function update() {
    var s = currentState();
    toggleSpouse(s.married);
    el('calc-results').innerHTML = renderer.renderResults(s);
    syncURL(s);
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function setValue(id, val) { var e = el(id); if (e != null && val != null) e.value = val; }

  function init() {
    var params = new URLSearchParams(location.search);
    var city = params.get('city');
    if (!DATA.deCities[city]) city = DEFAULT_CITY;
    fillCities(el('sel-city'), DATA.deCities, city);

    var income = parseInt(params.get('income'), 10);
    if (income) el('salary').value = income;
    if (params.get('married') === '1') el('sel-status').value = 'married';
    var spouse = parseInt(params.get('spouse'), 10);
    if (spouse) el('spouse').value = spouse;
    var children = params.get('children');
    if (children && el('sel-children').querySelector('option[value="' + CSS.escape(children) + '"]')) {
      el('sel-children').value = children;
    }
    var housing = params.get('housing');
    if (housing && el('sel-housing').querySelector('option[value="' + CSS.escape(housing) + '"]')) {
      el('sel-housing').value = housing;
    }
    var transport = params.get('transport');
    if (transport === 'car' || transport === 'transit') el('sel-transport').value = transport;
    if (params.get('church') === '1') el('chk-church').checked = true;

    el('sel-city').addEventListener('change', update);
    el('sel-status').addEventListener('change', update);
    el('sel-children').addEventListener('change', update);
    el('sel-housing').addEventListener('change', update);
    el('sel-transport').addEventListener('change', update);
    el('chk-church').addEventListener('change', update);
    el('salary').addEventListener('input', debounce(update, 250));
    el('spouse').addEventListener('input', debounce(update, 250));
    var form = el('calc-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); update(); });

    var copyBtn = el('copy-link');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href).then(function () {
        var t = copyBtn.textContent; copyBtn.textContent = 'Link copied';
        setTimeout(function () { copyBtn.textContent = t; }, 1600);
      });
    });

    update();
  }

  fetch('/assets/cost-data.json?v=3')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      renderer = window.CalcRender.makeRenderer(DATA);
      init();
    })
    .catch(function () {
      var e = el('calc-results');
      if (e) e.innerHTML = '<p>Could not load the cost data. Please refresh.</p>';
    });
})();
