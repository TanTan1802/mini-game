// Bộ hiệu ứng: xúc xắc 3D, vật bay theo đường cong (chip, xu, lá bài), pháo giấy, banner, rung
(function () {
  const reduced = () => UI.reducedMotion;

  function layer() {
    let l = document.getElementById('fx-layer');
    if (!l) {
      l = document.createElement('div');
      l.id = 'fx-layer';
      document.body.appendChild(l);
    }
    return l;
  }

  function rectOf(x) {
    if (!x) return null;
    if (x.getBoundingClientRect) return x.getBoundingClientRect();
    return x;
  }
  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  /** Cho một phần tử HTML bay từ `from` tới `to` theo đường vòng cung. */
  function fly(html, from, to, o = {}) {
    const a = rectOf(from);
    const b = rectOf(to);
    if (!a || !b || reduced()) { if (o.onEnd) setTimeout(o.onEnd, o.delay || 0); return; }
    const p = centerOf(a);
    const q = centerOf(b);
    const g = document.createElement('div');
    g.className = 'fx-ghost ' + (o.cls || '');
    g.innerHTML = html;
    g.style.left = '0px';
    g.style.top = '0px';
    layer().appendChild(g);
    const arc = o.arc ?? -Math.min(120, Math.hypot(q.x - p.x, q.y - p.y) * 0.25);
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2 + arc;
    const r0 = o.rotateFrom || 0;
    const r1 = o.rotate || 0;
    const s0 = o.scaleFrom ?? 1;
    const s1 = o.scaleTo ?? 1;
    const T = (x, y, r, s) => `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${r}deg) scale(${s})`;
    const anim = g.animate([
      { transform: T(p.x, p.y, r0, s0), opacity: o.fadeIn ? 0 : 1 },
      { transform: T(mx, my, (r0 + r1) / 2, (s0 + s1) / 2 * (o.pop || 1.08)), opacity: 1, offset: 0.5 },
      { transform: T(q.x, q.y, r1, s1), opacity: o.fadeOut ? 0 : 1 },
    ], { duration: o.duration || 600, delay: o.delay || 0, easing: o.easing || 'cubic-bezier(.35,.1,.25,1)', fill: 'both' });
    anim.onfinish = () => { g.remove(); if (o.onEnd) o.onEnd(); };
    return anim;
  }

  // ---------- Chip ----------
  const CHIP_DENOMS = [[500, 'purple'], [100, 'black'], [25, 'green'], [5, 'red'], [1, 'white']];
  function chipStack(amount, max = 7) {
    const chips = [];
    let left = amount;
    for (const [v, c] of CHIP_DENOMS) {
      while (left >= v && chips.length < max) { chips.push(c); left -= v; }
    }
    if (!chips.length && amount > 0) chips.push('white');
    return `<div class="chip-stack">${chips.reverse().map((c, i) => `<span class="chip ${c}" style="--i:${i}"></span>`).join('')}</div>`;
  }
  function chips(from, to, o = {}) {
    const n = o.count || 4;
    const colors = ['red', 'green', 'black', 'purple', 'white'];
    for (let k = 0; k < n; k++) {
      fly(`<span class="chip ${colors[(k + (o.seed || 0)) % colors.length]} solo"></span>`, from, to, {
        duration: 520 + k * 40, delay: (o.delay || 0) + k * 70, arc: -40 - k * 8, rotate: 180 + k * 30, cls: 'chip-ghost',
        onEnd: k === n - 1 ? o.onEnd : null,
      });
    }
    setTimeout(() => UI.sfx('chips'), (o.delay || 0) + 450);
  }
  function coins(from, to, o = {}) {
    const n = o.count || 5;
    for (let k = 0; k < n; k++) {
      fly('<span class="coin">₫</span>', from, to, { duration: 650, delay: (o.delay || 0) + k * 80, arc: -70, rotate: 360, cls: 'coin-ghost' });
    }
    setTimeout(() => UI.sfx('coin'), (o.delay || 0) + 500);
  }

  // ---------- Pháo giấy ----------
  function confetti(o = {}) {
    if (reduced()) return;
    const L = layer();
    const n = o.count || 140;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const ox = o.x ?? W / 2;
    const oy = o.y ?? H * 0.45;
    const colors = o.colors || ['#f6e27a', '#d4a63a', '#fff4c7', '#c0392b', '#e8e1cf', '#2ecc71', '#b88a2a'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'confetto' + (i % 5 === 0 ? ' round' : '');
      p.style.background = colors[i % colors.length];
      L.appendChild(p);
      const ang = Math.random() * Math.PI * 2;
      const sp = 220 + Math.random() * 520;
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp - 420;
      const dur = 1600 + Math.random() * 1400;
      const rot = (Math.random() - 0.5) * 1440;
      const frames = [];
      for (let k = 0; k <= 8; k++) {
        const t = (k / 8) * (dur / 1000);
        const x = ox + vx * t * 0.9;
        const y = oy + vy * t + 900 * t * t;
        frames.push({ transform: `translate(${x}px, ${y}px) rotate(${rot * (k / 8)}deg) rotateY(${k * 120}deg)`, opacity: k > 6 ? 1 - (k - 6) / 2 : 1 });
      }
      p.animate(frames, { duration: dur, easing: 'linear', delay: Math.random() * 120 }).onfinish = () => p.remove();
    }
  }

  // ---------- Banner lớn giữa màn hình ----------
  function banner(text, o = {}) {
    if (!text) return;
    const L = layer();
    const b = document.createElement('div');
    b.className = 'fx-banner ' + (o.kind || 'gold');
    b.innerHTML = `<div class="fb-ribbon"><span class="fb-text">${text}</span>${o.sub ? `<span class="fb-sub">${o.sub}</span>` : ''}</div>`;
    L.appendChild(b);
    const d = o.duration || 1700;
    b.animate([
      { opacity: 0, transform: 'translate(-50%, -50%) scale(.4) rotate(-6deg)' },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1.12) rotate(1deg)', offset: 0.12 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.82 },
      { opacity: 0, transform: 'translate(-50%, -60%) scale(.96)' },
    ], { duration: d, easing: 'ease-out', delay: o.delay || 0, fill: 'both' }).onfinish = () => b.remove();
  }

  function shake(el, strength = 8) {
    if (!el || reduced()) return;
    el.animate([0, 1, 2, 3, 4, 5, 6].map((k) => ({ transform: `translate(${k === 6 ? 0 : (Math.random() - 0.5) * strength * 2}px, ${k === 6 ? 0 : (Math.random() - 0.5) * strength}px)` })), { duration: 420 });
  }

  function sparkle(el, n = 10) {
    const r = rectOf(el);
    if (!r || reduced()) return;
    const L = layer();
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'sparkle';
      L.appendChild(s);
      const x = r.left + Math.random() * r.width;
      const y = r.top + Math.random() * r.height;
      s.animate([
        { transform: `translate(${x}px, ${y}px) scale(0) rotate(0)`, opacity: 1 },
        { transform: `translate(${x}px, ${y - 20}px) scale(1.2) rotate(90deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${x}px, ${y - 34}px) scale(0) rotate(180deg)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 400, delay: Math.random() * 300, fill: 'both' }).onfinish = () => s.remove();
    }
  }

  // ---------- Xúc xắc 3D ----------
  // mặt: trước=1, sau=6, phải=2, trái=5, trên=3, dưới=4
  const ORIENT = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
  function faceHTML(v, cls) {
    return `<div class="die-face ${cls}">${UI.pipsHTML(v)}</div>`;
  }
  /** Xúc xắc 3D. Phần bên trong không bị morph đụng tới; mặt hiện được điều khiển bằng data-value. */
  function diceHTML(value, key, cls = '') {
    return `<div class="die3d-wrap ${cls}" data-key="${key}" data-value="${value || 6}" data-morph-skip>
      <div class="die3d">${faceHTML(1, 'f1')}${faceHTML(6, 'f6')}${faceHTML(2, 'f2')}${faceHTML(5, 'f5')}${faceHTML(3, 'f3')}${faceHTML(4, 'f4')}</div>
      <div class="die-shadow"></div></div>`;
  }
  function setDie(wrap, v) {
    const cube = wrap.querySelector('.die3d');
    const [rx, ry] = ORIENT[v] || ORIENT[6];
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    wrap.dataset.shown = String(v);
  }
  function rollDie(wrap, v, o = {}) {
    if (!wrap) return;
    const cube = wrap.querySelector('.die3d');
    if (reduced()) return setDie(wrap, v);
    const [rx, ry] = ORIENT[v];
    const sx = 720 + 360 * Math.floor(Math.random() * 2);
    const sy = 720 + 360 * Math.floor(Math.random() * 2);
    const end = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    wrap.dataset.rolling = '1';
    const dur = o.duration || 1100;
    cube.animate([
      { transform: `rotateX(${rx - sx}deg) rotateY(${ry - sy}deg)` },
      { transform: `rotateX(${rx - sx * 0.35}deg) rotateY(${ry - sy * 0.3}deg)`, offset: 0.55 },
      { transform: `rotateX(${rx - 25}deg) rotateY(${ry + 18}deg)`, offset: 0.85 },
      { transform: end },
    ], { duration: dur, delay: o.delay || 0, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards' });
    wrap.animate([
      { transform: 'translate(-34px, -40px) scale(.85)' },
      { transform: 'translate(-20px, 0) scale(1)', offset: 0.35 },
      { transform: 'translate(-8px, -26px) scale(1)', offset: 0.55 },
      { transform: 'translate(0, 0)', offset: 0.75 },
      { transform: 'translate(0, -6px)', offset: 0.87 },
      { transform: 'translate(0, 0)' },
    ], { duration: dur, delay: o.delay || 0, easing: 'ease-out', fill: 'backwards' });
    cube.style.transform = end;
    wrap.dataset.shown = String(v);
    setTimeout(() => { delete wrap.dataset.rolling; }, dur + (o.delay || 0));
  }
  /** Đồng bộ mặt xúc xắc theo data-value (khi không lăn). */
  function syncDice(root) {
    root.querySelectorAll('.die3d-wrap').forEach((w) => {
      if (!w.dataset.rolling && w.dataset.shown !== w.dataset.value) setDie(w, Number(w.dataset.value));
    });
  }

  window.FX = { fly, chips, chipStack, coins, confetti, banner, shake, sparkle, diceHTML, rollDie, setDie, syncDice, centerOf, rectOf };
})();
