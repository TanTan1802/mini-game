// Giao diện Cá Ngựa — bàn 17x17, đường đua 60 ô, mỗi màu 6 ô chuồng
(function () {
  // Toạ độ (hàng, cột) của 60 ô đường đua theo chiều kim đồng hồ
  const TRACK = [];
  for (let c = 0; c <= 6; c++) TRACK.push([7, c]);
  for (let r = 6; r >= 0; r--) TRACK.push([r, 7]);
  TRACK.push([0, 8]);
  for (let r = 0; r <= 6; r++) TRACK.push([r, 9]);
  for (let c = 10; c <= 16; c++) TRACK.push([7, c]);
  TRACK.push([8, 16]);
  for (let c = 16; c >= 10; c--) TRACK.push([9, c]);
  for (let r = 10; r <= 16; r++) TRACK.push([r, 9]);
  TRACK.push([16, 8]);
  for (let r = 16; r >= 10; r--) TRACK.push([r, 7]);
  for (let c = 6; c >= 0; c--) TRACK.push([9, c]);
  TRACK.push([8, 0]);

  const HOME = [(s) => [8, s], (s) => [s, 8], (s) => [8, 16 - s], (s) => [16 - s, 8]];
  const BASE = [[0, 0], [0, 10], [10, 10], [10, 0]];
  const START = [0, 15, 30, 45];
  const GATE = [59, 14, 29, 44];
  const STEP_MS = 150;
  const ROLL_MS = 1100;
  const HORSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M6.5 21.5h11.5v-2.3c0-2.3-1.2-3.8-2.5-5.3-.9-1-1.7-2.4-1.7-4.1 1.6.6 2.7.4 3.6-.4l1.9 1.1 1.2-1.7c-.6-2.8-2.7-5.6-5.9-6.7L13.7.8l-1.4 2.1C9 3.5 6.4 6.3 6.4 10.5c0 2.8 1.4 4.6 2.4 5.9.5.6.8 1.3.8 2H6.5z"/><circle cx="14.6" cy="6.4" r=".9" fill="#222"/></svg>';
  const absPos = (color, rel) => (color * 15 + rel) % 60;

  let lastRollId = null;
  let lastMoveKey = null;
  let prevHorses = null; // { "color-h": horseState }
  let lastPhase = null;

  // Danh sách ô (data-cell) mà ngựa đi qua
  function pathCells(color, from, to) {
    const cells = [];
    if (from >= 0 && from < 60 && to < 60) {
      for (let k = from; k <= to; k++) cells.push('t' + absPos(color, k));
    } else if (from === 59 && to > 100) {
      cells.push('t' + absPos(color, 59));
      for (let st = 1; st <= to - 100; st++) cells.push(`h${color}-${st}`);
    } else if (from > 100 && to > 100) {
      cells.push(`h${color}-${from - 100}`, `h${color}-${to - 100}`);
    }
    return cells;
  }

  function render(root, s, ctx) {
    const myTurn = s.turn === ctx.me && s.phase !== 'ended';
    const movable = new Map(s.movable.map((m) => [m.h, m]));
    const me = s.players.find((p) => p.id === ctx.me);

    // ---- Phân tích thay đổi để tạo animation ----
    const rolled = lastRollId !== null && s.rollId !== lastRollId;
    const lm = s.lastMove;
    const moveKey = lm ? `${lm.player}-${lm.h}-${lm.from}-${lm.to}-${s.rollId}` : '';
    const newMove = lastMoveKey !== null && lm && moveKey !== lastMoveKey;
    let walk = null;
    if (newMove) {
      const mover = s.players.find((p) => p.id === lm.player);
      const cells = pathCells(mover.color, lm.from, lm.to);
      if (cells.length >= 2) walk = { key: `horse-${mover.color}-${lm.h}`, cells, delay: rolled ? ROLL_MS : 0 };
    }
    const walkMs = walk ? walk.delay + STEP_MS * (walk.cells.length - 1) : rolled ? ROLL_MS : 0;
    const kicked = new Set();
    if (prevHorses) {
      s.players.forEach((p) => p.horses.forEach((h, i) => {
        const before = prevHorses[`${p.color}-${i}`];
        if (before && before.state === 'track' && h.state === 'base') kicked.add(`${p.color}-${i}`);
      }));
    }
    if (rolled) UI.sfx('dice');
    if (kicked.size) {
      setTimeout(() => {
        UI.sfx('kick');
        FX.banner('ĐÁ NGỰA!', { kind: 'red', duration: 1200 });
        FX.shake(root.querySelector('#cn-board'), 10);
      }, walkMs);
    }
    if (lastPhase && lastPhase !== 'ended' && s.phase === 'ended') {
      const w = s.players.find((p) => p.id === s.winner);
      setTimeout(() => {
        FX.banner('CHIẾN THẮNG', { sub: `${UI.esc(w.name)} đưa đủ 4 ngựa về chuồng` , duration: 2600 });
        FX.confetti();
        UI.sfx('fanfare');
      }, walkMs + 200);
    }
    if (rolled && s.dice === 6 && s.phase !== 'ended') setTimeout(() => FX.banner('RA 6!', { sub: 'Được đổ thêm lượt', duration: 1100 }), ROLL_MS);

    // ---- Vẽ bàn ----
    const cells = [];
    const at = (r, c, cls, inner, cellId) =>
      cells.push(`<div class="${cls}" style="grid-row:${r + 1};grid-column:${c + 1}" data-key="${cellId}" data-cell="${cellId}">${inner}</div>`);

    const onTrack = {};
    const onHome = {};
    const inBase = { 0: {}, 1: {}, 2: {}, 3: {} };
    s.players.forEach((p) => p.horses.forEach((h, i) => {
      const id = `${p.color}-${i}`;
      const isLast = lm && lm.player === p.id && lm.h === i;
      const canMove = p.id === ctx.me && movable.has(i);
      const delay = kicked.has(id) ? walkMs : walk && walk.key === `horse-${id}` ? 0 : (rolled ? ROLL_MS : 0);
      const el = `<div class="horse c${p.color} ${canMove ? 'movable' : ''} ${isLast ? 'last' : ''}" data-key="horse-${id}" data-flip="horse-${id}" data-flip-delay="${delay}"
        ${canMove ? `data-h="${i}" title="${UI.esc(movable.get(i).label)}"` : ''}>${HORSE_SVG}<small>${i + 1}</small></div>`;
      if (h.state === 'track') onTrack[h.abs] = el;
      else if (h.state === 'home') onHome[`${p.color}-${h.step}`] = el;
      else inBase[p.color][i] = el;
    }));
    const targets = {};
    s.movable.forEach((m) => {
      const key = m.target.state === 'home' ? `h${me.color}-${m.target.step}` : 't' + m.target.abs;
      targets[key] = `<span class="target-mark ${m.kick ? 'kick' : ''}" data-key="tgt">${m.kick ? '💥' : m.h + 1}</span>`;
    });

    const usedColors = new Set(s.players.map((p) => p.color));
    BASE.forEach(([r, c], color) => {
      const used = usedColors.has(color);
      const owner = s.players.find((p) => p.color === color);
      const slots = [0, 1, 2, 3].map((k) => `<div class="slot" data-key="slot${k}">${inBase[color][k] || ''}</div>`).join('');
      cells.push(`<div class="cn-base c${color}${used ? '' : '-soft'} ${owner && owner.id === s.turn ? 'turn' : ''}" data-key="base${color}" style="grid-row:${r + 1}/span 7;grid-column:${c + 1}/span 7">
        ${used ? `<div class="base-name">${UI.esc(owner.name)}</div><div class="base-av">${ctx.avatar(owner.id, 64)}</div>${slots}` : ''}</div>`);
    });
    cells.push('<div class="cn-center" data-key="center" style="grid-row:8/span 3;grid-column:8/span 3"><span>🏆</span></div>');
    TRACK.forEach(([r, c], i) => {
      const sc = START.indexOf(i);
      const gc = GATE.indexOf(i);
      const cls = ['cn-cell', 'track'];
      if (sc >= 0) cls.push('start', `c${sc}-soft`);
      if (gc >= 0) cls.push('gate', `c${gc}-soft`);
      if (targets['t' + i]) cls.push('is-target');
      at(r, c, cls.join(' '), (onTrack[i] || '') + (targets['t' + i] || ''), 't' + i);
    });
    for (let color = 0; color < 4; color++) {
      for (let st = 1; st <= 6; st++) {
        const [r, c] = HOME[color](st);
        const id = `h${color}-${st}`;
        at(r, c, `cn-cell home c${color} ${targets[id] ? 'is-target' : ''}`, onHome[`${color}-${st}`] || targets[id] || `<span data-key="n">${st}</span>`, id);
      }
    }

    const turnP = s.players.find((p) => p.id === s.turn);
    const winner = s.players.find((p) => p.id === s.winner);
    let status;
    if (s.phase === 'ended') status = `🏆 ${UI.esc(winner.name)} chiến thắng!`;
    else if (myTurn) status = s.phase === 'roll' ? '👉 Tới lượt bạn — bấm Đổ xúc xắc' : '👉 Chạm vào con ngựa đang nhún nhảy (số trên bàn là ô sẽ tới)';
    else status = `⏳ Lượt của ${UI.esc(turnP.name)} (${UI.esc(turnP.colorName)})`;

    UI.render(root, `
      <div class="status-banner ${myTurn ? 'my-turn' : ''}">${status}</div>
      <div class="cn-layout">
        <div class="cn-board" id="cn-board">${cells.join('')}</div>
        <div class="cn-side">
          <div class="cn-dice-wrap">
            ${FX.diceHTML(s.dice || 6, 'cn-dice')}
            ${myTurn && s.phase === 'roll' ? '<button class="btn btn-primary btn-big roll-btn" data-act="roll" data-key="roll">🎲 Đổ xúc xắc</button>'
              : `<div data-key="roll-ph" class="roll-ph">${s.phase === 'ended' ? 'Ván đã kết thúc' : myTurn ? 'Chọn ngựa để đi' : `${UI.esc(turnP.name)} đang chơi…`}</div>`}
          </div>
          ${myTurn && s.phase === 'move' ? `<div class="action-bar" data-key="moves">${s.movable.map((m) => `<button class="btn btn-secondary btn-small" data-h="${m.h}">Ngựa ${m.h + 1}: ${UI.esc(m.label)}</button>`).join('')}</div>` : ''}
          <div class="cn-players">
            ${s.players.map((p) => `
              <div class="cn-player ${p.id === s.turn ? 'turn' : ''}" data-key="pl-${p.id}">
                <span class="cn-av c${p.color}">${ctx.avatar(p.id, 34)}</span>
                <b class="grow">${UI.esc(p.name)}${p.id === ctx.me ? ' (bạn)' : ''}</b>
                <span class="mini-tag">${UI.esc(p.colorName)}</span>
                <span class="mini-tag gold" data-bump="${p.homeCount}">🏠 ${p.homeCount}/4</span>
              </div>`).join('')}
          </div>
          ${me ? `<p class="side-note">Bạn là màu <b>${UI.esc(me.colorName)}</b>. Ô ★ là ô xuất quân, ô viền đậm là cửa chuồng.</p>` : ''}
          ${UI.logHTML(s.log)}
        </div>
      </div>
    `);

    // ---- Chạy animation ----
    const dice = root.querySelector('[data-key="cn-dice"]');
    if (rolled && s.dice) FX.rollDie(dice, s.dice, { duration: ROLL_MS });
    else FX.syncDice(root);
    // Ngựa bị đá: xoay vòng khi bay về chuồng
    kicked.forEach((id) => {
      const el = root.querySelector(`[data-key="horse-${id}"]`);
      if (el && !UI.reducedMotion) el.animate([{ transform: 'rotate(0) scale(1.4)' }, { transform: 'rotate(720deg) scale(1)' }], { duration: 600, delay: walkMs, composite: 'add', fill: 'backwards' });
    });

    if (walk) {
      const horse = root.querySelector(`[data-key="${walk.key}"]`);
      const pts = walk.cells.map((id) => root.querySelector(`[data-cell="${id}"]`)).filter(Boolean).map(UI.center);
      if (horse && pts.length >= 2) {
        UI.walk(horse, pts, { stepMs: STEP_MS, delay: walk.delay });
        for (let k = 1; k < pts.length; k++) setTimeout(() => UI.sfx('step'), walk.delay + k * STEP_MS);
      }
    }

    lastRollId = s.rollId;
    lastMoveKey = moveKey;
    lastPhase = s.phase;
    prevHorses = {};
    s.players.forEach((p) => p.horses.forEach((h, i) => { prevHorses[`${p.color}-${i}`] = h; }));

    root.querySelectorAll('[data-h]').forEach((el) => (el.onclick = () => ctx.act({ type: 'move', horse: Number(el.dataset.h) })));
    const rb = root.querySelector('[data-act="roll"]');
    if (rb) rb.onclick = () => { rb.disabled = true; ctx.act({ type: 'roll' }); };
  }

  window.GameViews.cangua = { render };
})();
