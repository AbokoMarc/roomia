function renderHeader(active = '') {
  const user = Auth.getUser();
  const loggedIn = Auth.isLoggedIn();

  const navLink = (href, label, key) =>
    `<a href="${href}" style="${active === key ? 'color:var(--ink-text);font-weight:700' : ''}">${label}</a>`;

  const commonTools = `
    ${typeof renderLangSwitcher === 'function' ? renderLangSwitcher() : ''}
    <button class="icon-btn" id="theme-btn" aria-label="Thème">🌙</button>
    <button class="icon-btn" id="budget-calc-btn" aria-label="Calculateur budget" title="Calculateur de budget">💰</button>
  `;

  const rightSide = loggedIn ? `
    ${commonTools}
    <button class="icon-btn" id="notif-bell" aria-label="Notifications">🔔<span class="badge-dot hidden" id="notif-badge">0</span></button>
    <div class="notif-panel hidden" id="notif-panel">
      <div class="np-head"><strong>Notifications</strong></div>
      <div class="np-body"></div>
    </div>
    <a href="${user.role === 'admin' ? '/admin/admin-dashboard.html' : '/dashboard.html'}" class="user-chip">
      <span class="avatar">${(user.name || '?').slice(0, 1).toUpperCase()}</span>
      <span style="font-size:14px;font-weight:600">${user.role === 'admin' ? 'Admin' : user.name.split(' ')[0]}</span>
    </a>
    <button class="btn btn-ghost btn-sm" id="logout-btn" data-i18n="logout">Déconnexion</button>
  ` : `
    ${commonTools}
    <a href="/login.html" class="btn btn-ghost btn-sm" data-i18n="login">Se connecter</a>
    <a href="/signup.html" class="btn btn-dark btn-sm" data-i18n="signup">S'inscrire</a>
  `;

  const drawerLinks = `
    <a href="/index.html" class="${active === 'home' ? 'active' : ''}" data-i18n="nav_home">Accueil</a>
    <a href="/search.html" class="${active === 'search' ? 'active' : ''}" data-i18n="nav_explore">Explorer</a>
    ${loggedIn ? `<a href="/dashboard.html" class="${active === 'dashboard' ? 'active' : ''}" data-i18n="nav_bookings">Mes réservations</a>` : ''}
    ${loggedIn ? `<a href="/dashboard.html#favoris" data-i18n="nav_favorites">Favoris</a>` : ''}
    <hr>
    ${loggedIn
      ? `<a href="${user.role === 'admin' ? '/admin/admin-dashboard.html' : '/dashboard.html'}">${user.role === 'admin' ? 'Espace admin' : 'Mon profil'}</a>
         <button class="drawer-link" id="drawer-logout-btn">Déconnexion</button>`
      : `<a href="/login.html" data-i18n="login">Se connecter</a><a href="/signup.html" data-i18n="signup">S'inscrire</a>`}
  `;

  return `
  <header class="site-header">
    <div class="container">
      <a href="/index.html" class="brand"><span class="mark">R</span>Room<span class="accent">ia</span></a>
      <nav class="main-nav">
        ${navLink('/index.html', 'Accueil', 'home').replace('>Accueil<', ' data-i18n="nav_home">Accueil<')}
        ${navLink('/search.html', 'Explorer', 'search').replace('>Explorer<', ' data-i18n="nav_explore">Explorer<')}
        ${loggedIn ? navLink('/dashboard.html', 'Mes réservations', 'dashboard').replace('>Mes réservations<', ' data-i18n="nav_bookings">Mes réservations<') : ''}
        ${loggedIn ? `<a href="/dashboard.html#favoris" data-i18n="nav_favorites">Favoris</a>` : ''}
      </nav>
      <div class="header-actions" style="position:relative">
        ${rightSide}
        <button class="hamburger-btn" id="mobile-nav-btn" aria-label="Menu">☰</button>
      </div>
    </div>
    <div class="mobile-nav-drawer hidden" id="mobile-nav-drawer">
      <div class="drawer-panel">
        <button class="drawer-close" id="mobile-nav-close">✕</button>
        ${drawerLinks}
      </div>
    </div>
  </header>`;
}

function renderFooter() {
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="brand" style="color:white;margin-bottom:12px">
            <span class="mark">R</span>Room<span class="accent" style="color:var(--gold)">ia</span>
          </div>
          <p style="font-size:14px;line-height:1.6;max-width:280px">Réservez chambres, appartements et maisons en France et partout dans le monde. Paiement Mobile Money, carte, PayPal ou crypto.</p>
        </div>
        <div>
          <h4>Roomia</h4>
          <ul><li><a href="/search.html">Explorer les logements</a></li><li><a href="/index.html#villes">Nos destinations</a></li><li><a href="#">À propos</a></li></ul>
        </div>
        <div>
          <h4>Assistance</h4>
          <ul><li><a href="#">Centre d'aide</a></li><li><a href="#">Annulation</a></li><li><a href="#">Contact</a></li></ul>
        </div>
        <div>
          <h4>Devenir hôte</h4>
          <ul><li><a href="#">Publier un logement</a></li><li><a href="#">Ressources hôtes</a></li></ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Roomia</span>
        <span>Réservation de logements en toute confiance</span>
      </div>
    </div>
  </footer>`;
}

