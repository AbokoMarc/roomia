const TRANSLATIONS = {
  fr: {
    nav_home: 'Accueil', nav_explore: 'Explorer', nav_bookings: 'Mes réservations', nav_favorites: 'Favoris',
    login: 'Se connecter', signup: "S'inscrire", logout: 'Déconnexion',
    hero_title: 'Trouvez votre prochain séjour', hero_lead: "Chambres, appartements et maisons partout dans le monde. Réservez et payez en toute confiance.",
    search_destination: 'Destination', search_where: 'Où allez-vous ?', search_checkin: 'Arrivée', search_checkout: 'Départ', search_btn: 'Rechercher',
    categories_title: 'Trouvez tous les logements qu\'il vous faut', cat_houses: 'Maisons', cat_apartments: 'Appartements', cat_rooms: 'Chambres privées',
    cities_title: 'Les destinations les plus recherchées', featured_title: 'Logements en vedette', see_all: 'Tout voir',
    per_night: '/ nuit', reserve: 'Réserver', all_types: 'Tous types',
    cookie_msg: "Nous utilisons des cookies pour améliorer votre expérience et mesurer l'audience du site.",
    cookie_accept: 'Accepter', cookie_decline: 'Refuser',
    budget_calc: 'Calculateur budget', nearby: 'Près de moi',
    eyebrow_categories: 'Nos catégories', eyebrow_popular: 'Populaire', eyebrow_featured: 'Sélection',
  },
  en: {
    nav_home: 'Home', nav_explore: 'Explore', nav_bookings: 'My bookings', nav_favorites: 'Favorites',
    login: 'Log in', signup: 'Sign up', logout: 'Log out',
    hero_title: 'Find your next stay', hero_lead: 'Rooms, apartments and houses worldwide. Book and pay with confidence.',
    search_destination: 'Destination', search_where: 'Where are you going?', search_checkin: 'Check-in', search_checkout: 'Check-out', search_btn: 'Search',
    categories_title: 'Find all the stays you need', cat_houses: 'Houses', cat_apartments: 'Apartments', cat_rooms: 'Private rooms',
    cities_title: 'Most popular destinations', featured_title: 'Featured stays', see_all: 'See all',
    per_night: '/ night', reserve: 'Book now', all_types: 'All types',
    cookie_msg: 'We use cookies to improve your experience and measure site traffic.',
    cookie_accept: 'Accept', cookie_decline: 'Decline',
    budget_calc: 'Budget calculator', nearby: 'Near me',
    eyebrow_categories: 'Categories', eyebrow_popular: 'Popular', eyebrow_featured: 'Selection',
  },
  zh: {
    nav_home: '首页', nav_explore: '探索', nav_bookings: '我的预订', nav_favorites: '收藏',
    login: '登录', signup: '注册', logout: '退出登录',
    hero_title: '找到您的下一个住宿', hero_lead: '全球客房、公寓和房屋。放心预订和付款。',
    search_destination: '目的地', search_where: '您要去哪里？', search_checkin: '入住日期', search_checkout: '退房日期', search_btn: '搜索',
    categories_title: '找到您需要的所有住宿', cat_houses: '房屋', cat_apartments: '公寓', cat_rooms: '独立房间',
    cities_title: '最受欢迎的目的地', featured_title: '精选住宿', see_all: '查看全部',
    per_night: '/ 晚', reserve: '预订', all_types: '所有类型',
    cookie_msg: '我们使用Cookie来改善您的体验并衡量网站流量。',
    cookie_accept: '接受', cookie_decline: '拒绝',
    budget_calc: '预算计算器', nearby: '附近',
    eyebrow_categories: '分类', eyebrow_popular: '热门', eyebrow_featured: '精选',
  },
};

const I18N = {
  current() { return localStorage.getItem('roomia_lang') || 'fr'; },
  set(lang) { localStorage.setItem('roomia_lang', lang); location.reload(); },
  t(key) { return (TRANSLATIONS[this.current()] && TRANSLATIONS[this.current()][key]) || TRANSLATIONS.fr[key] || key; },
  apply() {
    document.documentElement.lang = this.current();
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPlaceholder); });
  },
};

function renderLangSwitcher() {
  const langs = { fr: '🇫🇷 FR', en: '🇬🇧 EN', zh: '🇨🇳 中文' };
  const current = I18N.current();
  return `
  <div style="position:relative" id="lang-switcher">
    <button class="icon-btn" id="lang-btn" style="width:auto;padding:0 12px;border-radius:999px;font-size:13px;font-weight:700">${langs[current]}</button>
    <div class="notif-panel hidden" id="lang-panel" style="width:160px;padding:6px">
      ${Object.entries(langs).map(([code, label]) => `<button class="tab-btn" style="width:100%;text-align:left;padding:10px 12px;${code === current ? 'background:var(--sand-deep)' : ''}" data-lang="${code}">${label}</button>`).join('')}
    </div>
  </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  I18N.apply();
  document.addEventListener('click', (e) => {
    if (e.target.id === 'lang-btn') { e.stopPropagation(); qs('lang-panel')?.classList.toggle('hidden'); }
    else if (e.target.dataset && e.target.dataset.lang) { I18N.set(e.target.dataset.lang); }
    else { qs('lang-panel')?.classList.add('hidden'); }
  });
});
