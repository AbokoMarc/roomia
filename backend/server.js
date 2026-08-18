import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import { handleAuth } from './routes/auth.js';
import { handleRooms } from './routes/rooms.js';
import { handleBookings } from './routes/bookings.js';
import { handlePayments } from './routes/payments.js';
import { handleReviews } from './routes/reviews.js';
import { handleFavorites } from './routes/favorites.js';
import { handleNotifications } from './routes/notifications.js';
import { handleAdminStats } from './routes/admin.js';
import { handleAdminUsers } from './routes/admin-users.js';
import { bootstrapAdmin } from './bootstrap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');

bootstrapAdmin();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(FRONTEND_DIR, filePath);
  if (!filePath.startsWith(FRONTEND_DIR)) { res.writeHead(403); return res.end(); }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // fallback SPA-like : pages sans extension -> tente .html, sinon 404
      if (!path.extname(filePath)) {
        return fs.readFile(filePath + '.html', (err2, data2) => {
          if (err2) { res.writeHead(404); return res.end('Page introuvable'); }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data2);
        });
      }
      res.writeHead(404); return res.end('Fichier introuvable');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = urlObj.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (!urlPath.startsWith('/api/')) {
    return serveStatic(req, res, urlPath);
  }

  try {
    const handlers = [handleAuth, handleRooms, handleBookings, handlePayments, handleReviews, handleFavorites, handleNotifications, handleAdminStats, handleAdminUsers];
    for (const handler of handlers) {
      const result = await handler(req, res, urlPath, urlObj);
      if (result !== null && result !== undefined) return; // déjà traité
      if (res.writableEnded || res.headersSent) return; // réponse déjà envoyée ou en cours (ex : flux SSE) — ne jamais tenter de ré-écrire des en-têtes
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route API introuvable.' }));
  } catch (err) {
    console.error('Erreur serveur:', err);
    if (!res.writableEnded && !res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur interne du serveur.' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`🏨 Roomia backend démarré sur http://localhost:${PORT}`);
});

// Filet de sécurité : une erreur imprévue dans une requête ne doit jamais faire tomber le serveur entier pour tout le monde.
process.on('uncaughtException', (err) => {
  console.error('Exception non interceptée (serveur maintenu en vie) :', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Rejet de promesse non intercepté (serveur maintenu en vie) :', err);
});
