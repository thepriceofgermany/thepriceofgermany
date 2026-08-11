/* The Price of Germany - city cost-of-living calculator (controller).
   Render + net-pay logic lives in /assets/calc-render.js (window.CalcRender),
   shared with the Node build script so the crawlable default block and the
   live client stay identical. This file only wires up the DOM. */
(function () {
  'use strict';

  var DATA = null, renderer = null;
  var DEFAULT_FROM = 'new-york-ny', DEFAULT_TO = 'berlin';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fillSelect(sel, cities, selected) {
    var keys = Object.keys(cities).sort(function (a, b) {
      return cities[a].name.localeCompare(cities[b].name);
    });
    sel.innerHTML = keys.map(function (k) {
      var label = cities[k].name + (cities[k].state ? ', ' + cities[k].state : '');
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function currentState() {
    return {
      from: document.getElementById('sel-from').value,
      to: document.getElementById('sel-to').value,
      salary: parseInt(document.getElementById('salary').value, 10) || 0
    };
  }

  function syncURL(s) {
    var q = '?from=' + encodeURIComponent(s.from) + '&to=' + encodeURIComponent(s.to) +
      (s.salary ? '&salary=' + s.salary : '');
    history.replaceState(null, '', q);
  }

  function update() {
    var s = currentState();
    document.getElementById('calc-results').innerHTML = renderer.renderResults(s.from, s.to, s.salary);
    syncURL(s);
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function init() {
    var params = new URLSearchParams(location.search);
    var from = params.get('from'), to = params.get('to');
    var salary = parseInt(params.get('salary'), 10) || '';
    if (!DATA.usCities[from]) from = DEFAULT_FROM;
    if (!DATA.deCities[to]) to = DEFAULT_TO;

    fillSelect(document.getElementById('sel-from'), DATA.usCities, from);
    fillSelect(document.getElementById('sel-to'), DATA.deCities, to);
    if (salary) document.getElementById('salary').value = salary;

    document.getElementById('sel-from').addEventListener('change', update);
    document.getElementById('sel-to').addEventListener('change', update);
    document.getElementById('salary').addEventListener('input', debounce(update, 250));
    var form = document.getElementById('calc-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); update(); });

    var copyBtn = document.getElementById('copy-link');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(location.href).then(function () {
        var t = copyBtn.textContent; copyBtn.textContent = 'Link copied';
        setTimeout(function () { copyBtn.textContent = t; }, 1600);
      });
    });

    update();
  }

  fetch('/assets/cost-data.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      DATA = d;
      renderer = window.CalcRender.makeRenderer(DATA);
      init();
    })
    .catch(function () {
      var el = document.getElementById('calc-results');
      if (el) el.innerHTML = '<p>Could not load the comparison data. Please refresh.</p>';
    });
})();
