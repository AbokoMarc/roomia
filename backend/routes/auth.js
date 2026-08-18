import { db } from '../db.js';
import { json, parseBody } from '../lib/http.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../lib/auth.js';

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatar,
    country: u.country, loyalty_points: u.loyalty_points, must_change_password: !!u.must_change_password,
    preferred_language: u.preferred_language, default_travel_purpose: u.default_travel_purpose,
  };
}

export async function handleAuth(req, res, urlPath) {
  if (urlPath === '/api/auth/register' && req.method === 'POST') {
    const b = await parseBody(req);
    const { name, email, password, phone, country, address, city, postal_code, date_of_birth,
      nationality, id_document_type, id_document_number, default_travel_purpose, preferred_language } = b;
    if (!name || !email || !password) return json(res, 400, { error: 'Nom, email et mot de passe requis.' });
    if (password.length < 6) return json(res, 400, { error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return json(res, 409, { error: 'Un compte existe déjà avec cet email.' });
    const info = db.prepare(`
      INSERT INTO users (name, email, phone, country, address, city, postal_code, date_of_birth, nationality,
        id_document_type, id_document_number, default_travel_purpose, preferred_language, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'client')
    `).run(
      name.trim(), email.toLowerCase().trim(), phone || null, country || null, address || null, city || null,
      postal_code || null, date_of_birth || null, nationality || null, id_document_type || null,
      id_document_number || null, default_travel_purpose || 'loisirs', preferred_language || 'fr',
      hashPassword(password)
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    return json(res, 201, { token, user: publicUser(user) });
  }

  // Changement de mot de passe par le titulaire du compte (client ou admin) — nécessite l'ancien mot de passe.
  if (urlPath === '/api/auth/change-password' && req.method === 'PUT') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const { current_password, new_password } = await parseBody(req);
    if (!current_password || !new_password) return json(res, 400, { error: 'Mot de passe actuel et nouveau requis.' });
    if (new_password.length < 6) return json(res, 400, { error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authUser.id);
    if (!verifyPassword(current_password, user.password_hash)) return json(res, 401, { error: 'Mot de passe actuel incorrect.' });
    db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hashPassword(new_password), authUser.id);
    return json(res, 200, { success: true });
  }

  if (urlPath === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await parseBody(req);
    if (!email || !password) return json(res, 400, { error: 'Email et mot de passe requis.' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return json(res, 401, { error: 'Email ou mot de passe incorrect.' });
    }
    const token = signToken({ id: user.id, role: user.role, name: user.name });
    return json(res, 200, { token, user: publicUser(user) });
  }

  if (urlPath === '/api/auth/me' && req.method === 'GET') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authUser.id);
    if (!user) return json(res, 404, { error: 'Utilisateur introuvable.' });
    return json(res, 200, { user: publicUser(user) });
  }

  if (urlPath === '/api/auth/me' && req.method === 'PUT') {
    const authUser = requireAuth(req, res);
    if (!authUser) return;
    const { name, phone, avatar } = await parseBody(req);
    db.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar) WHERE id = ?')
      .run(name || null, phone || null, avatar || null, authUser.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(authUser.id);
    return json(res, 200, { user: publicUser(user) });
  }

  return null; // route non gérée ici
}
