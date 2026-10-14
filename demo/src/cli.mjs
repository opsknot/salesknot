// Owner commands. In production: docker compose exec demo node src/cli.mjs <command>
//   list                              all bookings, newest first
//   revoke <email> <edition>          end a demo now (removes the visitor from the workspace)
//   forget <email> <edition>          revoke and delete the booking, so that email can book that edition again
//   sweep                             remove every expired visitor now (also runs every hour)
//   setup [edition]                   one-time workspace setup: visitor role, public invite link off
//   bootstrap <owner-email> <owner-password> [edition]
//                                     add the DEMO_ADMIN_EMAIL account as Admin to the demo workspace(s)
import { assertConfig, EDITIONS, workspaceUrl } from './config.mjs';
import { migrate, pool } from './db.mjs';
import { listBookings, revokeBooking, sweep } from './bookings.mjs';
import { bootstrapAdmin, setupWorkspace } from './twenty.mjs';

const [cmd, ...args] = process.argv.slice(2);
const bookable = Object.keys(EDITIONS).filter((s) => EDITIONS[s].bookable);
const pickEditions = (slug) => {
  if (!slug) return bookable;
  if (!EDITIONS[slug]) throw new Error(`Unknown edition "${slug}". Editions: ${bookable.join(', ')}`);
  return [slug];
};
const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-');

async function main() {
  assertConfig({ needApi: false });
  switch (cmd) {
    case 'list': {
      await migrate();
      const rows = await listBookings();
      if (!rows.length) return console.log('No bookings yet.');
      console.table(
        rows.map((r) => ({
          booked: fmt(r.created_at),
          edition: r.edition,
          name: `${r.first_name} ${r.last_name}`,
          email: r.email,
          phone: r.phone || '',
          country: r.country || '',
          status: r.status,
          'expires (UTC)': fmt(r.expires_at),
          'last used': fmt(r.last_used_at),
          opens: r.use_count,
        })),
      );
      return;
    }
    case 'revoke':
    case 'forget': {
      const [email, slug] = args;
      if (!email || !slug) throw new Error(`Usage: node src/cli.mjs ${cmd} <email> <edition>`);
      pickEditions(slug);
      await migrate();
      const n = await revokeBooking(email, slug, { forget: cmd === 'forget' });
      console.log(n ? `Done: ${email} no longer has access to the ${EDITIONS[slug].name} demo${cmd === 'forget' ? ' and can book it again' : ''}.` : 'No booking found for that email and edition.');
      return;
    }
    case 'sweep': {
      await migrate();
      console.log(await sweep());
      return;
    }
    case 'setup': {
      for (const slug of pickEditions(args[0])) {
        try {
          console.log(`${slug} (${workspaceUrl(slug)}): ${(await setupWorkspace(slug)).join('; ')}`);
        } catch (err) {
          console.log(`${slug} (${workspaceUrl(slug)}): FAILED - ${err.message}`);
        }
      }
      return;
    }
    case 'bootstrap': {
      const [ownerEmail, ownerPassword, slug] = args;
      if (!ownerEmail || !ownerPassword) throw new Error('Usage: node src/cli.mjs bootstrap <owner-email> <owner-password> [edition]');
      for (const s of pickEditions(slug)) {
        try {
          console.log(`${s} (${workspaceUrl(s)}): ${await bootstrapAdmin(s, ownerEmail, ownerPassword)}`);
        } catch (err) {
          console.log(`${s} (${workspaceUrl(s)}): FAILED - ${err.message}`);
        }
      }
      return;
    }
    default:
      console.log('Commands: list | revoke <email> <edition> | forget <email> <edition> | sweep | setup [edition] | bootstrap <owner-email> <owner-password> [edition]');
  }
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
