import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// En production (Render, etc.) : pointe vers ta base Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN).
// En local, sans ces variables : utilise un simple fichier SQLite local — aucun compte Turso requis pour développer.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'roomia.db');
const url = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN; // undefined en local — OK, non requis pour un fichier local

if (url.startsWith('file:')) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const client = createClient({ url, authToken });

// libSQL n'accepte pas `undefined` comme paramètre lié — on le convertit en `null`.
function cleanArgs(args) {
  return args.map(a => (a === undefined ? null : a));
}

// Adaptateur qui reproduit l'interface synchrone de node:sqlite (db.prepare(sql).get/.all/.run)
// mais renvoie des Promises — chaque appel doit être précédé de `await` côté appelant.
export const db = {
  prepare(sql) {
    return {
      async get(...args) {
        const res = await client.execute({ sql, args: cleanArgs(args) });
        return res.rows[0] ?? undefined;
      },
      async all(...args) {
        const res = await client.execute({ sql, args: cleanArgs(args) });
        return res.rows;
      },
      async run(...args) {
        const res = await client.execute({ sql, args: cleanArgs(args) });
        return {
          lastInsertRowid: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : null,
          changes: res.rowsAffected,
        };
      },
    };
  },
  async exec(sqlMultiStatement) {
    await client.executeMultiple(sqlMultiStatement);
  },
};

await db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client', -- client | admin
    avatar TEXT,
    country TEXT,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    -- Profil étendu collecté à l'inscription : visible admin, protégé par re-authentification (RGPD)
    address TEXT,
    city TEXT,
    postal_code TEXT,
    date_of_birth TEXT,
    nationality TEXT,
    id_document_type TEXT, -- carte_identite | passeport | permis_conduire
    id_document_number TEXT,
    default_travel_purpose TEXT, -- loisirs | travail | etudes | autre
    preferred_language TEXT NOT NULL DEFAULT 'fr', -- fr | en | zh
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sensitive_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    viewed_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'chambre', -- maison | appartement | chambre
    description TEXT,
    city TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'France',
    address TEXT,
    latitude REAL,
    longitude REAL,
    price_per_night REAL NOT NULL,
    capacity_adults INTEGER NOT NULL DEFAULT 2,
    capacity_children INTEGER NOT NULL DEFAULT 0,
    bedrooms INTEGER NOT NULL DEFAULT 1,
    beds INTEGER NOT NULL DEFAULT 1,
    bathrooms INTEGER NOT NULL DEFAULT 1,
    amenities TEXT NOT NULL DEFAULT '[]', -- JSON array
    images TEXT NOT NULL DEFAULT '[]', -- JSON array of URLs
    status TEXT NOT NULL DEFAULT 'disponible', -- disponible | indisponible
    rating REAL NOT NULL DEFAULT 0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 2,
    children INTEGER NOT NULL DEFAULT 0,
    nights INTEGER NOT NULL,
    price_per_night REAL NOT NULL,
    total_price REAL NOT NULL,
    travel_purpose TEXT DEFAULT 'tourisme', -- tourisme | affaires | etudes | demenagement | autre
    status TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | confirmee | annulee | terminee
    special_requests TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    method TEXT NOT NULL, -- crypto
    provider TEXT, -- binance_pay | btc | usdt | eth | usdc ...
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'en_attente', -- en_attente | valide | echoue | rembourse
    reference TEXT,
    proof TEXT,
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    validated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    booking_id INTEGER REFERENCES bookings(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, room_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id), -- NULL = pour tous les admins
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    percent_off INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_user_id INTEGER NOT NULL REFERENCES users(id),
    performed_by_admin_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Un seul wallet crypto configuré (paiement manuel : le client envoie, colle le hash, l'admin vérifie et valide).
  CREATE TABLE IF NOT EXISTS crypto_wallet (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    address TEXT,
    network_note TEXT, -- ex : "USDC sur le réseau Base uniquement"
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Réglages génériques activables/désactivables par l'admin sans redéploiement.
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Demandes du parcours immobilier (achat ou location) — formulaire long, réponses stockées en JSON
  -- car la structure varie beaucoup selon les branches conditionnelles (terrain, crédit, meublé, etc.)
  CREATE TABLE IF NOT EXISTS property_inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL, -- achat | location
    answers TEXT NOT NULL DEFAULT '{}', -- JSON complet des réponses du parcours
    wants_admin_contact INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'nouveau', -- nouveau | en_discussion | traite | abandonne
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