function renderAdminHeader(active = '') {
  const user = Auth.getUser();
  const link = (href, label, key) => `<a href="${href}" style="${active === key ? 'color:var(--ink-text);font-weight:700' : ''}">${label}</a>`;
  const drawerLink = (href, label, key) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
  return `
  <header class="site-header">
    <div class="container">
      <a href="/admin/admin-dashboard.html" class="brand"><span class="mark">R</span>Room<span class="accent">ia</span> <span style="font-size:12px;background:var(--gold);color:var(--ink-deep);padding:3px 8px;border-radius:6px;margin-left:6px;font-family:var(--font-body);font-weight:700">ADMIN</span></a>
      <nav class="main-nav">
        ${link('/admin/admin-dashboard.html', 'Tableau de bord', 'dash')}
        ${link('/admin/admin-rooms.html', 'Logements', 'rooms')}
        ${link('/admin/admin-bookings.html', 'Réservations', 'bookings')}
        ${link('/admin/admin-payments.html', 'Paiements', 'payments')}
        ${link('/admin/admin-users.html', 'Clients', 'users')}
        ${link('/admin/admin-settings.html', 'Paramètres', 'settings')}
      </nav>
      <div class="header-actions" style="position:relative">
        <button class="icon-btn" id="theme-btn" aria-label="Thème">🌙</button>
        <button class="icon-btn" id="notif-bell" aria-label="Notifications">🔔<span class="badge-dot hidden" id="notif-badge">0</span></button>
        <div class="notif-panel hidden" id="notif-panel"><div class="np-head"><strong>Notifications</strong></div><div class="np-body"></div></div>
        <a href="/index.html" class="btn btn-ghost btn-sm"><span class="btn-label-full">Voir le site</span><span class="btn-label-short" style="display:none">🔗</span></a>
        <a href="${user ? '/admin/admin-settings.html' : '#'}" class="user-chip"><span class="avatar">${(user?.name || 'A').slice(0, 1).toUpperCase()}</span></a>
        <button class="btn btn-ghost btn-sm" id="logout-btn">Déconnexion</button>
        <button class="hamburger-btn" id="mobile-nav-btn" aria-label="Menu">☰</button>
      </div>
    </div>
    <div class="mobile-nav-drawer hidden" id="mobile-nav-drawer">
      <div class="drawer-panel">
        <button class="drawer-close" id="mobile-nav-close">✕</button>
        ${drawerLink('/admin/admin-dashboard.html', 'Tableau de bord', 'dash')}
        ${drawerLink('/admin/admin-rooms.html', 'Logements', 'rooms')}
        ${drawerLink('/admin/admin-bookings.html', 'Réservations', 'bookings')}
        ${drawerLink('/admin/admin-payments.html', 'Paiements', 'payments')}
        ${drawerLink('/admin/admin-users.html', 'Clients', 'users')}
        ${drawerLink('/admin/admin-settings.html', 'Paramètres', 'settings')}
        <hr>
        <a href="/index.html">Voir le site public</a>
        <button class="drawer-link" id="drawer-logout-btn">Déconnexion</button>
      </div>
    </div>
  </header>`;
}

function bindMobileNav() {
  document.addEventListener('click', (e) => {
    if (e.target && (e.target.id === 'mobile-nav-btn')) qs('mobile-nav-drawer')?.classList.remove('hidden');
    if (e.target && (e.target.id === 'mobile-nav-close')) qs('mobile-nav-drawer')?.classList.add('hidden');
    if (e.target && e.target.id === 'mobile-nav-drawer') qs('mobile-nav-drawer')?.classList.add('hidden');
    if (e.target && e.target.id === 'drawer-logout-btn') Auth.logout();
  });
}

function mountAdminLayout(active = '') {
  if (!requireAdminOrRedirect()) return;
  const headerMount = document.getElementById('app-header');
  if (headerMount) headerMount.outerHTML = renderAdminHeader(active);
  bindMobileNav();
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'logout-btn') Auth.logout();
    if (e.target && e.target.id === 'theme-btn') toggleTheme();
  });
}

function mountLayout(active = '') {
  const headerMount = document.getElementById('app-header');
  const footerMount = document.getElementById('app-footer');
  if (headerMount) headerMount.outerHTML = renderHeader(active);
  if (footerMount) footerMount.outerHTML = renderFooter();
  bindMobileNav();

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'logout-btn') Auth.logout();
    if (e.target && e.target.id === 'theme-btn') toggleTheme();
    if (e.target && e.target.id === 'budget-calc-btn') openBudgetCalculator();
  });

  if (typeof I18N !== 'undefined') I18N.apply();
}
