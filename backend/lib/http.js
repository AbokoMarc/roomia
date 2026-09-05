export function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

export function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) req.destroy(); // 10MB max
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// Corps brut (Buffer), nécessaire pour vérifier la signature des webhooks (Binance Pay) —
// on ne doit JAMAIS JSON.parse le corps avant que la gateway en vérifie l'intégrité.
export function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => {
      chunks.push(c);
      if (chunks.reduce((n, c) => n + c.length, 0) > 1024 * 1024) req.destroy(); // 1MB max
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function notFound(res) {
  json(res, 404, { error: 'Ressource introuvable.' });
}
