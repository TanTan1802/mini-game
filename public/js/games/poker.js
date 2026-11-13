// Giao diện Poker Texas Hold'em — bàn oval, chip cược, pot, chia bài bay
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

    // Ghi lại vị trí chip cược & pot trước khi vẽ lại (để cho chip bay vào pot)
    const oldBets = {};
    root.querySelectorAll('[data-bet]').forEach((el) => { oldBets[el.dataset.bet] = el.getBoundingClientRect(); });

    const n = s.players.length;
    const myIdx = Math.max(0, s.players.findIndex((p) => p.id === ctx.me));
    const center = { x: 50, y: 50 };
    const seatPos = {};
    s.players.forEach((p, i) => { seatPos[p.id] = UI.seatPos((i - myIdx + n) % n, n); });

    const seats = s.players.map((p) => {
      const pos = seatPos[p.id];
      const isMe = p.id === ctx.me;
      let cards = '';
      if (p.hole && !isMe) cards = `<div class="seat-cards reveal">${p.hole.map((c) => UI.card(c, { small: true, highlight: highlight.has(c), key: `h${s.handNo}-${c}` })).join('')}</div>`;
      else if (p.cardCount && !isMe) cards = `<div class="seat-cards">${[0, 1].map((k) => UI.card(null, { back: true, small: true, key: `b${s.handNo}-${k}` })).join('')}</div>`;
      const act = p.allIn && s.phase === 'betting' ? '<span class="stamp red">All-in</span>'
        : p.folded && s.phase === 'betting' && p.cardCount ? '<span class="stamp red">Úp</span>'
          : p.lastAction ? `<span class="mini-tag">${UI.esc(p.lastAction)}</span>` : '';
      return `<div class="seat ${isMe ? 'me' : ''} ${p.id === s.turn ? 'turn' : ''} ${p.folded && s.phase === 'betting' ? 'folded' : ''} ${winners.has(p.name) ? 'winner' : ''}"
          style="left:${pos.x}%;top:${pos.y}%" data-key="seat-${p.id}" data-anchor="seat-${p.id}">
        <div class="seat-av">${ctx.avatar(p.id, 58)}</div>
        <div class="seat-plate"><span class="seat-name">${winners.has(p.name) ? '🏆 ' : ''}${UI.esc(p.name)}</span>
          <span class="seat-sub" data-bump="${p.chips}">💰 ${UI.money(p.chips)}</span></div>
        ${cards}
        <div class="seat-badges">${act}</div>
      </div>`;
    }).join('');

    // Chip cược trước mặt mỗi người
    const bets = s.players.filter((p) => p.bet > 0).map((p) => {
      const at = UI.lerp(seatPos[p.id], center, 0.42);
      const blind = s.street === 'preflop' && (p.sb || p.bb) && /Mù/.test(p.lastAction || '') ? `<span class="blind-tag ${p.bb ? 'bb' : ''}">${p.bb ? 'BB' : 'SB'}</span>` : '';
      return `<div class="bet-spot" style="left:${at.x}%;top:${at.y}%" data-key="bet-${p.id}" data-bet="${p.id}">${FX.chipStack(p.bet)}<b data-bump="${p.bet}">${UI.money(p.bet)}</b>${blind}</div>`;
    }).join('');
    const dealer = s.players.find((p) => p.dealer);
    let dealerBtn = '';
    if (dealer) {
      const d = UI.lerp(seatPos[dealer.id], center, 0.24);
      dealerBtn = `<div class="dealer-btn" style="left:${d.x + 6}%;top:${d.y}%" data-key="dealer">D</div>`;
    }

    const board = [];
    for (let i = 0; i < 5; i++) {
      board.push(s.community[i]
        ? UI.card(s.community[i], { highlight: highlight.has(s.community[i]), key: `cc${s.handNo}-${s.community[i]}`, style: `animation-delay:${i < 3 ? i * 180 : 0}ms` })
        : `<div class="slot" data-key="slot${i}"></div>`);
    }

    let status;
    if (s.phase === 'waiting') status = 'Chờ thêm người có chip để chia bài';
    else if (s.phase === 'handover') status = `Ván ${s.handNo} kết thúc`;
    else if (myTurn) status = '👉 Tới lượt bạn';
    else status = `⏳ Chờ ${UI.esc(turnP ? turnP.name : '')} · ${STREET[s.street]}`;

    // ---- Bảng của mình ----
    let panel = '';
    if (s.result) {
      panel += `<div class="result-box" data-key="res-${s.handNo}" style="width:100%">
        ${s.result.pots.map((pt) => `<p style="margin:4px 0">🏆 <b>${pt.winners.map(UI.esc).join(', ')}</b> thắng ${pt.label ? UI.esc(pt.label) + ' ' : ''}<b>${UI.money(pt.amount)}</b>${pt.hand ? ` với <b>${UI.esc(pt.hand)}</b>` : ''}</p>`).join('')}
        ${s.result.hands ? `<table>${s.result.hands.map((h) => `<tr><td>${UI.esc(h.name)}</td><td>${h.hole.map(UI.cardText).join(' ')}</td><td>${UI.esc(h.hand)}</td></tr>`).join('')}</table>` : ''}
      </div>`;
    }
    if (me) {
      const key = `${s.handNo}-${s.street}-${o ? o.currentBet : ''}`;
      if (o && key !== raiseKey) { raiseKey = key; raiseTo = o.minRaiseTo; }
      if (o) raiseTo = Math.min(Math.max(raiseTo, o.minRaiseTo), o.maxRaiseTo);
      const potBtn = (label, amount) => (o && o.canRaise ? `<button class="btn btn-ghost btn-small" data-set="${Math.min(Math.max(amount, o.minRaiseTo), o.maxRaiseTo)}">${label}</button>` : '');
      const hole = me.hole && me.hole.length
        ? me.hole.map((c, k) => UI.card(c, { highlight: highlight.has(c), key: `my${s.handNo}-${c}`, style: `animation-delay:${450 + k * 160}ms` })).join('')
        : '<span class="muted">Bạn không tham gia ván này</span>';
      panel += `<div class="mp-head"><span class="grow">${s.myBest && s.phase === 'betting' ? `<span class="pk-best">${UI.esc(s.myBest)}</span>` : UI.esc(me.name)}</span>
        <span class="mini-tag gold" data-bump="${me.chips}">💰 ${UI.money(me.chips)}</span></div>
        `;
      let acts = '';
      if (o) {
        acts = `<div class="action-bar">
          <button class="btn btn-danger" data-act="fold">Úp</button>
          ${o.canCheck ? '<button class="btn btn-secondary" data-act="check">Xem</button>' : `<button class="btn btn-secondary" data-act="call">Theo ${UI.money(o.toCall)}</button>`}
          <button class="btn btn-ghost" data-act="allin">All-in</button>
        </div>
        ${o.canRaise && o.maxRaiseTo > o.minRaiseTo ? `
        <div class="pk-raise">
          <div class="row presets">${potBtn('Tối thiểu', o.minRaiseTo)}${potBtn('½ pot', o.currentBet + Math.floor(o.pot / 2))}${potBtn('Pot', o.currentBet + o.pot)}${potBtn('x3', o.currentBet * 3)}</div>
          <div class="row">
            <input type="range" id="pk-range" min="${o.minRaiseTo}" max="${o.maxRaiseTo}" step="${s.blinds[0]}" value="${raiseTo}">
            <input type="number" id="pk-num" min="${o.minRaiseTo}" max="${o.maxRaiseTo}" value="${raiseTo}">
            <button class="btn btn-primary" data-act="raise">${o.currentBet ? 'Tố' : 'Cược'} <span id="pk-raise-lbl">${UI.money(raiseTo)}</span></button>
          </div>
        </div>` : ''}`;
      } else if (s.phase !== 'betting') {
        acts = `<div class="action-bar">
          ${me.chips === 0 ? '<button class="btn btn-secondary" data-act="rebuy">💵 Mua thêm chip</button>' : ''}
          ${ctx.spectator ? '' : '<button class="btn btn-primary" data-act="next">🃏 Chia ván mới</button>'}
        </div>`;
      } else {
        acts = `<p class="wait-note">⏳ Chờ ${UI.esc(turnP ? turnP.name : '')}…</p>`;
      }
      panel += `<div class="pk-row"><div class="hole" data-key="hole-${s.handNo}">${hole}</div><div class="pk-acts">${acts}</div></div>`;
    }

    UI.render(root, `
      <div class="ct-wrap">
        <div class="status-banner ${myTurn ? 'my-turn' : ''}">${status} · Mù ${s.blinds[0]}/${s.blinds[1]}</div>
        <div class="ct-table pk" id="ct-table">
          <div class="ct-oval"><div class="ct-felt"><div class="ct-logo">Texas Hold'em</div></div></div>
          <div class="deck" data-anchor="deck"></div>
          <div class="ct-center">
            <div class="pk-board">${board.join('')}</div>
            <div class="pk-pot" id="pk-pot">${FX.chipStack(potShown, 5)}<small>Pot</small><b data-bump="${potShown}">${UI.money(potShown)}</b></div>
          </div>
          ${bets}${dealerBtn}${seats}
        </div>
        <div class="my-panel ${myTurn ? 'active' : ''}">${panel}</div>
        <details class="log-box"><summary>📜 Diễn biến</summary>${UI.logHTML(s.log)}</details>
      </div>`);

    // ---- Hiệu ứng ----
    const table = root.querySelector('#ct-table');
    const pot = root.querySelector('#pk-pot');
    const seatAv = (id) => root.querySelector(`[data-anchor="seat-${id}"] .seat-av`);
    if (prev) {
      if (s.handNo !== prev.handNo) {
        // Chia bài: 2 vòng, mỗi người 1 lá mỗi vòng
        UI.sfx('shuffle');
        const deck = root.querySelector('.deck');
        const inHand = s.players.filter((p) => p.cardCount);
        for (let r = 0; r < 2; r++) {
          inHand.forEach((p, i) => {
            const target = p.id === ctx.me ? root.querySelector('.hole') : seatAv(p.id);
            FX.fly(UI.card(null, { back: true }), deck, target, { duration: 380, delay: 150 + (r * inHand.length + i) * 90, rotate: 180 + 90 * r, scaleTo: p.id === ctx.me ? 1.2 : 0.55, fadeOut: true });
          });
        }
        setTimeout(() => UI.sfx('deal'), 300);
      } else {
        // Chip cược tăng: chip bay từ người chơi ra bàn
        s.players.forEach((p) => {
          const before = prev.bets[p.id] || 0;
          if (p.bet > before) {
            const spot = root.querySelector(`[data-bet="${p.id}"]`);
            FX.chips(seatAv(p.id), spot, { count: Math.min(5, 2 + Math.floor((p.bet - before) / 50)), seed: p.bet });
          }
          if (p.allIn && !prev.allIn[p.id] && s.phase === 'betting') {
            FX.banner('ALL-IN!', { kind: 'red', sub: UI.esc(p.name), duration: 1300 });
            UI.sfx('boom');
          }
        });
        // Hết vòng cược: gom chip vào pot
        const collected = Object.keys(oldBets).filter((id) => !root.querySelector(`[data-bet="${id}"]`) || s.street !== prev.street);
        if (collected.length && (s.street !== prev.street || s.result)) {
          collected.forEach((id, k) => FX.fly(FX.chipStack(prev.bets[id] || 1, 5), oldBets[id], pot, { duration: 500, delay: k * 60, arc: -20 }));
          setTimeout(() => UI.sfx('chips'), 380);
        }
        if (s.community.length > prev.community) UI.sfx('card');
      }
      // Kết thúc ván: pot bay về người thắng
      if (s.result && !prev.result) {
        const delay = 700;
        s.players.filter((p) => winners.has(p.name)).forEach((p) => {
          FX.chips(pot, seatAv(p.id), { count: 6, delay });
        });
        const iWon = me && winners.has(me.name);
        const top = s.result.pots[0];
        setTimeout(() => {
          if (iWon) {
            FX.banner('THẮNG!', { sub: `+${UI.money(potShown)}${top.hand ? ' · ' + UI.esc(top.hand) : ''}` });
            FX.confetti();
            UI.sfx('fanfare');
          } else {
            FX.banner(`${UI.esc(top.winners.join(', '))} thắng`, { sub: top.hand ? UI.esc(top.hand) : 'Mọi người đã úp bài', duration: 1500 });
            UI.sfx('win');
          }
          s.players.filter((p) => winners.has(p.name)).forEach((p) => FX.sparkle(seatAv(p.id), 14));
        }, delay + 300);
      }
    }
    void table;
    prev = {
      handNo: s.handNo, street: s.street, community: s.community.length, result: !!s.result,
      bets: Object.fromEntries(s.players.map((p) => [p.id, p.bet])),
      allIn: Object.fromEntries(s.players.map((p) => [p.id, p.allIn])),
    };

    // ---- Thao tác ----
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
