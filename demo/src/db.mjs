// The demo database (salesknot_demos): created on first start, migrations applied in order.
import pg from 'pg';
import { config } from './config.mjs';

const MIGRATIONS = [
  // 1: bookings
  `CREATE TABLE bookings (
     id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     first_name        text NOT NULL,
     last_name         text NOT NULL,
     email             text NOT NULL,
     normalized_email  text NOT NULL,
     phone             text,
     edition           text NOT NULL,
     message           text,
     timezone          text,
     country           char(2),
     ip                text,
     created_at        timestamptz NOT NULL DEFAULT now(),
     token_hash        text NOT NULL UNIQUE,          -- sha256 of the magic-link token; the token itself is never stored
     expires_at        timestamptz NOT NULL,
     first_used_at     timestamptz,
     last_used_at      timestamptz,
     use_count         integer NOT NULL DEFAULT 0,
     workspace_user_email text UNIQUE,                -- the SalesKnot login created for this booking
     workspace_member_id  uuid,                       -- its member id in the edition's workspace
     access_removed_at timestamptz,                   -- when the visitor was removed from the workspace
     revoked_at        timestamptz,
     CONSTRAINT bookings_one_per_edition UNIQUE (normalized_email, edition)
   );
   CREATE INDEX bookings_expiry_idx ON bookings (expires_at) WHERE access_removed_at IS NULL;`,
  // 2: bookings wait for the owner's approval; the link (token + expiry) is only made on approval
  `ALTER TABLE bookings ALTER COLUMN token_hash DROP NOT NULL, ALTER COLUMN expires_at DROP NOT NULL;
   ALTER TABLE bookings ADD COLUMN approved_at timestamptz;
   UPDATE bookings SET approved_at = created_at;`,
];

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });

async function ensureDatabase() {
  const target = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const probe = new pg.Client({ connectionString: config.databaseUrl });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    if (err.code !== '3D000') throw err; // anything but "database does not exist"
  }
  const adminUrl = new URL(config.databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`[db] created database ${dbName}`);
  } catch (err) {
    if (err.code !== '42P04') throw err; // already exists (created by a parallel start)
  } finally {
    await admin.end();
  }
}

export async function migrate() {
  await ensureDatabase();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7310001)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const { rows } = await client.query('SELECT coalesce(max(version), 0) AS v FROM schema_migrations');
    for (let v = rows[0].v + 1; v <= MIGRATIONS.length; v++) {
      await client.query('BEGIN');
      await client.query(MIGRATIONS[v - 1]);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v]);
      await client.query('COMMIT');
      console.log(`[db] applied migration ${v}`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7310001)').catch(() => {});
    client.release();
  }
}
