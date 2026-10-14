// The magic-link email, sent with the same SMTP settings the SalesKnot server uses.
import nodemailer from 'nodemailer';
import { config } from './config.mjs';
import { escapeHtml, formatUntil } from './util.mjs';

let transport;
function getTransport() {
  if (transport) return transport;
  const e = config.email;
  if (e.driver !== 'SMTP') {
    throw new Error('EMAIL_DRIVER is not SMTP, so demo links cannot be emailed. Set EMAIL_DRIVER=SMTP and the EMAIL_SMTP_* settings.');
  }
  const options = { host: e.host, port: e.port, secure: !e.noTls && e.port === 465, pool: true };
  if (e.name) options.name = e.name;
  if (e.user && e.password) options.auth = { user: e.user, pass: e.password };
  if (e.noTls) Object.assign(options, { secure: false, ignoreTLS: true });
  transport = nodemailer.createTransport(options);
  return transport;
}

export function renderEmail({ firstName, editionName, link, expiresAt, timezone }) {
  const until = formatUntil(expiresAt, timezone);
  const days = config.demoDays;
  const subject = `Your SalesKnot ${editionName} demo`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Your SalesKnot ${editionName} demo is ready. Open it with this link, no password needed:`,
    link,
    '',
    `The link is valid for ${days} days, until ${until}. You can use it as often as you like until then.`,
    '',
    'The demo workspace is shared with other people trying SalesKnot, so please do not enter real customer data.',
    '',
    `Questions? Reply to this email or contact us: ${config.contactUrl}`,
    '',
    'SalesKnot by OpsKnot',
  ].join('\n');

  const h = escapeHtml;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d2433;">
<div style="display:none;max-height:0;overflow:hidden;">Open your ${h(editionName)} demo, no password needed. Valid until ${h(until)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5fb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e3e7f2;">
<tr><td style="padding:32px 32px 8px 32px;">
<img src="${h(config.logoUrl)}" width="48" height="48" alt="SalesKnot" style="display:block;border:0;border-radius:10px;">
</td></tr>
<tr><td style="padding:16px 32px 0 32px;">
<h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0b1020;">Your ${h(editionName)} demo is ready</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;">Hi ${h(firstName)}, thanks for booking a SalesKnot demo. Click the button to open the ${h(editionName)} edition. No password needed.</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#4f7cff;">
<a href="${h(link)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Open my demo</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 32px 0 32px;">
<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#4a5368;">Valid for ${days} days, until <strong style="color:#1d2433;">${h(until)}</strong>. You can use the link as often as you like until then.</p>
<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#4a5368;">The demo workspace is shared with other people trying SalesKnot, so please don't enter real customer data.</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#7a8296;word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${h(link)}" style="color:#4f7cff;">${h(link)}</a></p>
</td></tr>
<tr><td style="padding:24px 32px 28px 32px;">
<hr style="border:0;border-top:1px solid #e3e7f2;margin:0 0 16px 0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#7a8296;">Questions? Reply to this email or <a href="${h(config.contactUrl)}" style="color:#4f7cff;">contact us</a>.<br>SalesKnot by OpsKnot</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

export async function sendMagicLink(to, data) {
  const { subject, text, html } = renderEmail(data);
  await getTransport().sendMail({
    from: { name: config.email.fromName, address: config.email.fromAddress },
    to,
    replyTo: config.email.replyTo,
    subject,
    text,
    html,
  });
}
