// Owner commands. In production: docker compose exec demo node src/cli.mjs <command>
//   list                              all bookings, newest first (new ones say WAITING FOR APPROVAL)
//   approve <email> <edition> [days]  email that booking its magic link (again = a fresh link)
//   decline <email> <edition>         turn a booking down; that email can't book this edition again
//   invite <email> <edition> <first-name> <last-name> [days]
//                                     demo for someone who asked another way (no booking needed)
//   revoke <email> <edition>          end a demo now (removes the visitor from the workspace)
//   forget <email> <edition>          revoke and delete the booking, so that email can book that edition again
//   sweep                             remove every expired visitor now (also runs every hour)
//   setup [edition]                   one-time workspace setup: visitor role, public invite link off
//   bootstrap <owner-email> <owner-password> [edition]
//                                     add the DEMO_ADMIN_EMAIL account as Admin to the demo workspace(s)
import { assertConfig, EDITIONS, workspaceUrl } from './config.mjs';
import { migrate, pool } from './db.mjs';
import { approveBooking, inviteVisitor, listBookings, revokeBooking, sweep } from './bookings.mjs';
import { bootstrapAdmin, setupWorkspace } from './twenty.mjs';

const [cmd, ...args] = process.argv.slice(2);
const bookable = Object.keys(EDITIONS).filter((s) => EDITIONS[s].bookable);
const pickEditions = (slug) => {
  if (!slug) return bookable;
  if (!EDITIONS[slug]) throw new Error(`Unknown edition "${slug}". Editions: ${bookable.join(', ')}`);
  return [slug];
};
const parseDays = (v) => {
  if (v === undefined) return undefined;
  const d = Number(v);
  if (!Number.isInteger(d) || d < 1 || d > 30) throw new Error('Days must be a whole number from 1 to 30.');
  return d;
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
    case 'approve': {
      const [email, slug, days] = args;
      if (!email || !slug) throw new Error('Usage: node src/cli.mjs approve <email> <edition> [days]');
      pickEditions(slug);
      await migrate();
      const r = await approveBooking(email, slug, { days: parseDays(days) });
      console.log(`Done: ${r.resent ? 'a fresh' : 'the'} ${EDITIONS[slug].name} demo link was emailed to ${email}. It works until ${fmt(r.expiresAt)} UTC.`);
      return;
    }
    case 'invite': {
      const [email, slug, firstName, lastName, days] = args;
      if (!email || !slug || !firstName || !lastName) throw new Error('Usage: node src/cli.mjs invite <email> <edition> <first-name> <last-name> [days]');
      pickEditions(slug);
      await migrate();
      const r = await inviteVisitor({ email, slug, firstName, lastName, days: parseDays(days) });
      console.log(`Done: the ${EDITIONS[slug].name} demo link was emailed to ${email}. It works until ${fmt(r.expiresAt)} UTC.`);
      return;
    }
    case 'decline':
    case 'revoke':
    case 'forget': {
      const [email, slug] = args;
      if (!email || !slug) throw new Error(`Usage: node src/cli.mjs ${cmd} <email> <edition>`);
      pickEditions(slug);
      await migrate();
      const n = await revokeBooking(email, slug, { forget: cmd === 'forget' });
      console.log(n ? `Done: ${email} ${cmd === 'decline' ? 'was turned down for' : 'no longer has access to'} the ${EDITIONS[slug].name} demo${cmd === 'forget' ? ' and can book it again' : ''}.` : 'No booking found for that email and edition.');
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
      console.log('Commands: list | approve <email> <edition> [days] | decline <email> <edition> | invite <email> <edition> <first> <last> [days] | revoke <email> <edition> | forget <email> <edition> | sweep | setup [edition] | bootstrap <owner-email> <owner-password> [edition]');
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
