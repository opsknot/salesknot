// SalesKnot live chat: an AI assistant that answers questions about SalesKnot and hands
// interested visitors to a demo booking or an "Email me" lead. The answers come from
// opsknot.com/api/salesknot-chat/ (Groq), which streams plain text back.
(() => {
  const API = 'https://opsknot.com/api/salesknot-chat/';
  const LEAD_API = 'https://opsknot.com/api/salesknot-chat/lead/';
  const DEMO = 'https://opsknot.com/contact/booking/?topic=salesknot';
  const STORE = 'sk-chat-v1';
  const GREETING = "Hi! I'm the SalesKnot assistant. Ask me about features, editions, pricing or moving from your current CRM.";
  const STARTERS = ['What is SalesKnot?', 'How much does it cost?', 'Which editions are there?', 'Can you move us from HubSpot?'];
  const MAX_TURNS = 20;

  const track = (name) => { try { window.gtag && window.gtag('event', name, { event_category: 'salesknot_chat' }); } catch (e) {} };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || null; } catch (e) { return null; } };
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

  const state = Object.assign({ open: false, messages: [], leadSent: false, nudged: false }, load() || {});
  let busy = false;

  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_CHAT = icon('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>');
  const ICON_CLOSE = icon('<path d="M18 6 6 18M6 6l12 12"/>');
  const ICON_SEND = icon('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const markSvg = document.querySelector('.brand svg');
  const MARK = markSvg ? markSvg.outerHTML.replace(/id="hd/g, 'id="ck').replace(/#hd/g, '#ck') : '';

  // ---- markup
  const root = document.createElement('div');
  root.className = 'skc';
  root.innerHTML = `
<button class="skc-launch" type="button" aria-expanded="false" aria-controls="skc-panel">${ICON_CHAT}<span>Ask SalesKnot</span></button>
<div class="skc-panel" id="skc-panel" role="dialog" aria-label="SalesKnot assistant" hidden>
  <div class="skc-head">
    <span class="skc-mark">${MARK}</span>
    <div><b>SalesKnot assistant</b><small><i></i>Answers instantly · real people by email</small></div>
    <button class="skc-close" type="button" aria-label="Close chat">${ICON_CLOSE}</button>
  </div>
  <div class="skc-log" aria-live="polite"></div>
  <div class="skc-actions">
    <a class="skc-act" href="${DEMO}">Book a demo</a>
    <button class="skc-act" type="button" data-lead>Email me</button>
  </div>
  <form class="skc-form" autocomplete="off">
    <label class="skc-sr" for="skc-input">Your message</label>
    <textarea id="skc-input" rows="1" maxlength="800" placeholder="Ask about SalesKnot…"></textarea>
    <button type="submit" aria-label="Send">${ICON_SEND}</button>
  </form>
  <p class="skc-note">AI answers can be wrong. For quotes, book a demo.</p>
</div>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const launch = $('.skc-launch'), panel = $('.skc-panel'), log = $('.skc-log'), form = $('.skc-form'),
        input = $('#skc-input'), sendBtn = form.querySelector('button'), leadBtn = $('[data-lead]');

  // ---- rendering
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (text) => esc(text).replace(/(https?:\/\/[^\s<)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g, (m) => {
    const clean = m.replace(/[.,;:!?]+$/, ''), tail = m.slice(clean.length);
    if (clean.includes('@') && !clean.startsWith('http')) return `<a href="mailto:${clean}">${clean}</a>${tail}`;
    const label = clean.includes('/contact/booking/') ? 'Book a demo' : clean.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const same = /^https:\/\/salesknot\.app/.test(clean);
    return `<a href="${clean}"${same ? '' : ' target="_blank" rel="noopener"'}>${label}</a>${tail}`;
  });
  const bubble = (role, text) => {
    const el = document.createElement('div');
    el.className = `skc-msg skc-${role}`;
    el.innerHTML = role === 'user' ? esc(text) : linkify(text);
    log.appendChild(el);
    return el;
  };
  const scroll = () => { log.scrollTop = log.scrollHeight; };

  function render() {
    log.innerHTML = '';
    bubble('assistant', GREETING);
    if (!state.messages.length) {
      const chips = document.createElement('div');
      chips.className = 'skc-chips';
      STARTERS.forEach((q) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = q;
        b.addEventListener('click', () => ask(q));
        chips.appendChild(b);
      });
      log.appendChild(chips);
    }
    state.messages.forEach((m) => bubble(m.role, m.content));
    if (state.nudged && !state.leadSent) nudge();
    if (state.leadSent) note('Thanks! The SalesKnot team will reply by email within one business day.');
    leadBtn.textContent = state.leadSent ? 'Email sent ✓' : 'Email me';
    leadBtn.disabled = state.leadSent;
    scroll();
  }
  function note(text) {
    const el = document.createElement('p');
    el.className = 'skc-sys';
    el.textContent = text;
    log.appendChild(el);
  }
  function nudge() {
    if (log.querySelector('.skc-nudge')) return;
    const el = document.createElement('div');
    el.className = 'skc-nudge';
    el.innerHTML = `<span>Want a person to look at your setup?</span><a href="${DEMO}">Book a demo</a><button type="button">Email me</button>`;
    el.querySelector('button').addEventListener('click', showLead);
    log.appendChild(el);
  }

  // ---- open / close
  function setOpen(open) {
    state.open = open; save();
    panel.hidden = !open;
    root.classList.toggle('is-open', open);
    launch.setAttribute('aria-expanded', open);
    if (open) { render(); setTimeout(() => input.focus(), 60); track('chat_open'); }
  }
  launch.addEventListener('click', () => setOpen(!state.open));
  $('.skc-close').addEventListener('click', () => { setOpen(false); launch.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) { setOpen(false); launch.focus(); } });

  // ---- asking
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

  async function ask(text) {
    text = (text || '').trim().slice(0, 800);
    if (!text || busy) return;
    if (state.messages.filter((m) => m.role === 'user').length >= MAX_TURNS) {
      note('This chat has reached its limit. Book a demo or tap "Email me" and the team will pick it up from here.');
      scroll(); return;
    }
    busy = true; sendBtn.disabled = true;
    input.value = ''; input.style.height = 'auto';
    const chips = log.querySelector('.skc-chips'); if (chips) chips.remove();
    state.messages.push({ role: 'user', content: text }); save();
    bubble('user', text);
    const out = bubble('assistant', '');
    out.classList.add('skc-typing');
    out.innerHTML = '<i></i><i></i><i></i>';
    scroll();
    track('chat_message');

    let reply = '';
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.messages.slice(-10) }),
      });
      if (!res.ok || !res.body) {
        const err = res.status === 429 ? "You're sending messages quickly. Please wait a minute and try again." : 'The assistant is unavailable right now. You can book a demo or email info@opsknot.com.';
        throw new Error(err);
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      out.classList.remove('skc-typing');
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += dec.decode(value, { stream: true });
        out.innerHTML = linkify(reply);
        scroll();
      }
      if (!reply.trim()) throw new Error('The assistant is unavailable right now. You can book a demo or email info@opsknot.com.');
      state.messages.push({ role: 'assistant', content: reply.trim() });
      if (!state.nudged && !state.leadSent && state.messages.filter((m) => m.role === 'user').length >= 3) { state.nudged = true; nudge(); }
    } catch (err) {
      out.remove();
      state.messages.pop(); // let the visitor try the same question again
      input.value = text;
      note(err && err.message && !/fetch|network/i.test(err.message) ? err.message : 'Could not reach the assistant. Check your connection and try again.');
    }
    save(); scroll();
    busy = false; sendBtn.disabled = false;
  }

  // ---- "Email me"
  leadBtn.addEventListener('click', showLead);
  function showLead() {
    if (state.leadSent || log.querySelector('.skc-lead')) return;
    const f = document.createElement('form');
    f.className = 'skc-lead';
    f.innerHTML = `<p>Leave your email and the SalesKnot team will reply personally, with this chat attached.</p>
<label class="skc-sr" for="skc-l-name">Name</label><input id="skc-l-name" name="name" placeholder="Your name" autocomplete="name">
<label class="skc-sr" for="skc-l-email">Email</label><input id="skc-l-email" name="email" type="email" required placeholder="Work email" autocomplete="email">
<label class="skc-sr" for="skc-l-note">Anything to add</label><input id="skc-l-note" name="note" placeholder="Team size, current CRM… (optional)">
<input class="skc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<div class="skc-lead-row"><button type="submit">Send</button><button type="button" data-cancel>Cancel</button></div><p class="skc-err" role="alert"></p>`;
    f.querySelector('[data-cancel]').addEventListener('click', () => f.remove());
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('[type=submit]'), errEl = f.querySelector('.skc-err');
      btn.disabled = true; btn.textContent = 'Sending…'; errEl.textContent = '';
      const d = Object.fromEntries(new FormData(f));
      const transcript = state.messages.map((m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`).join('\n');
      try {
        const res = await fetch(LEAD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...d, transcript, page: location.href }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Could not send. Please email info@opsknot.com.');
        state.leadSent = true; save(); track('chat_lead');
        render();
      } catch (err) {
        errEl.textContent = err.message && !/fetch|network/i.test(err.message) ? err.message : 'Could not send. Please email info@opsknot.com.';
        btn.disabled = false; btn.textContent = 'Send';
      }
    });
    log.appendChild(f);
    scroll();
    f.querySelector('[name=email]').focus();
  }

  if (state.open) setOpen(true);
})();
