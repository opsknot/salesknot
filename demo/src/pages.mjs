// Small branded pages shown to visitors (expired link, temporary error).
import { config } from './config.mjs';
import { escapeHtml as h } from './util.mjs';

function page({ title, heading, body, button }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${h(title)} | SalesKnot</title>
<link rel="icon" href="/favicon.ico">
<style>
  :root { --bg:#05070f; --card:#0d1222; --line:#1e2740; --fg:#f4f6ff; --muted:#a3acc6; --blue:#4f7cff; --violet:#8b5cf6; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { background: radial-gradient(1200px 600px at 50% -10%, rgba(79,124,255,.22), transparent 60%), var(--bg);
         color: var(--fg); font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px 16px; }
  main { width: 100%; max-width: 460px; background: var(--card); border: 1px solid var(--line); border-radius: 18px;
         padding: 36px 32px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
  img { width: 56px; height: 56px; border-radius: 12px; display: block; margin: 0 auto 20px; }
  h1 { font-size: 24px; line-height: 1.3; margin: 0 0 12px; }
  p { color: var(--muted); margin: 0 0 24px; }
  a.btn { display: inline-block; background: linear-gradient(135deg, var(--blue), var(--violet)); color: #fff; text-decoration: none;
          font-weight: 600; padding: 12px 24px; border-radius: 10px; }
  a.btn:focus-visible { outline: 3px solid #b9f3ff; outline-offset: 3px; }
  footer { margin-top: 28px; font-size: 13px; color: #6f7894; }
  footer a { color: inherit; }
</style>
</head><body>
<main>
  <img src="${h(config.logoUrl)}" alt="SalesKnot">
  <h1>${h(heading)}</h1>
  <p>${body}</p>
  ${button ? `<a class="btn" href="${h(button.href)}">${h(button.label)}</a>` : ''}
  <footer>SalesKnot by <a href="https://opsknot.com/">OpsKnot</a></footer>
</main>
</body></html>`;
}

export const expiredPage = () =>
  page({
    title: 'Demo link expired',
    heading: 'This demo link has expired',
    body: `Demo links stay active for ${config.demoDays} days. If you'd like another look at SalesKnot, get in touch and we'll set you up.`,
    button: { href: config.contactUrl, label: 'Contact us' },
  });

export const errorPage = () =>
  page({
    title: 'Demo not available right now',
    heading: "We couldn't open your demo just now",
    body: 'Something went wrong on our side. Please try the link again in a minute. If it keeps happening, let us know.',
    button: { href: config.contactUrl, label: 'Contact us' },
  });

export const notFoundPage = () =>
  page({
    title: 'Page not found',
    heading: 'Page not found',
    body: 'This page does not exist. To try SalesKnot, book a demo on our website.',
    button: { href: config.contactUrl, label: 'Book a demo' },
  });
