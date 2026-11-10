import { q } from './db.js';
// Envio real somente com provedor configurado (Resend). Sem provedor, a mensagem
// permanece na fila mail_outbox e a API informa mail_enabled=false — nada é simulado.
export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function queueMail(userId, kind, to, payload) {
  const { rows } = await q('INSERT INTO mail_outbox(user_id, kind, to_email, payload) VALUES ($1,$2,$3,$4) RETURNING id',
    [userId, kind, to, payload]);
  if (!mailEnabled()) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: payload.subject, html: payload.html }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await q('UPDATE mail_outbox SET sent_at = now() WHERE id = $1', [rows[0].id]);
    return true;
  } catch (e) {
    await q('UPDATE mail_outbox SET error = $2 WHERE id = $1', [rows[0].id, String(e.message).slice(0, 200)]);
    return false;
  }
}
