// Hub de notifications en temps réel — Server-Sent Events (natif, aucune dépendance).
// Chaque client connecté (client ou admin) garde une connexion HTTP ouverte ;
// on lui pousse des events texte au fil de l'eau (nouvelle réservation, paiement validé, etc).

const clients = new Map(); // userId (ou 'admin:'+userId) -> Set(res)

function keyFor(userId, role) {
  return role === 'admin' ? `admin:${userId}` : `client:${userId}`;
}

export function sseHandler(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('retry: 3000\n\n');

  const key = keyFor(user.id, user.role);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.get(key)?.delete(res);
  });
}

function send(key, event, data) {
  const conns = clients.get(key);
  if (!conns) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of conns) {
    try { res.write(payload); } catch { /* noop */ }
  }
}

export function notifyUser(userId, event, data) {
  send(`client:${userId}`, event, data);
}

export function notifyAllAdmins(event, data, adminIds = []) {
  for (const id of adminIds) send(`admin:${id}`, event, data);
}
