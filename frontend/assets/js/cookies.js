function initCookieBanner() {
  if (localStorage.getItem('roomia_cookie_consent')) return;
  const bar = document.createElement('div');
  bar.id = 'cookie-banner';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:600;background:var(--ink-deep);color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,0.2)';
  bar.innerHTML = `
    <p style="margin:0;font-size:14px;max-width:640px" data-i18n="cookie_msg"></p>
    <div style="display:flex;gap:10px;flex-shrink:0">
      <button class="btn btn-outline btn-sm" id="cookie-decline" data-i18n="cookie_decline"></button>
      <button class="btn btn-primary btn-sm" id="cookie-accept" data-i18n="cookie_accept"></button>
    </div>`;
  document.body.appendChild(bar);
  if (typeof I18N !== 'undefined') I18N.apply();

  document.getElementById('cookie-accept').addEventListener('click', () => {
    localStorage.setItem('roomia_cookie_consent', 'accepted');
    bar.remove();
  });
  document.getElementById('cookie-decline').addEventListener('click', () => {
    localStorage.setItem('roomia_cookie_consent', 'declined');
    bar.remove();
  });
}
document.addEventListener('DOMContentLoaded', initCookieBanner);
