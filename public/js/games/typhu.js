// Giao diện Cờ Tỷ Phú — bàn 9x9 (32 ô)
(function () {
  // vị trí ô i trên lưới 9x9 (hàng, cột) bắt đầu từ góc dưới-phải, đi ngược chiều kim đồng hồ
  function gridPos(i) {
    if (i <= 8) return [9, 9 - i];
    if (i <= 16) return [9 - (i - 8), 1];
    if (i <= 24) return [1, 1 + (i - 16)];
    return [1 + (i - 24), 9];
  }
  const ICONS = {
    start: '🏁', jail: '🚔', free: '🎉', gotojail: '👮', chance: '❓', luck: '🍀', tax: '💸',
  };
  function iconFor(sq) {
    if (ICONS[sq.type]) return ICONS[sq.type];
    if (sq.type === 'station') return /Sân Bay/.test(sq.name) ? '✈️' : /Cảng/.test(sq.name) ? '⚓' : /Ga/.test(sq.name) ? '🚆' : '🚌';
    if (sq.type === 'utility') return /Điện/.test(sq.name) ? '⚡' : '💧';
    return '';
  }
  const housesHTML = (n) => (n === 5 ? '<span class="hotel">🏨</span>' : n ? `<span class="houses">${'■'.repeat(n)}</span>` : '');

  let openPos = null;
  let lastRollId = null;
  let lastCtx = null;
  let prevPos = null; // { playerId: {pos, inJail} }
  let prevOwned = null;
  let lastPhase = null;
  const STEP_MS = 130;

  function ensureModal() {
    let m = document.getElementById('tp-deed-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'tp-deed-modal';
      m.className = 'modal hidden';
      m.innerHTML = '<div class="modal-box small deed" id="tp-deed-box"></div>';
      document.body.appendChild(m);
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('[data-close]')) { openPos = null; m.classList.add('hidden'); }
        const b = e.target.closest('[data-deed]');
        if (b && lastCtx) lastCtx.act({ type: b.dataset.deed, pos: openPos });
      });
    }
    return m;
  }

  function renderDeed(s, ctx) {
    const m = ensureModal();
    if (openPos === null || !document.body.contains(document.getElementById('tp-board'))) { m.classList.add('hidden'); return; }
    const sq = s.board[openPos];
    const owner = s.players.find((p) => p.id === sq.owner);
    const mine = sq.owner === ctx.me;
    const myTurn = s.turn === ctx.me;
    const color = sq.groupColor || (sq.type === 'station' ? '#555' : sq.type === 'utility' ? '#4a7c8c' : '#1f3b2d');
    let body = '';
    if (sq.type === 'property') {
      const labels = ['Tiền thuê đất trống', 'Với 1 nhà', 'Với 2 nhà', 'Với 3 nhà', 'Với 4 nhà', 'Với khách sạn'];
      body = `<table>
        ${sq.rents.map((r, k) => `<tr class="${owner && !sq.mortgaged && sq.houses === k ? 'cur' : ''}"><td>${labels[k]}</td><td>${UI.money(r)}</td></tr>`).join('')}
        <tr><td colspan="2" class="muted" style="text-align:left;font-weight:400">Sở hữu cả nhóm ${UI.esc(sq.groupName)}: tiền thuê đất trống ×2</td></tr>
        <tr><td>Giá mua</td><td>${UI.money(sq.price)}</td></tr>
        <tr><td>Giá xây mỗi nhà</td><td>${UI.money(sq.houseCost)}</td></tr>
        <tr><td>Cầm cố được</td><td>${UI.money(sq.price / 2)}</td></tr></table>`;
    } else if (sq.type === 'station') {
      body = `<table><tr><td>Sở hữu 1 bến</td><td>25</td></tr><tr><td>2 bến</td><td>50</td></tr><tr><td>3 bến</td><td>100</td></tr><tr><td>4 bến</td><td>200</td></tr>
        <tr><td>Giá mua</td><td>${sq.price}</td></tr><tr><td>Cầm cố được</td><td>${sq.price / 2}</td></tr></table>`;
    } else if (sq.type === 'utility') {
      body = `<table><tr><td>Có 1 công ty</td><td>4 × tổng xúc xắc</td></tr><tr><td>Có cả 2 công ty</td><td>10 × tổng xúc xắc</td></tr>
        <tr><td>Giá mua</td><td>${sq.price}</td></tr><tr><td>Cầm cố được</td><td>${sq.price / 2}</td></tr></table>`;
    } else {
      const desc = {
        start: 'Mỗi lần đi qua hoặc dừng ở đây được nhận 200.',
        jail: 'Đi ngang qua chỉ là "thăm tù". Người bị bắt vào tù sẽ đứng ở đây.',
        free: 'Ô nghỉ chân — không có gì xảy ra.',
        gotojail: 'Dừng ở đây phải vào tù ngay, không được nhận 200.',
        chance: 'Rút một thẻ Cơ Hội và làm theo.',
        luck: 'Rút một thẻ Vận May và làm theo.',
        tax: `Nộp ${sq.amount} cho ngân hàng.`,
      };
      body = `<p>${desc[sq.type] || ''}</p>`;
    }
    const buyable = ['property', 'station', 'utility'].includes(sq.type);
    const actions = mine ? `<div class="deed-actions">
        ${sq.type === 'property' && !sq.mortgaged && sq.houses < 5 ? `<button class="btn btn-secondary btn-small" data-deed="build" ${myTurn ? '' : 'disabled'}>🔨 Xây nhà (${sq.houseCost})</button>` : ''}
        ${sq.houses > 0 ? `<button class="btn btn-ghost btn-small" data-deed="sell_house">Bán 1 nhà (+${sq.houseCost / 2})</button>` : ''}
        ${!sq.mortgaged && !sq.houses ? `<button class="btn btn-ghost btn-small" data-deed="mortgage">Cầm cố (+${sq.price / 2})</button>` : ''}
        ${sq.mortgaged ? `<button class="btn btn-gold btn-small" data-deed="unmortgage">Chuộc lại (-${Math.ceil(sq.price / 2 * 1.1)})</button>` : ''}
      </div>${!myTurn ? '<p class="muted" style="font-size:12px">Chỉ được xây nhà trong lượt của bạn. Bán nhà / cầm cố làm được bất cứ lúc nào.</p>' : ''}` : '';
    document.getElementById('tp-deed-box').innerHTML = `
      <div class="deed-head" style="background:${color}">${iconFor(sq)} ${UI.esc(sq.name)}</div>
      ${buyable ? `<p style="margin:8px 0 0"><b>Chủ sở hữu:</b> ${owner ? UI.esc(owner.name) + (sq.mortgaged ? ' (đang cầm cố)' : '') : 'Chưa có ai'}${sq.houses ? ' · ' + (sq.houses === 5 ? '1 khách sạn' : sq.houses + ' nhà') : ''}</p>` : ''}
      ${body}${actions}
      <button class="btn btn-ghost" data-close style="margin-top:10px">Đóng</button>`;
    m.classList.remove('hidden');
  }

  function render(root, s, ctx) {
    lastCtx = ctx;
    const rolled = lastRollId !== null && s.rollId !== lastRollId;
    // Quân cờ nào di chuyển → tính đường đi
    const walks = [];
    if (prevPos) {
      s.players.forEach((p) => {
        const b = prevPos[p.id];
        if (!b || b.pos === p.pos || p.bankrupt) return;
        if (p.inJail && !b.inJail) return; // vào tù: trượt thẳng
        const fwd = (p.pos - b.pos + 32) % 32;
        const path = [];
        if (fwd <= 32 - 4) for (let k = 0; k <= fwd; k++) path.push((b.pos + k) % 32);
        else for (let k = 0; k <= 32 - fwd; k++) path.push((b.pos - k + 32) % 32);
        walks.push({ id: p.id, path });
      });
    }
    if (rolled) UI.sfx('dice');
    const owned = s.board.map((q) => q.owner || '').join(',');
    if (prevOwned !== null && owned !== prevOwned && s.board.some((q, i) => q.owner && prevOwned.split(',')[i] === '')) setTimeout(() => UI.sfx('buy'), 100);
    if (lastPhase && lastPhase !== 'ended' && s.phase === 'ended') UI.sfx('win');
    prevOwned = owned;
    lastPhase = s.phase;
    const me = s.players.find((p) => p.id === ctx.me);
    const cur = s.players.find((p) => p.id === s.turn);
    const myTurn = s.turn === ctx.me && s.phase !== 'ended';
    const tokenOf = Object.fromEntries(s.players.map((p) => [p.id, p.token]));

    const squares = s.board.map((sq, i) => {
      const [r, c] = gridPos(i);
      const corner = i % 8 === 0;
      const tokens = s.players.filter((p) => !p.bankrupt && p.pos === i)
        .map((p) => `<span class="token t${p.token} ${p.id === s.turn ? 'turn' : ''}" title="${UI.esc(p.name)}" data-key="tok-${p.id}" data-flip="tok-${p.id}">${UI.esc(p.name[0].toUpperCase())}</span>`).join('');
      const ownerBar = sq.owner ? `<div class="owner-bar t${tokenOf[sq.owner]}" data-key="ob-${sq.owner}"></div>` : '';
      const inner = corner
        ? `<span class="ic">${iconFor(sq)}</span><span>${UI.esc(sq.name)}</span>`
        : `${sq.groupColor ? `<div class="band" style="background:${sq.groupColor}">${housesHTML(sq.houses)}</div>` : ''}
           <span class="nm">${sq.groupColor ? '' : `<span class="ic">${iconFor(sq)}</span>`}${sq.groupColor ? UI.esc(sq.name) : ''}</span>
           ${sq.price ? `<span class="pr">${sq.price}</span>` : sq.amount ? `<span class="pr">-${sq.amount}</span>` : ''}`;
      return `<div class="tp-sq ${corner ? 'corner' : ''} ${sq.mortgaged ? 'mortgaged' : ''}" style="grid-row:${r};grid-column:${c}" data-pos="${i}" data-sq="${i}" data-key="sq${i}" title="${UI.esc(sq.name)}">
        ${inner}${ownerBar}<div class="tp-tokens">${tokens}</div></div>`;
    }).join('');

    // Thông điệp & nút ở giữa bàn
    const dice = `<div class="tp-dice" data-key="dice">${UI.diceHTML(s.dice ? s.dice[0] : 5, 'small', 'd1')}${UI.diceHTML(s.dice ? s.dice[1] : 6, 'small', 'd2')}</div>`;
    let msg = '';
    let acts = '';
    if (s.phase === 'ended') {
      const w = s.players.find((p) => p.id === s.winner);
      msg = `🏆 <b>${UI.esc(w.name)}</b> chiến thắng!`;
      if (s.ranking) msg += '<br>' + s.ranking.map((r, k) => `${k + 1}. ${UI.esc(r.name)} — ${r.bankrupt ? 'phá sản' : UI.money(r.worth)}`).join('<br>');
    } else if (myTurn) {
      const sq = s.board[me.pos];
      if (me.money < 0) {
        msg = `⚠️ Bạn đang thiếu <b>${UI.money(-me.money)}</b>. Chạm vào đất của bạn để bán nhà/cầm cố, hoặc tuyên bố phá sản.`;
        acts = '<button class="btn btn-danger" data-act="bankrupt">💀 Phá sản</button>';
      } else if (s.phase === 'roll') {
        msg = me.inJail ? `Bạn đang ở tù (đã ở ${me.jailTurns}/3 lượt). Đổ ra đôi để ra tù, hoặc nộp phạt.` : '👉 Tới lượt bạn!';
        acts = `<button class="btn btn-primary" data-act="roll">🎲 Đổ xúc xắc</button>
          ${me.inJail ? `<button class="btn btn-gold" data-act="pay_jail" ${me.money >= s.jailFine ? '' : 'disabled'}>Nộp phạt ${s.jailFine}</button>` : ''}
          ${me.inJail && me.jailCards ? '<button class="btn btn-secondary" data-act="use_card">Dùng thẻ ra tù</button>' : ''}`;
      } else if (s.phase === 'buy') {
        msg = `Bạn có muốn mua <b>${UI.esc(sq.name)}</b> với giá <b>${UI.money(sq.price)}</b>? (Bạn có ${UI.money(me.money)})`;
        acts = `<button class="btn btn-primary" data-act="buy" ${me.money >= sq.price ? '' : 'disabled'}>🏠 Mua</button>
          <button class="btn btn-ghost" data-act="skip_buy">Không mua</button>
          <button class="btn btn-ghost btn-small" data-info="${me.pos}">Xem thông tin</button>`;
      } else if (s.phase === 'end') {
        msg = 'Bạn có thể chạm vào đất của mình để xây nhà, rồi kết thúc lượt.';
        acts = '<button class="btn btn-primary" data-act="end_turn">✅ Kết thúc lượt</button>';
      }
    } else if (me && me.money < 0 && !me.bankrupt) {
      msg = `⚠️ Bạn đang thiếu <b>${UI.money(-me.money)}</b>. Bán nhà/cầm cố đất hoặc phá sản.`;
      acts = '<button class="btn btn-danger" data-act="bankrupt">💀 Phá sản</button>';
    } else if (cur) {
      msg = `Đang chờ <b>${UI.esc(cur.name)}</b>${s.phase === 'buy' ? ' quyết định mua đất' : s.phase === 'end' ? ' kết thúc lượt' : ' đổ xúc xắc'}…`;
    }
    const cardHTML = s.card ? `<div class="tp-card" data-key="card-${s.card.id}-${UI.esc(s.card.text).length}"><b>${UI.esc(s.card.kind)}</b> — ${UI.esc(s.card.player)}: ${UI.esc(s.card.text)}</div>` : '';

    const side = s.players.map((p) => {
      const props = s.board.map((sq, i) => ({ sq, i })).filter((x) => x.sq.owner === p.id);
      return `<div class="tp-player ${p.id === s.turn ? 'turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}" data-key="pl-${p.id}">
        <div class="row1">
          <span class="token t${p.token}">${UI.esc(p.name[0].toUpperCase())}</span>
          <b>${UI.esc(p.name)}${p.id === ctx.me ? ' (bạn)' : ''}</b>
          ${p.inJail ? '<span class="mini-tag red">🚔 Trong tù</span>' : ''}
          ${p.jailCards ? `<span class="mini-tag">🎫×${p.jailCards}</span>` : ''}
          <span class="money ${p.money < 0 ? 'neg' : ''}" data-bump="${p.money}">${UI.money(p.money)}</span>
        </div>
        <div class="tp-props">${props.map((x) => `<span class="tp-prop-chip ${x.sq.mortgaged ? 'mort' : ''}" style="background:${x.sq.groupColor || '#555'}" data-info="${x.i}">${UI.esc(x.sq.name)}${x.sq.houses ? ' ' + (x.sq.houses === 5 ? '🏨' : x.sq.houses + '🏠') : ''}</span>`).join('')}</div>
        <div style="font-size:12px;opacity:.75;margin-top:4px">Tổng tài sản: ${UI.money(p.worth)}</div>
      </div>`;
    }).join('');

    UI.render(root, `
      <div class="tp-layout">
        <div class="tp-board" id="tp-board">
          ${squares}
          <div class="tp-center">
            <h2>CỜ TỶ PHÚ</h2>
            ${dice}
            <div class="tp-msg">${msg}</div>
            <div class="tp-actions">${acts}</div>
            ${cardHTML}
          </div>
        </div>
        <div class="tp-side">
          ${side}
          ${ctx.isHost() && s.phase !== 'ended' ? '<button class="btn btn-ghost btn-small" data-act="end_game">⏱ Hết giờ: kết thúc & tính tài sản</button>' : ''}
          ${UI.logHTML(s.log)}
        </div>
      </div>`);

    // Xúc xắc lăn + quân cờ đi từng ô
    const d1 = root.querySelector('[data-key="d1"]');
    const d2 = root.querySelector('[data-key="d2"]');
    let delay = 0;
    if (rolled && s.dice) {
      [d1, d2].forEach((d, k) => {
        d.dataset.rolling = '1';
        UI.tumble(d, s.dice[k], 600 + k * 80);
        setTimeout(() => { delete d.dataset.rolling; d.dataset.shown = String(s.dice[k]); }, 760);
      });
      delay = 700;
    } else UI.syncDice(root);
    walks.forEach((w) => {
      const tok = root.querySelector(`[data-key="tok-${w.id}"]`);
      const pts = w.path.map((i) => root.querySelector(`[data-sq="${i}"]`)).filter(Boolean).map(UI.center);
      if (tok && pts.length >= 2) {
        const step = Math.min(STEP_MS, 2200 / pts.length);
        UI.walk(tok, pts, { stepMs: step, delay });
        for (let k = 1; k < pts.length; k++) setTimeout(() => UI.sfx('step'), delay + k * step);
      }
    });
    lastRollId = s.rollId;
    prevPos = Object.fromEntries(s.players.map((p) => [p.id, { pos: p.pos, inJail: p.inJail }]));

    root.querySelectorAll('[data-pos]').forEach((el) => (el.onclick = () => { openPos = Number(el.dataset.pos); renderDeed(s, ctx); }));
    root.querySelectorAll('[data-info]').forEach((el) => (el.onclick = () => { openPos = Number(el.dataset.info); renderDeed(s, ctx); }));
    root.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      const t = b.dataset.act;
      if (t === 'bankrupt' && !confirm('Tuyên bố phá sản? Bạn sẽ bị loại khỏi ván.')) return;
      if (t === 'end_game' && !confirm('Kết thúc ván ngay và xếp hạng theo tổng tài sản?')) return;
      b.disabled = true;
      ctx.act({ type: t });
    }));
    renderDeed(s, ctx);
  }

  window.GameViews.typhu = { render };
})();
