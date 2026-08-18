import { db } from './db.js';
import { hashPassword } from './lib/auth.js';

export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrateur Roomia';

  if (!email || !password) {
    console.warn('⚠️  ADMIN_EMAIL / ADMIN_PASSWORD absents du .env — aucun compte admin créé automatiquement.');
    return;
  }

  const existing = await db.prepare('SELECT id, role FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    if (existing.role !== 'admin') await db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(existing.id);
    return;
  }

  await db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`)
    .run(name, email.toLowerCase(), hashPassword(password));
  console.log(`✅ Compte admin créé pour ${email}`);
}
