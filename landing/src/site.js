(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const y = $('#y'); if (y) y.textContent = new Date().getFullYear();

  // header glass + mobile menu
  const hdr = $('header.top');
  const onScroll = () => hdr.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const burger = $('.burger');
  if (burger) burger.addEventListener('click', () => {
    const open = !hdr.classList.contains('menu-open');
    hdr.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('[data-r]').forEach(el => io.observe(el));

  // cursor glow
  $$('.cell').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  // FAQ
  $$('.q button').forEach(b => b.addEventListener('click', () => {
    const q = b.parentElement, open = !q.classList.contains('open');
    q.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
  }));

  // prices: currency (PKR for visitors from Pakistan) and billing period
  const amts = $$('.amt[data-p]');
  if (amts.length) {
    const st = { bill: 'm', cur: 'usd' };
    let chosen = null;
    try { chosen = localStorage.getItem('sk-cur'); } catch (e) {}
    if (chosen === 'usd' || chosen === 'pkr') st.cur = chosen;
    const fmt = (c, v) => c === 'pkr' ? 'PKR ' + v.toLocaleString('en-US') : '$' + v;
    const render = () => {
      amts.forEach(el => { const p = JSON.parse(el.dataset.p); const b = $('[data-set-bill]') ? st.bill : (el.dataset.bill || 'm'); el.textContent = fmt(st.cur, p[st.cur][b]); });
      $$('.billnote').forEach(n => n.textContent = st.bill === 'y' ? 'billed yearly' : 'billed monthly');
      $$('[data-set-bill]').forEach(b => b.setAttribute('aria-pressed', b.dataset.setBill === st.bill));
      $$('[data-set-cur]').forEach(b => b.setAttribute('aria-pressed', b.dataset.setCur === st.cur));
    };
    $$('[data-set-bill]').forEach(b => b.addEventListener('click', () => { st.bill = b.dataset.setBill; render(); }));
    $$('[data-set-cur]').forEach(b => b.addEventListener('click', () => { st.cur = b.dataset.setCur; try { localStorage.setItem('sk-cur', st.cur); } catch (e) {} render(); }));
    render();
    if (!chosen) fetch('/_geo', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(g => {
      if (g && g.c === 'PK') { st.cur = 'pkr'; render(); }
    }).catch(() => {});
  }

  // home: animated app mock
  const app = $('#app'), stage = $('#stage');
  if (!app) return;
  setTimeout(() => app.classList.add('show'), 500);
  if (!reduce) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, yy = (e.clientY - r.top) / r.height - .5;
      app.style.transform = `rotateX(${(-yy * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
    });
    stage.addEventListener('pointerleave', () => { app.style.transform = ''; });
  }
  const board = $('#board'), mover = $('#mover');
  const toast = $('#toast'), tT = $('#toastT'), tS = $('#toastS');
  const ai = $('#ai'), aiText = $('#aiText');
  const cols = $$('.col', board);
  const toasts = [
    ['Workflow ran', 'Lead assigned · welcome email sent'],
    ['AI agent qualified the lead', 'Budget confirmed · viewing booked'],
    ['Proposal sent', 'Follow-up scheduled for Thursday'],
    ['Deal won 🎉', 'Commission and onboarding tasks created'],
  ];
  const aiLines = [
    'New lead from the website. Budget $420k, wants 2 bedrooms near the harbour. Assigned to Aisha.',
    'Qualified: pre-approved buyer, viewing booked for Saturday 11:00.',
    'Proposal drafted from the listing and sent. Reminder set if no reply in 2 days.',
  ];
  let step = 0, typer;
  const vis = () => cols.filter(c => c.offsetParent !== null);
  function place(i, animate) {
    const vc = vis(); const col = vc[Math.min(i, vc.length - 1)];
    const br = board.getBoundingClientRect(), cr = col.getBoundingClientRect();
    const deals = $$('.deal:not(.mover)', col); const last = deals[deals.length - 1];
    const top = last ? last.getBoundingClientRect().bottom - br.top + 10 : cr.top - br.top + 40;
    mover.style.transition = animate ? 'left 1s cubic-bezier(.16,1,.3,1), top 1s cubic-bezier(.16,1,.3,1), transform .4s, opacity .5s' : 'opacity .5s';
    mover.style.left = (cr.left - br.left + 12) + 'px';
    mover.style.top = top + 'px';
    mover.style.width = (cr.width - 24) + 'px';
  }
  function type(text) {
    clearInterval(typer); aiText.textContent = ''; let k = 0;
    if (reduce) { aiText.textContent = text; return; }
    typer = setInterval(() => { aiText.textContent = text.slice(0, ++k); if (k >= text.length) clearInterval(typer); }, 22);
  }
  function tick() {
    const n = vis().length, i = step % n;
    if (i === 0) { mover.style.opacity = 0; place(0, false); requestAnimationFrame(() => { mover.style.opacity = 1; }); }
    else { mover.style.transform = 'rotate(-2deg) scale(1.04)'; place(i, true); setTimeout(() => mover.style.transform = '', 900); }
    toast.classList.remove('on');
    setTimeout(() => { const t = toasts[i === n - 1 ? 3 : i]; tT.textContent = t[0]; tS.textContent = t[1]; toast.classList.add('on'); }, 700);
    if (i < aiLines.length) { ai.classList.add('on'); type(aiLines[i]); }
    step++;
  }
  setTimeout(() => { tick(); setInterval(tick, 3600); }, 1500);
  addEventListener('resize', () => place(Math.max(0, (step - 1) % vis().length), false));
})();
