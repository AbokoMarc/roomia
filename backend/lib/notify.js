import { db } from '../db.js';
import { notifyUser, notifyAllAdmins } from './sse.js';

const insertNotif = db.prepare(`
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (?, ?, ?, ?, ?)
`);

export function notifyClient(userId, type, title, message, data = {}) {
  const info = insertNotif.run(userId, type, title, message, JSON.stringify(data));
  const notif = { id: Number(info.lastInsertRowid), type, title, message, data, read: 0, created_at: new Date().toISOString() };
  notifyUser(userId, 'notification', notif);
  return notif;
}

export function notifyAdmins(type, title, message, data = {}) {
  const info = insertNotif.run(null, type, title, message, JSON.stringify(data));
  const notif = { id: Number(info.lastInsertRowid), type, title, message, data, read: 0, created_at: new Date().toISOString() };
  const adminIds = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all().map(r => r.id);
  notifyAllAdmins('notification', notif, adminIds);
  return notif;
}
