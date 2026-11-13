// Giao diện Poker Texas Hold'em
(function () {
  let raiseTo = 0;
  let raiseKey = '';
  let prev = null;
  const STREET = { preflop: 'Trước Flop', flop: 'Flop', turn: 'Turn', river: 'River' };

  function render(root, s, ctx) {
    const me = s.players.find((p) => p.id === ctx.me);
    const o = s.options;
    const myTurn = !!o;
    const turnP = s.players.find((p) => p.id === s.turn);
    const winners = new Set();
    if (s.result) s.result.pots.forEach((pt) => pt.winners.forEach((w) => winners.add(w)));
    const highlight = new Set(s.result && s.result.pots[0] && s.result.pots[0].bestCards ? s.result.pots[0].bestCards : []);
    const potShown = s.result ? s.result.pots.reduce((t, p) => t + p.amount, 0) : s.pot;

    // Âm thanh
    if (prev) {
      if (s.handNo !== prev.handNo) UI.sfx('deal');
      else if (s.community.length > prev.community.length) UI.sfx('card');
      else if (s.pot > prev.pot) UI.sfx('chip');
      if (s.result && !prev.result) {
        const meName = me && me.name;
        UI.sfx(meName && winners.has(meName) ? 'win' : 'chip');
      }
    }
    prev = { handNo: s.handNo, community: s.community, pot: s.pot, result: s.result };

    const seats = s.players.map((p) => `
      <div class="pk-seat ${p.id === s.turn ? 'turn' : ''} ${p.folded && s.phase === 'betting' ? 'folded' : ''} ${p.id === ctx.me ? 'me' : ''} ${winners.has(p.name) ? 'winner' : ''}" data-key="seat-${p.id}" data-anchor="seat-${p.id}">
        <div class="top">
          <span class="name">${winners.has(p.name) ? '🏆 ' : ''}${UI.esc(p.name)}</span>
          <span class="pk-badges">
            ${p.dealer ? '<span class="pk-badge d">D</span>' : ''}
            ${p.sb ? '<span class="pk-badge sb">SB</span>' : ''}
            ${p.bb ? '<span class="pk-badge bb">BB</span>' : ''}
          </span>
        </div>
        <div class="chips">💰 <span data-bump="${p.chips}">${UI.money(p.chips)}</span>${p.rebuys ? ` <small class="muted">(mua thêm ${p.rebuys})</small>` : ''}</div>
        <div class="cards">${
          p.hole ? p.hole.map((c, k) => UI.card(c, { small: true, highlight: highlight.has(c), key: `h${s.handNo}-${k}-${c}` })).join('')
          : p.cardCount ? [0, 1].map((k) => UI.card(null, { back: true, small: true, key: `b${s.handNo}-${k}` })).join('') : ''
        }</div>
        ${p.bet ? `<span class="pk-bet" data-key="bet" data-bump="${p.bet}">🪙 ${UI.money(p.bet)}</span>` : ''}
        <div class="act">${p.allIn ? '🔥 ALL-IN ' : ''}${UI.esc(p.lastAction || '')}${p.chips === 0 && !p.allIn && s.phase !== 'betting' ? 'Hết chip' : ''}</div>
      </div>`).join('');

    const board = [];
    for (let i = 0; i < 5; i++) {
      board.push(s.community[i]
        ? UI.card(s.community[i], { highlight: highlight.has(s.community[i]), key: `cc${s.handNo}-${s.community[i]}` }).replace('<div ', `<div style="animation-delay:${i < 3 ? i * 160 : 0}ms" `)
        : `<div class="slot" data-key="slot${i}"></div>`);
    }

    let status;
    if (s.phase === 'waiting') status = 'Chờ thêm người có chip để chia bài';
    else if (s.phase === 'handover') status = `Ván ${s.handNo} kết thúc`;
    else if (myTurn) status = '👉 Tới lượt bạn';
    else status = `Đang chờ ${UI.esc(turnP ? turnP.name : '')}… · ${STREET[s.street]}`;

    // Kết quả ván
    let resultHTML = '';
    if (s.result) {
      resultHTML = `<div class="result-box" data-key="res-${s.handNo}">
        <h3>Kết quả ván ${s.handNo}</h3>
        ${s.result.pots.map((pt) => `<p>🏆 <b>${pt.winners.map(UI.esc).join(', ')}</b> thắng ${pt.label ? UI.esc(pt.label) + ' ' : ''}<b>${UI.money(pt.amount)}</b>${pt.hand ? ` với <b>${UI.esc(pt.hand)}</b>` : ''}</p>`).join('')}
        ${s.result.hands ? `<table>${s.result.hands.map((h) => `<tr><td>${UI.esc(h.name)}</td><td>${h.hole.map(UI.cardText).join(' ')}</td><td>${UI.esc(h.hand)}</td></tr>`).join('')}</table>` : ''}
      </div>`;
    }

    // Khu vực của mình
    let mine = '';
    if (me) {
      const key = `${s.handNo}-${s.street}-${o ? o.currentBet : ''}`;
      if (o && key !== raiseKey) { raiseKey = key; raiseTo = o.minRaiseTo; }
      if (o) raiseTo = Math.min(Math.max(raiseTo, o.minRaiseTo), o.maxRaiseTo);
      const potBtn = (label, amount) => o && o.canRaise ? `<button class="btn btn-ghost btn-small" data-set="${Math.min(Math.max(amount, o.minRaiseTo), o.maxRaiseTo)}">${label}</button>` : '';
      const actions = o ? `
        <div class="action-bar">
          <button class="btn btn-danger" data-act="fold">Úp bài</button>
          ${o.canCheck
            ? '<button class="btn btn-secondary" data-act="check">Xem (Check)</button>'
            : `<button class="btn btn-secondary" data-act="call">Theo ${UI.money(o.toCall)}</button>`}
          <button class="btn btn-gold" data-act="allin">All-in ${UI.money(o.maxRaiseTo)}</button>
        </div>
        ${o.canRaise && o.maxRaiseTo > o.minRaiseTo ? `
        <div class="pk-raise">
          <div class="row">
            <input type="range" id="pk-range" min="${o.minRaiseTo}" max="${o.maxRaiseTo}" step="${s.blinds[0]}" value="${raiseTo}">
            <input type="number" id="pk-num" min="${o.minRaiseTo}" max="${o.maxRaiseTo}" value="${raiseTo}">
          </div>
          <div class="row">
            ${potBtn('Tối thiểu', o.minRaiseTo)}
            ${potBtn('½ pot', o.currentBet + Math.floor(o.pot / 2))}
            ${potBtn('Pot', o.currentBet + o.pot)}
            ${potBtn('x3', o.currentBet * 3)}
            <button class="btn btn-primary" data-act="raise">${o.currentBet ? 'Tố lên' : 'Cược'} <span id="pk-raise-lbl">${UI.money(raiseTo)}</span></button>
          </div>
        </div>` : ''}` : '';

      const after = s.phase !== 'betting' ? `
        <div class="action-bar">
          ${me.chips === 0 ? '<button class="btn btn-gold" data-act="rebuy">💵 Mua thêm chip</button>' : ''}
          ${ctx.spectator ? '' : '<button class="btn btn-primary" data-act="next">🃏 Chia ván mới</button>'}
        </div>` : '';

      const hole = me.hole && me.hole.length ? me.hole.map((c, k) => UI.card(c, { highlight: highlight.has(c), key: `my${s.handNo}-${c}` }).replace('<div ', `<div style="animation-delay:${k * 120}ms" `)).join('') : '<span class="muted">Bạn không tham gia ván này</span>';
      mine = `<div class="pk-mine">
        <div class="hole">${hole}</div>
        ${s.myBest && s.phase === 'betting' ? `<div class="pk-best">Bài của bạn: ${UI.esc(s.myBest)}</div>` : ''}
        ${actions}${after}
      </div>`;
    }

    UI.render(root, `
      <div class="status-banner ${myTurn ? 'my-turn' : ''}">${status} · Mù ${s.blinds[0]}/${s.blinds[1]}</div>
      <div class="felt pk-table">
        <div class="pk-seats">${seats}</div>
        <div class="pk-pot">🪙 Pot: <span data-bump="${potShown}">${UI.money(potShown)}</span></div>
        <div class="pk-board">${board.join('')}</div>
      </div>
      ${resultHTML}
      ${mine}
      <details class="log-box"><summary>📜 Diễn biến</summary>${UI.logHTML(s.log)}</details>
    `);

    const range = root.querySelector('#pk-range');
    const num = root.querySelector('#pk-num');
    const setRaise = (v) => {
      raiseTo = Math.round(Number(v) || 0);
      if (range) range.value = raiseTo;
      if (num && document.activeElement !== num) num.value = raiseTo;
      const lbl = root.querySelector('#pk-raise-lbl');
      if (lbl) lbl.textContent = UI.money(raiseTo);
    };
    if (range) range.oninput = () => setRaise(range.value);
    if (num) num.oninput = () => setRaise(num.value);
    root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => setRaise(b.dataset.set)));
    root.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      const t = b.dataset.act;
      if (t === 'raise') return ctx.act({ type: 'raise', amount: raiseTo });
      if (t === 'allin' && !confirm('Chắc chắn ALL-IN toàn bộ chip?')) return;
      ctx.act({ type: t });
    }));
  }

  window.GameViews.poker = { render };
})();
