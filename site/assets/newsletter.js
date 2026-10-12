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
    '.tpog-newsletter{max-width:760px;margin:40px auto;padding:0 24px;font-family:\'Work Sans\',sans-serif;color:var(--ink,#23262B)}' +
    '.tpog-nl-card{background:var(--paper,#FFFDF6);border:1.5px solid var(--line,#E7E0D2);border-radius:16px;padding:26px 26px 22px;box-shadow:0 3px 0 var(--line,#E7E0D2);text-align:left}' +
    '.tpog-nl-tag{display:inline-block;font-family:\'Space Mono\',monospace;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--coral,#FF5A5F);padding:4px 10px;border-radius:5px;margin-bottom:12px}' +
    '.tpog-nl-card h3{font-family:\'Fredoka\',sans-serif;font-weight:600;font-size:1.4rem;line-height:1.2;margin:0 0 8px;letter-spacing:-.005em}' +
    '.tpog-nl-card p{margin:0 0 16px;font-size:15.5px;line-height:1.6;color:var(--ink-soft,#5B5F66)}' +
    '.tpog-nl-btn{font-family:\'Work Sans\',sans-serif;font-weight:600;font-size:15px;padding:11px 22px;border-radius:10px;cursor:pointer;border:1.5px solid var(--coral,#FF5A5F);background:var(--coral,#FF5A5F);color:#fff}' +
    '.tpog-nl-btn:hover{background:var(--coral-dark,#E1454A);border-color:var(--coral-dark,#E1454A)}' +
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
    box.innerHTML =
      '<div class="tpog-nl-card">' +
      '<span class="tpog-nl-tag">Newsletter</span>' +
      '<h3>Get the free German Citizenship Checklist</h3>' +
      '<p>Subscribe and confirm your email to download the 6 page checklist for applying for German citizenship. You will also get new Germany vs USA cost breakdowns. No spam, and you can unsubscribe any time.</p>' +
      '<button type="button" class="tpog-nl-btn">Subscribe</button>' +
      '<p class="tpog-nl-note">Clicking Subscribe loads the signup form from our email provider, MailerLite. You will get a confirmation email first, and the download opens after you confirm. See the <a href="/privacy">Privacy Policy</a>.</p>' +
      '</div>';
    box.querySelector('.tpog-nl-btn').addEventListener('click', function () {
      var card = box.querySelector('.tpog-nl-card');
      var holder = document.createElement('div');
      holder.className = 'ml-embedded';
      holder.setAttribute('data-form', FORM);
      card.innerHTML = '';
      card.appendChild(holder);
      loadMailerLite();
    });
  });
})();
