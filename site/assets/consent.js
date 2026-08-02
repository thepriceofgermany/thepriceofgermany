/* The Price of Germany - cookie consent gate for Google Analytics.
   GA (gtag.js) is NOT loaded until the visitor clicks Accept. The choice is
   stored in localStorage so the banner only shows once. */
(function () {
  var GA_ID = 'G-HZNTDSSVP4';
  var KEY = 'tpog-consent'; // 'granted' | 'denied'

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;

  function loadGA() {
    if (window.__tpogGA) return;
    window.__tpogGA = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var choice = stored();
  if (choice === 'granted') { loadGA(); return; }
  if (choice === 'denied') { return; }

  // No choice yet: show the banner.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }

  function showBanner() {
    var style = document.createElement('style');
    style.textContent =
      '.tpog-consent{position:fixed;left:16px;right:16px;bottom:16px;max-width:660px;margin:0 auto;' +
      'background:var(--paper,#FFFDF6);border:1.5px solid var(--line,#E7E0D2);border-radius:14px;' +
      'box-shadow:0 10px 28px rgba(35,38,43,.16);padding:16px 18px;z-index:9999;display:flex;gap:14px;' +
      'align-items:center;justify-content:space-between;flex-wrap:wrap;font-family:\'Work Sans\',sans-serif}' +
      '.tpog-consent p{margin:0;font-size:14px;color:var(--ink-soft,#5B5F66);line-height:1.5;flex:1;min-width:230px}' +
      '.tpog-consent a{color:var(--coral,#FF5A5F)}' +
      '.tpog-consent-btns{display:flex;gap:10px;flex-shrink:0}' +
      '.tpog-btn{font-family:\'Work Sans\',sans-serif;font-weight:600;font-size:14px;padding:9px 18px;' +
      'border-radius:9px;cursor:pointer;border:1.5px solid var(--ink,#23262B)}' +
      '.tpog-accept{background:var(--coral,#FF5A5F);border-color:var(--coral,#FF5A5F);color:#fff}' +
      '.tpog-decline{background:transparent;color:var(--ink,#23262B)}';
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'tpog-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<p>We use Google Analytics cookies to understand how visitors use this site. ' +
      'You can accept or decline. See the <a href="/imprint">Imprint</a> for details.</p>' +
      '<div class="tpog-consent-btns">' +
      '<button type="button" class="tpog-btn tpog-decline">Decline</button>' +
      '<button type="button" class="tpog-btn tpog-accept">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);

    bar.querySelector('.tpog-accept').addEventListener('click', function () {
      store('granted'); loadGA(); bar.remove();
    });
    bar.querySelector('.tpog-decline').addEventListener('click', function () {
      store('denied'); bar.remove();
    });
  }
})();
