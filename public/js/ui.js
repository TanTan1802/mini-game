// Tiện ích giao diện dùng chung
window.GameViews = {};

const UI = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  SUIT_SYMBOL: { S: '♠', C: '♣', D: '♦', H: '♥' },

  /** HTML của một lá bài. card = "10H" … ; opts: {selected, small, back, clickable, highlight} */
  card(card, opts = {}) {
    const cls = ['playing-card'];
    if (opts.small) cls.push('small');
    if (opts.selected) cls.push('selected');
    if (opts.highlight) cls.push('highlight');
    if (opts.clickable) cls.push('clickable');
    const extra = (opts.key ? ` data-key="${opts.key}"` : '') + (opts.flip ? ` data-flip="${opts.flip}"` : '') + (opts.from ? ` data-flip-from="${opts.from}"` : '');
    if (opts.back || !card) return `<div class="${cls.join(' ')} back"${extra}></div>`;
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    const red = suit === 'H' || suit === 'D';
    const sym = UI.SUIT_SYMBOL[suit];
    return `<div class="${cls.join(' ')} ${red ? 'red' : 'black'}" data-card="${card}"${extra}>
      <span class="c-rank">${rank}</span><span class="c-suit">${sym}</span><span class="c-big">${sym}</span>
    </div>`;
  },

  cardText(card) {
    return card.slice(0, -1) + UI.SUIT_SYMBOL[card.slice(-1)];
  },

  /** Chuyển markdown đơn giản (tiêu đề, danh sách, in đậm, bảng) thành HTML. */
  markdown(md) {
    const inline = (s) => UI.esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/_(.+?)_/g, '<i>$1</i>');
    const lines = md.split('\n');
    let html = '';
    let list = null;
    let table = null;
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const closeTable = () => { if (table) { html += '</tbody></table></div>'; table = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\|/.test(line)) {
        closeList();
        const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
        if (!table) { html += '<div class="table-wrap"><table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'; table = true; continue; }
        html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
        continue;
      }
      closeTable();
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) { closeList(); const lv = Math.min(m[1].length + 1, 5); html += `<h${lv}>${inline(m[2])}</h${lv}>`; }
      else if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = line.match(/^>\s?(.*)/))) { closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
      else if (!line.trim()) closeList();
      else { closeList(); html += `<p>${inline(line)}</p>`; }
    }
    closeList();
    closeTable();
    return html;
  },

  toastTimer: null,
  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    clearTimeout(UI.toastTimer);
    UI.toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
  },

  money(n) { return Number(n).toLocaleString('vi-VN'); },

  logHTML(log) {
    return `<div class="game-log">${log.slice().reverse().map((l) => `<div>${UI.esc(l)}</div>`).join('')}</div>`;
  },

  /** Rung nhẹ trên điện thoại khi tới lượt */
  buzz() { try { navigator.vibrate && navigator.vibrate(120); } catch (e) { /* bỏ qua */ } },

  reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  // ================= Cập nhật DOM mượt (morph) =================
  // Thay vì xoá và vẽ lại toàn bộ (gây nháy, mất trạng thái), chỉ sửa những phần thay đổi.
  // Phần tử có data-key được ghép theo khoá; phần tử có data-flip được trượt từ vị trí cũ tới vị trí mới.
  render(root, html) {
    const before = new Map();
    if (!UI.reducedMotion) root.querySelectorAll('[data-flip]').forEach((el) => before.set(el.dataset.flip, UI.layoutRect(el)));
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    UI.morphChildren(root, tpl.content);
    if (UI.reducedMotion) return;
    root.querySelectorAll('[data-flip]').forEach((el) => {
      let from = before.get(el.dataset.flip);
      if (!from && el.dataset.flipFrom) {
        const anchor = root.querySelector(`[data-anchor="${el.dataset.flipFrom}"]`);
        if (anchor) from = UI.layoutRect(anchor);
      }
      if (!from) return;
      const to = UI.layoutRect(el);
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      const sc = from.width && to.width ? from.width / to.width : 1;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: 'translate(0,0) scale(1)' }],
        { duration: 420, delay: Number(el.dataset.flipDelay || 0), easing: 'cubic-bezier(.2,.8,.2,1)', composite: 'add', fill: 'backwards' }
      );
    });
  },

  /** Vị trí bố cục (bỏ qua transform đang áp dụng, để lá bài đang "nhô lên" không bị tính là di chuyển). */
  layoutRect(el) {
    const r = el.getBoundingClientRect();
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return r;
    const m = new DOMMatrixReadOnly(t);
    return { left: r.left - m.m41, top: r.top - m.m42, width: r.width / (m.a || 1), height: r.height / (m.d || 1) };
  },

  nodeKey(n) { return n.nodeType === 1 ? n.getAttribute('data-key') : null; },

  morphChildren(from, to) {
    const toKids = Array.from(to.childNodes);
    // Xoá trước các phần tử có khoá không còn xuất hiện → phần còn lại thẳng hàng, không phải di chuyển (tránh chạy lại animation)
    const toKeys = new Set(toKids.map(UI.nodeKey).filter(Boolean));
    Array.from(from.childNodes).forEach((n) => { const k = UI.nodeKey(n); if (k && !toKeys.has(k)) from.removeChild(n); });
    const keyed = new Map();
    from.childNodes.forEach((n) => { const k = UI.nodeKey(n); if (k) keyed.set(k, n); });
    let i = 0;
    for (const t of toKids) {
      const k = UI.nodeKey(t);
      const cur = from.childNodes[i] || null;
      let match = null;
      if (k) {
        const m = keyed.get(k);
        if (m && m.nodeName === t.nodeName) { match = m; keyed.delete(k); }
      } else if (cur && !UI.nodeKey(cur) && cur.nodeType === t.nodeType && cur.nodeName === t.nodeName) {
        match = cur;
      }
      if (match) {
        if (match !== cur) from.insertBefore(match, cur);
        UI.morphNode(match, t);
      } else {
        from.insertBefore(t, cur);
      }
      i++;
    }
    while (from.childNodes.length > i) from.removeChild(from.lastChild);
  },

  morphNode(a, b) {
    if (a.nodeType === 3 || a.nodeType === 8) {
      if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      return;
    }
    if (a.nodeType !== 1) return;
    const focused = a === document.activeElement;
    for (const { name } of Array.from(a.attributes)) {
      if (b.hasAttribute(name)) continue;
      if (name === 'open' && a.nodeName === 'DETAILS') continue; // giữ trạng thái mở/đóng
      a.removeAttribute(name);
    }
    for (const { name, value } of Array.from(b.attributes)) {
      if (name === 'value' && focused) continue;
      if (a.getAttribute(name) !== value) {
        if (name === 'data-bump' && !UI.reducedMotion) UI.bump(a);
        a.setAttribute(name, value);
      }
    }
    if (a.nodeName === 'INPUT') {
      if (!focused && b.hasAttribute('value') && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value');
      if (a.disabled !== b.hasAttribute('disabled')) a.disabled = b.hasAttribute('disabled');
      return;
    }
    if (a.nodeName === 'BUTTON') a.disabled = b.hasAttribute('disabled');
    if (a.hasAttribute('data-morph-skip')) return;
    UI.morphChildren(a, b);
  },

  /** Hiệu ứng "nảy" khi số liệu (tiền, chip, điểm) thay đổi */
  bump(el) {
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', filter: 'brightness(1.4)' }, { transform: 'scale(1)' }],
      { duration: 450, easing: 'ease-out' });
  },

  /** Cho phần tử đi qua lần lượt các điểm (toạ độ tâm), kết thúc ở vị trí hiện tại. */
  walk(el, points, { stepMs = 140, delay = 0 } = {}) {
    if (UI.reducedMotion || !el || points.length < 2) return 0;
    el.getAnimations().forEach((a) => a.cancel());
    const end = el.getBoundingClientRect();
    const ex = end.left + end.width / 2;
    const ey = end.top + end.height / 2;
    const frames = points.map((p, k) => ({
      transform: `translate(${p.x - ex}px, ${p.y - ey}px)`,
      offset: k / (points.length - 1),
    }));
    frames[frames.length - 1].transform = 'translate(0,0)';
    const dur = stepMs * (points.length - 1);
    el.animate(frames, { duration: dur, delay, easing: 'linear', fill: 'backwards' });
    el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }],
      { duration: stepMs, iterations: points.length - 1, delay, composite: 'add' });
    return dur + delay;
  },

  center(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  // ================= Xúc xắc =================
  PIPS: { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] },
  pipsHTML(v) {
    const pips = UI.PIPS[v] || [];
    let html = '';
    for (let i = 0; i < 9; i++) html += pips.includes(i) ? `<span class="pip ${v === 1 ? 'red' : ''}"></span>` : '<span></span>';
    return html;
  },
  diceHTML(v, cls = '', key = 'dice') {
    return `<div class="dice ${cls}" data-key="${key}" data-morph-skip data-value="${v}">${UI.pipsHTML(v)}</div>`;
  },
  /** Lăn xúc xắc: đổi mặt liên tục rồi dừng ở mặt cuối */
  tumble(el, final, ms = 650) {
    if (!el) return;
    if (UI.reducedMotion) { el.innerHTML = UI.pipsHTML(final); return; }
    let t = 0;
    const iv = setInterval(() => {
      t += 70;
      el.innerHTML = UI.pipsHTML(t >= ms ? final : 1 + Math.floor(Math.random() * 6));
      if (t >= ms) clearInterval(iv);
    }, 70);
    el.animate([
      { transform: 'rotate(0) scale(.7)' }, { transform: 'rotate(200deg) scale(1.15)', offset: .5 },
      { transform: 'rotate(330deg) scale(.95)', offset: .8 }, { transform: 'rotate(360deg) scale(1)' },
    ], { duration: ms, easing: 'ease-out' });
  },
  /** Đồng bộ mặt xúc xắc (vì data-morph-skip nên morph không tự sửa bên trong) */
  syncDice(root) {
    root.querySelectorAll('.dice[data-value]').forEach((d) => {
      if (d.dataset.shown !== d.dataset.value && !d.dataset.rolling) { d.innerHTML = UI.pipsHTML(Number(d.dataset.value)); d.dataset.shown = d.dataset.value; }
    });
  },

  // ================= Âm thanh (tự tổng hợp, không cần file) =================
  audio: null,
  muted: (() => { try { return localStorage.getItem('vct-muted') === '1'; } catch (e) { return false; } })(),
  setMuted(m) { UI.muted = m; try { localStorage.setItem('vct-muted', m ? '1' : '0'); } catch (e) { /* */ } },
  sfx(type) {
    if (UI.muted) return;
    try {
      if (!UI.audio) UI.audio = new (window.AudioContext || window.webkitAudioContext)();
      const ac = UI.audio;
      if (ac.state === 'suspended') ac.resume();
      const now = ac.currentTime;
      const tone = (freq, start, dur, vol = 0.12, wave = 'sine') => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(0, now + start);
        g.gain.linearRampToValueAtTime(vol, now + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        o.connect(g).connect(ac.destination);
        o.start(now + start);
        o.stop(now + start + dur + 0.02);
      };
      const noise = (start, dur, vol = 0.15, freq = 2000) => {
        const len = Math.floor(ac.sampleRate * dur);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
        const src = ac.createBufferSource();
        src.buffer = buf;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        const g = ac.createGain();
        g.gain.value = vol;
        src.connect(f).connect(g).connect(ac.destination);
        src.start(now + start);
      };
      switch (type) {
        case 'card': noise(0, 0.08, 0.35, 3000); break;
        case 'deal': for (let k = 0; k < 4; k++) noise(k * 0.07, 0.06, 0.25, 3200); break;
        case 'dice': for (let k = 0; k < 6; k++) noise(k * 0.08 + Math.random() * 0.03, 0.05, 0.4, 1200 + Math.random() * 800); break;
        case 'step': tone(660, 0, 0.06, 0.05, 'triangle'); break;
        case 'chip': tone(1800, 0, 0.05, 0.06, 'square'); tone(2400, 0.04, 0.05, 0.04, 'square'); break;
        case 'turn': tone(660, 0, 0.15); tone(880, 0.12, 0.25); break;
        case 'kick': tone(220, 0, 0.2, 0.15, 'sawtooth'); tone(140, 0.1, 0.25, 0.12, 'sawtooth'); break;
        case 'buy': tone(523, 0, 0.1); tone(659, 0.08, 0.1); tone(784, 0.16, 0.2); break;
        case 'win': [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.12, 0.35, 0.12, 'triangle')); break;
        case 'bad': tone(300, 0, 0.15, 0.1, 'square'); tone(200, 0.12, 0.25, 0.1, 'square'); break;
        default:
      }
    } catch (e) { /* trình duyệt chặn âm thanh — bỏ qua */ }
  },
};
