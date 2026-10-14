// Bookings: create, open a magic link, remove access when the demo ends.
import { config, EDITIONS } from './config.mjs';
import { pool } from './db.mjs';
import { sendMagicLink } from './email.mjs';
import { newVisitorEmail, provisionVisitor, removeVisitor, signInUrl } from './twenty.mjs';
import { EMAIL_RE, hashToken, isIp, maskEmail, newToken, normalizeEmail, validTimezone } from './util.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const cleanText = (v, max) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length > max) return undefined;
  return s || null;
};

export function validateBooking(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Send the booking as a JSON object.');
  const firstName = cleanText(body.firstName, 100);
  const lastName = cleanText(body.lastName, 100);
  if (!firstName) throw new HttpError(400, 'Please enter your first name.');
  if (!lastName) throw new HttpError(400, 'Please enter your last name.');
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  const slug = typeof body.edition === 'string' ? body.edition.trim().toLowerCase() : '';
  const edition = EDITIONS[slug];
  if (!edition) throw new HttpError(400, 'Please choose a SalesKnot edition for your demo.');
  if (!edition.bookable) throw new HttpError(400, `The ${edition.name} edition is coming soon and can't be booked for a demo yet.`);
  const phone = cleanText(body.phone, 40);
  if (phone === undefined || (phone && !/^[0-9+()\-.\s]{4,40}$/.test(phone))) throw new HttpError(400, 'Please enter a valid phone number.');
  const message = cleanText(body.message, 4000);
  if (message === undefined) throw new HttpError(400, 'Your message is too long.');
  const timezone = validTimezone(body.timezone);
  const country = typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country.trim()) ? body.country.trim().toUpperCase() : null;
  const ip = isIp(body.ip) ? body.ip.trim() : null;
  return { firstName, lastName, email, normalizedEmail: normalizeEmail(email), phone, slug, edition, message, timezone, country, ip };
}

const duplicateMessage = (edition) =>
  `This email has already been used for a ${edition.name} demo. Please check your inbox, or contact us.`;

export async function createBooking(body) {
  const b = validateBooking(body);
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.demoDays * 86400000);
  let id;
  try {
    const { rows } = await pool.query(
      `INSERT INTO bookings (first_name, last_name, email, normalized_email, phone, edition, message, timezone, country, ip,
                             token_hash, expires_at, workspace_user_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [b.firstName, b.lastName, b.email, b.normalizedEmail, b.phone, b.slug, b.message, b.timezone, b.country, b.ip,
        hashToken(token), expiresAt, newVisitorEmail()],
    );
    id = rows[0].id;
  } catch (err) {
    if (err.code === '23505' && /one_per_edition/.test(err.constraint || '')) throw new HttpError(409, duplicateMessage(b.edition));
    throw err;
  }
  try {
    await sendMagicLink(b.email, {
      firstName: b.firstName,
      editionName: b.edition.name,
      link: `${config.publicBaseUrl}/demo/go/${token}`,
      expiresAt,
      timezone: b.timezone,
    });
  } catch (err) {
    // No email, no booking: the visitor can simply try again.
    await pool.query('DELETE FROM bookings WHERE id = $1', [id]).catch(() => {});
    console.error(`[booking] email to ${maskEmail(b.email)} failed: ${err.message}`);
    throw new HttpError(502, "We couldn't send your demo email right now. Please try again in a few minutes.");
  }
  console.log(`[booking] ${id} ${b.slug} ${maskEmail(b.email)}`);
  return { id };
}

// Returns the URL to redirect the visitor to, or null when the link is unknown/expired.
export async function openLink(token) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM bookings WHERE token_hash = $1 AND revoked_at IS NULL AND access_removed_at IS NULL AND expires_at > now() FOR UPDATE`,
      [hashToken(token)],
    );
    const b = rows[0];
    if (!b) {
      await client.query('ROLLBACK');
      return null;
    }
    if (!b.workspace_member_id) {
      const memberId = await provisionVisitor(b.edition, b.workspace_user_email, { firstName: b.first_name, lastName: b.last_name });
      await client.query('UPDATE bookings SET workspace_member_id = $2 WHERE id = $1', [b.id, memberId]);
      console.log(`[link] ${b.id} visitor added to ${b.edition}`);
    }
    const url = await signInUrl(b.edition, b.workspace_user_email);
    await client.query(
      `UPDATE bookings SET first_used_at = coalesce(first_used_at, now()), last_used_at = now(), use_count = use_count + 1 WHERE id = $1`,
      [b.id],
    );
    await client.query('COMMIT');
    return url;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Removes visitors whose demo ended (or was revoked) from their workspace.
export async function sweep() {
  const { rows } = await pool.query(
    `SELECT id, edition, workspace_user_email, workspace_member_id FROM bookings
      WHERE access_removed_at IS NULL AND (expires_at <= now() OR revoked_at IS NOT NULL)
      ORDER BY expires_at LIMIT 500`,
  );
  let removed = 0;
  let failed = 0;
  for (const b of rows) {
    try {
      // Lock the row so a click that is provisioning right now finishes first.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT 1 FROM bookings WHERE id = $1 FOR UPDATE', [b.id]);
        if (EDITIONS[b.edition]) await removeVisitor(b.edition, b.workspace_user_email, b.workspace_member_id);
        await client.query('UPDATE bookings SET access_removed_at = now() WHERE id = $1', [b.id]);
        await client.query('COMMIT');
        removed++;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      failed++;
      console.error(`[sweep] ${b.id} ${b.edition}: ${err.message}`);
    }
  }
  if (rows.length) console.log(`[sweep] access removed for ${removed} booking(s), ${failed} failed`);
  return { removed, failed };
}

export async function listBookings() {
  const { rows } = await pool.query(
    `SELECT created_at, edition, first_name, last_name, email, phone, country, expires_at, first_used_at, last_used_at, use_count,
            CASE WHEN revoked_at IS NOT NULL THEN 'revoked'
                 WHEN access_removed_at IS NOT NULL OR expires_at <= now() THEN 'expired'
                 WHEN workspace_member_id IS NOT NULL THEN 'active'
                 ELSE 'not opened yet' END AS status
       FROM bookings ORDER BY created_at DESC`,
  );
  return rows;
}

export async function revokeBooking(email, slug, { forget = false } = {}) {
  const n = normalizeEmail(email);
  const { rows } = await pool.query('UPDATE bookings SET revoked_at = coalesce(revoked_at, now()) WHERE normalized_email = $1 AND edition = $2 RETURNING id', [n, slug]);
  if (!rows.length) return 0;
  await sweep();
  if (forget) await pool.query('DELETE FROM bookings WHERE id = $1 AND access_removed_at IS NOT NULL', [rows[0].id]);
  return rows.length;
}

