/* The Price of Germany - newsletter signup (MailerLite).
   Privacy by design: nothing from MailerLite loads until the visitor clicks
   "Subscribe". Then the MailerLite embedded form is loaded into the box.
   Double opt-in is enforced by MailerLite (confirmation email). */
(function () {
  var ACCOUNT = '2705592';
  var FORM = 'Cm0ao7';

  var boxes = document.querySelectorAll('.tpog-newsletter');
  if (!boxes.length) return;

  var css =
    '.tpog-newsletter{max-width:760px;margin:40px auto;padding:0 24px;font-family:\'Inter\',system-ui,sans-serif;color:var(--ink,#121210)}' +
    '.tpog-nl-card{background:var(--paper,#FFFDF6);border:1px solid var(--ink,#121210);border-radius:6px;padding:28px 28px 24px;box-shadow:none;text-align:left}' +
    '.tpog-nl-tag{display:inline-block;font-family:\'IBM Plex Mono\',monospace;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FFFDF6;background:var(--coral,#D83A2E);padding:4px 10px;border-radius:3px;margin-bottom:12px}' +
    '.tpog-nl-card h3{font-family:\'Space Grotesk\',system-ui,sans-serif;font-weight:700;font-size:1.5rem;line-height:1.15;margin:0 0 8px;letter-spacing:-.02em}' +
    '.tpog-nl-card p{margin:0 0 16px;font-size:15.5px;line-height:1.6;color:var(--ink-soft,#67665F)}' +
    '.tpog-nl-btn{font-family:\'Space Grotesk\',system-ui,sans-serif;font-weight:600;font-size:15px;padding:12px 24px;border-radius:4px;cursor:pointer;border:1px solid var(--ink,#121210);background:var(--ink,#121210);color:#FFFDF6}' +
    '.tpog-nl-btn:hover{background:var(--coral,#D83A2E);border-color:var(--coral,#D83A2E)}' +
    '.tpog-nl-note{margin:14px 0 0!important;font-size:12.5px!important;line-height:1.5!important}' +
    '.tpog-nl-note a{color:inherit}' +
    '.tpog-newsletter .ml-embedded{margin-top:4px}' +
    '.wrap .tpog-newsletter{padding:0;margin:26px auto 0}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function loadMailerLite() {
    if (window.__tpogMl) return;
    window.__tpogMl = true;
    (function (w, d, e, u, f, l, n) {
      w[f] = w[f] || function () { (w[f].q = w[f].q || []).push(arguments); };
      l = d.createElement(e); l.async = 1; l.src = u;
      n = d.getElementsByTagName(e)[0]; n.parentNode.insertBefore(l, n);
    })(window, document, 'script', 'https://assets.mailerlite.com/js/universal.js', 'ml');
    window.ml('account', ACCOUNT);
  }

  boxes.forEach(function (box) {
    // Optional per-box overrides, so other lead magnets can reuse this box:
    // data-form (MailerLite form id), data-tag, data-title, data-text.
    var form = box.getAttribute('data-form') || FORM;
    if (/^TODO/.test(form)) return; // form not configured yet, render nothing
    var tag = box.getAttribute('data-tag') || 'Newsletter';
    var title = box.getAttribute('data-title') || 'Get the free German Citizenship Checklist';
    var text = box.getAttribute('data-text') || 'Subscribe and confirm your email to download the 6 page checklist for applying for German citizenship. You will also get new videos, guides and cost breakdowns about life in Germany. No spam, and you can unsubscribe any time.';
    box.innerHTML =
      '<div class="tpog-nl-card">' +
      '<span class="tpog-nl-tag"></span>' +
      '<h3></h3>' +
      '<p class="tpog-nl-text"></p>' +
      '<button type="button" class="tpog-nl-btn">Subscribe</button>' +
      '<p class="tpog-nl-note">Clicking Subscribe loads the signup form from our email provider, MailerLite. You will get a confirmation email first, and the download opens after you confirm. See the <a href="/privacy">Privacy Policy</a>.</p>' +
      '</div>';
    box.querySelector('.tpog-nl-tag').textContent = tag;
    box.querySelector('h3').textContent = title;
    box.querySelector('.tpog-nl-text').textContent = text;
    box.querySelector('.tpog-nl-btn').addEventListener('click', function () {
      var card = box.querySelector('.tpog-nl-card');
      var holder = document.createElement('div');
      holder.className = 'ml-embedded';
      holder.setAttribute('data-form', form);
      card.innerHTML = '';
      card.appendChild(holder);
      loadMailerLite();
    });
  });
})();
