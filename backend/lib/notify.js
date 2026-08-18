import { db } from '../db.js';
import { notifyUser, notifyAllAdmins } from './sse.js';

const insertNotif = db.prepare(`
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (?, ?, ?, ?, ?)
`);

export async function notifyClient(userId, type, title, message, data = {}) {
  const info = await insertNotif.run(userId, type, title, message, JSON.stringify(data));
  const notif = { id: info.lastInsertRowid, type, title, message, data, read: 0, created_at: new Date().toISOString() };
  notifyUser(userId, 'notification', notif);
  return notif;
}

export async function notifyAdmins(type, title, message, data = {}) {
  const info = await insertNotif.run(null, type, title, message, JSON.stringify(data));
  const notif = { id: info.lastInsertRowid, type, title, message, data, read: 0, created_at: new Date().toISOString() };
  const admins = await db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all();
  notifyAllAdmins('notification', notif, admins.map(r => r.id));
  return notif;
}
