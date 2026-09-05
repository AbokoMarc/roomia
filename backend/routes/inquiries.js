import { db } from '../db.js';
import { json, parseBody, notFound } from '../lib/http.js';
import { requireAuth, requireAdmin } from '../lib/auth.js';
import { notifyAdmins, notifyClient } from '../lib/notify.js';

function parseInquiry(row) {
  return { ...row, answers: JSON.parse(row.answers || '{}'), wants_admin_contact: !!row.wants_admin_contact };
}

export async function handleInquiries(req, res, urlPath) {
  // POST /api/inquiries — soumission du parcours achat ou location
  if (urlPath === '/api/inquiries' && req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { kind, answers, wants_admin_contact } = await parseBody(req);
    if (!['achat', 'location'].includes(kind)) return json(res, 400, { error: 'Type de demande invalide.' });
    if (!answers || typeof answers !== 'object') return json(res, 400, { error: 'Réponses manquantes.' });

    const info = await db.prepare(`
      INSERT INTO property_inquiries (user_id, kind, answers, wants_admin_contact) VALUES (?, ?, ?, ?)
    `).run(user.id, kind, JSON.stringify(answers), wants_admin_contact ? 1 : 0);

    await notifyAdmins(
      'nouvelle_demande_immo',
      kind === 'achat' ? "Nouvelle demande d'achat" : 'Nouvelle demande de location',
      `${user.name} a soumis une demande de ${kind}.${wants_admin_contact ? ' Souhaite être contacté.' : ''}`,
      { inquiry_id: info.lastInsertRowid }
    );

    const inquiry = await db.prepare('SELECT * FROM property_inquiries WHERE id = ?').get(info.lastInsertRowid);
    return json(res, 201, { inquiry: parseInquiry(inquiry) });
  }

  // GET /api/inquiries/mine — demandes du client connecté
  if (urlPath === '/api/inquiries/mine' && req.method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    const rows = await db.prepare('SELECT * FROM property_inquiries WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
    return json(res, 200, { inquiries: rows.map(parseInquiry) });
  }

  // GET /api/admin/inquiries — toutes les demandes (admin)
  if (urlPath === '/api/admin/inquiries' && req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const rows = await db.prepare(`
      SELECT property_inquiries.*, users.name as client_name, users.email as client_email, users.phone as client_phone
      FROM property_inquiries JOIN users ON users.id = property_inquiries.user_id
      ORDER BY property_inquiries.created_at DESC
    `).all();
    return json(res, 200, { inquiries: rows.map(parseInquiry) });
  }

  // PUT /api/admin/inquiries/:id/status — changer le statut d'une demande
  const statusMatch = urlPath.match(/^\/api\/admin\/inquiries\/(\d+)\/status$/);
  if (statusMatch && req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { status, admin_note } = await parseBody(req);
    if (!['nouveau', 'en_discussion', 'traite', 'abandonne'].includes(status)) return json(res, 400, { error: 'Statut invalide.' });
    const inquiry = await db.prepare('SELECT * FROM property_inquiries WHERE id = ?').get(statusMatch[1]);
    if (!inquiry) return notFound(res);
    await db.prepare(`UPDATE property_inquiries SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = datetime('now') WHERE id = ?`)
      .run(status, admin_note || null, statusMatch[1]);
    if (status === 'en_discussion') {
      await notifyClient(inquiry.user_id, 'demande_immo_maj', 'Ta demande est en cours de traitement', 'Un conseiller va te contacter prochainement au sujet de ta demande.', { inquiry_id: inquiry.id });
    }
    const updated = await db.prepare('SELECT * FROM property_inquiries WHERE id = ?').get(statusMatch[1]);
    return json(res, 200, { inquiry: parseInquiry(updated) });
  }

  return null;
}
