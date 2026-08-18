const API_BASE = '/api';

const Auth = {
  getToken() { return localStorage.getItem('roomia_token'); },
  setToken(t) { localStorage.setItem('roomia_token', t); },
  clearToken() { localStorage.removeItem('roomia_token'); },
  getUser() {
    const raw = localStorage.getItem('roomia_user');
    return raw ? JSON.parse(raw) : null;
  },
  setUser(u) { localStorage.setItem('roomia_user', JSON.stringify(u)); },
  clearUser() { localStorage.removeItem('roomia_user'); },
  isLoggedIn() { return !!this.getToken(); },
  isAdmin() { return this.getUser()?.role === 'admin'; },
  logout() { this.clearToken(); this.clearUser(); window.location.href = '/index.html'; },
};

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Auth.getToken()) headers['Authorization'] = `Bearer ${Auth.getToken()}`;

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (err) {
    throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
  }

  let data = {};
  try { data = await res.json(); } catch { /* réponse vide */ }

  if (!res.ok) {
    if (res.status === 401 && auth) { Auth.logout(); }
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

function requireAuthOrRedirect(redirectTo = '/login.html') {
  if (!Auth.isLoggedIn()) { window.location.href = redirectTo; return false; }
  return true;
}

function requireAdminOrRedirect() {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) { window.location.href = '/login.html'; return false; }
  return true;
}

function money(amount) {
  return Math.round(amount).toLocaleString('fr-FR') + ' €';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso.replace(' ', 'T') + 'Z')) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function qs(id) { return document.getElementById(id); }
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
