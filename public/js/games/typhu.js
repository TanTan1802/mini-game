// Giao diện Cờ Tỷ Phú — bàn 3D nghiêng, quân cờ là nhân vật của người chơi
(function () {
  // Ô i trên lưới 9x9 (hàng, cột; tính từ 1), bắt đầu từ góc dưới-phải, đi theo chiều kim đồng hồ trên màn hình
  function gridPos(i) {
    if (i <= 8) return [9, 9 - i];
    if (i <= 16) return [9 - (i - 8), 1];
    if (i <= 24) return [1, 1 + (i - 16)];
    return [1 + (i - 24), 9];
  }
  function side(i) {
    if (i % 8 === 0) return 'corner';
    if (i < 8) return 'bottom';
    if (i < 16) return 'left';
    if (i < 24) return 'top';
    return 'right';
  }
  // Toạ độ tâm ô theo % kích thước bàn (cột/hàng góc rộng 1.4, còn lại 1; tổng 9.8)
  const axis = (n) => ((n === 1 ? 0.7 : n === 9 ? 8.4 + 0.7 : 1.4 + (n - 2) + 0.5) / 9.8) * 100;
  function squareCenter(i) {
    const [r, c] = gridPos(i);
    return { x: axis(c), y: axis(r) };
  }

  const ICONS = { start: '🏁', jail: '🚔', free: '🎡', gotojail: '👮', chance: '❓', luck: '🍀', tax: '💸' };
  function iconFor(sq) {
    if (ICONS[sq.type]) return ICONS[sq.type];
    if (sq.type === 'station') return /Sân Bay/.test(sq.name) ? '✈️' : /Cảng/.test(sq.name) ? '🚢' : /Ga/.test(sq.name) ? '🚆' : '🚌';
    if (sq.type === 'utility') return /Điện/.test(sq.name) ? '⚡' : '💧';
    return '';
  }
  const TOKEN_COLORS = ['#e2483d', '#3d7be2', '#2fa36b', '#f0a020', '#8e4fd1', '#1aa6b0'];

  let openPos = null;
  let lastCtx = null;
  let lastRollId = null;
  let prevPos = null;
  let prevMoney = null;
  let prevOwned = null;
  let lastPhase = null;
  let lastCardId = null;
  const STEP_MS = 160;

  // ---------------- Chi tiết ô đất ----------------
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
    if (openPos === null || !document.getElementById('tp-board')) { m.classList.add('hidden'); return; }
    const sq = s.board[openPos];
    const owner = s.players.find((p) => p.id === sq.owner);
    const mine = sq.owner === ctx.me;
    const myTurn = s.turn === ctx.me;
    const color = sq.groupColor || (sq.type === 'station' ? '#4b5563' : sq.type === 'utility' ? '#3f7f8c' : '#1f3b2d');
    let body = '';
    if (sq.type === 'property') {
      const labels = ['Đất trống', '1 nhà', '2 nhà', '3 nhà', '4 nhà', 'Khách sạn'];
      const icons = ['🟩', '🏠', '🏠🏠', '🏠🏠🏠', '🏠🏠🏠🏠', '🏨'];
      body = `<table>
        ${sq.rents.map((r, k) => `<tr class="${owner && !sq.mortgaged && sq.houses === k ? 'cur' : ''}"><td>${icons[k]} ${labels[k]}</td><td>${UI.money(r)}</td></tr>`).join('')}
        <tr><td colspan="2" class="muted note">Sở hữu cả nhóm ${UI.esc(sq.groupName)}: tiền thuê đất trống ×2</td></tr>
        <tr><td>💰 Giá mua</td><td>${UI.money(sq.price)}</td></tr>
        <tr><td>🔨 Giá xây mỗi nhà</td><td>${UI.money(sq.houseCost)}</td></tr>
        <tr><td>🏦 Cầm cố được</td><td>${UI.money(sq.price / 2)}</td></tr></table>`;
    } else if (sq.type === 'station') {
      body = `<table><tr><td>Có 1 bến</td><td>25</td></tr><tr><td>2 bến</td><td>50</td></tr><tr><td>3 bến</td><td>100</td></tr><tr><td>4 bến</td><td>200</td></tr>
        <tr><td>💰 Giá mua</td><td>${sq.price}</td></tr><tr><td>🏦 Cầm cố được</td><td>${sq.price / 2}</td></tr></table>`;
    } else if (sq.type === 'utility') {
      body = `<table><tr><td>Có 1 công ty</td><td>4 × tổng xúc xắc</td></tr><tr><td>Có cả 2 công ty</td><td>10 × tổng xúc xắc</td></tr>
        <tr><td>💰 Giá mua</td><td>${sq.price}</td></tr><tr><td>🏦 Cầm cố được</td><td>${sq.price / 2}</td></tr></table>`;
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
        ${sq.type === 'property' && !sq.mortgaged && sq.houses < 5 ? `<button class="btn btn-secondary btn-small" data-deed="build" ${myTurn ? '' : 'disabled'}>🔨 Xây ${sq.houses === 4 ? 'khách sạn' : 'nhà'} (${sq.houseCost})</button>` : ''}
        ${sq.houses > 0 ? `<button class="btn btn-ghost btn-small" data-deed="sell_house">Bán 1 nhà (+${sq.houseCost / 2})</button>` : ''}
        ${!sq.mortgaged && !sq.houses ? `<button class="btn btn-ghost btn-small" data-deed="mortgage">Cầm cố (+${sq.price / 2})</button>` : ''}
        ${sq.mortgaged ? `<button class="btn btn-gold btn-small" data-deed="unmortgage">Chuộc lại (-${Math.ceil(sq.price / 2 * 1.1)})</button>` : ''}
      </div>${!myTurn ? '<p class="muted note">Chỉ được xây nhà trong lượt của bạn. Bán nhà / cầm cố làm được bất cứ lúc nào.</p>' : ''}` : '';
    document.getElementById('tp-deed-box').innerHTML = `
      <div class="deed-head" style="background:${color}"><span class="deed-icon">${iconFor(sq) || '🏙️'}</span>${UI.esc(sq.name)}</div>
      ${buyable ? `<p class="deed-owner">${owner ? `${ctx.avatar(owner.id, 28)} <b>${UI.esc(owner.name)}</b>${sq.mortgaged ? ' (đang cầm cố)' : ''}${sq.houses ? ' · ' + (sq.houses === 5 ? '🏨 1 khách sạn' : '🏠 ' + sq.houses + ' nhà') : ''}` : '🏷️ Chưa có chủ'}</p>` : ''}
      ${body}${actions}
      <button class="btn btn-ghost" data-close style="margin-top:10px">Đóng</button>`;
    m.classList.remove('hidden');
  }

  // ---------------- Vẽ từng phần ----------------
  function buildingsHTML(sq, tokenOf) {
    if (!sq.owner) return '';
    const col = TOKEN_COLORS[tokenOf[sq.owner] % TOKEN_COLORS.length];
    let inner = `<span class="flag" style="--c:${col}"></span>`;
    if (sq.houses === 5) inner += '<span class="hotel">🏨</span>';
    else for (let k = 0; k < sq.houses; k++) inner += '<span class="house">🏠</span>';
    return `<div class="bld" data-key="bld-${sq.owner}-${sq.houses}">${inner}</div>`;
  }

  function squaresHTML(s, tokenOf) {
    return s.board.map((sq, i) => {
      const [r, c] = gridPos(i);
      const sd = side(i);
      const ownerCol = sq.owner ? TOKEN_COLORS[tokenOf[sq.owner] % TOKEN_COLORS.length] : null;
      let inner;
      if (sd === 'corner') {
        inner = `<span class="stand big">${iconFor(sq)}</span><span class="corner-name">${UI.esc(sq.name)}</span>`;
      } else {
        inner = `${sq.groupColor ? `<div class="band" style="background:${sq.groupColor}"></div>` : ''}
          ${sq.groupColor ? '' : `<span class="stand">${iconFor(sq)}</span>`}
          <span class="nm">${UI.esc(sq.name)}</span>
          ${sq.price ? `<span class="pr">${sq.price}</span>` : sq.amount ? `<span class="pr neg">-${sq.amount}</span>` : ''}
          ${buildingsHTML(sq, tokenOf)}`;
      }
      return `<div class="tp-sq ${sd} ${sq.mortgaged ? 'mortgaged' : ''} ${sq.owner ? 'owned' : ''}" style="grid-row:${r};grid-column:${c};${ownerCol ? `--own:${ownerCol}` : ''}"
        data-pos="${i}" data-sq="${i}" data-key="sq${i}" title="${UI.esc(sq.name)}">${inner}</div>`;
    }).join('');
  }

  function pawnsHTML(s, ctx) {
    const alive = s.players.filter((p) => !p.bankrupt);
    return alive.map((p) => {
      const same = alive.filter((q) => q.pos === p.pos);
      const k = same.indexOf(p);
      const c = squareCenter(p.pos);
      const off = (k - (same.length - 1) / 2) * 3.2;
      const col = TOKEN_COLORS[p.token % TOKEN_COLORS.length];
      return `<div class="pawn ${p.id === s.turn ? 'turn' : ''}" data-key="pawn-${p.id}" data-pawn="${p.id}"
          style="left:${(c.x + off).toFixed(2)}%;top:${(c.y + off * 0.4).toFixed(2)}%;--c:${col}">
        <div class="pawn-shadow"></div>
        <div class="pawn-body"><div class="pawn-head">${ctx.avatar(p.id, 44, col)}</div><div class="pawn-stem"></div>
          ${p.inJail ? '<div class="pawn-bars">🔒</div>' : ''}</div>
      </div>`;
    }).join('');
  }

  function render(root, s, ctx) {
    lastCtx = ctx;
    const me = s.players.find((p) => p.id === ctx.me);
    const cur = s.players.find((p) => p.id === s.turn);
    const myTurn = s.turn === ctx.me && s.phase !== 'ended';
    const tokenOf = Object.fromEntries(s.players.map((p) => [p.id, p.token]));
    const rolled = lastRollId !== null && s.rollId !== lastRollId;

    // ---- âm thanh & sự kiện ----
    if (rolled) UI.sfx('dice');
    const owned = s.board.map((q) => q.owner || '').join(',');
    if (prevOwned !== null && owned !== prevOwned) {
      const old = prevOwned.split(',');
      if (s.board.some((q, i) => q.owner && old[i] === '')) setTimeout(() => UI.sfx('buy'), 120);
    }
    if (lastPhase && lastPhase !== 'ended' && s.phase === 'ended') UI.sfx('win');
    const newCard = s.card && s.card.id + s.card.text !== lastCardId;
    if (newCard && lastCardId !== null) setTimeout(() => UI.sfx('card'), 700);

    // ---- thanh người chơi ----
    const hud = `<div class="tp-hud">
      <div class="tp-turn-no"><small>LƯỢT</small><b data-bump="${s.turnNo || 1}">${s.turnNo || 1}</b></div>
      ${s.players.map((p) => {
        const props = s.board.filter((q) => q.owner === p.id).length;
        const col = TOKEN_COLORS[p.token % TOKEN_COLORS.length];
        return `<div class="tp-pill ${p.id === s.turn ? 'turn' : ''} ${p.bankrupt ? 'bankrupt' : ''}" style="--c:${col}" data-key="pill-${p.id}" data-pill="${p.id}">
          <div class="pill-av">${ctx.avatar(p.id, 46, col)}</div>
          <div class="pill-info">
            <div class="pill-name">${UI.esc(p.name)}${p.id === ctx.me ? ' <span class="you">BẠN</span>' : ''}</div>
            <div class="pill-money ${p.money < 0 ? 'neg' : ''}" data-bump="${p.money}">💰 ${UI.money(p.money)}</div>
            <div class="pill-sub">🏘️ ${props} · ${p.bankrupt ? '💀 Phá sản' : p.inJail ? '🔒 Trong tù' : `Tài sản ${UI.money(p.worth)}`}${p.jailCards ? ' · 🎫' + p.jailCards : ''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;

    // ---- giữa bàn: xúc xắc + thẻ ----
    const cardPopup = s.card ? `<div class="tp-card-pop ${s.card.kind === 'Cơ Hội' ? 'chance' : 'luck'}" data-key="card-${s.card.id}-${UI.esc(s.card.text).length}">
      <div class="cp-kind">${s.card.kind === 'Cơ Hội' ? '❓' : '🍀'} ${UI.esc(s.card.kind)}</div>
      <div class="cp-text">${UI.esc(s.card.text)}</div><div class="cp-who">— ${UI.esc(s.card.player)}</div></div>` : '';
    const overlay = `<div class="tp-overlay">
      <div class="tp-dice" data-key="dice">${UI.diceHTML(s.dice ? s.dice[0] : 5, '', 'd1')}${UI.diceHTML(s.dice ? s.dice[1] : 6, '', 'd2')}</div>
      ${s.dice && s.dice[0] === s.dice[1] ? `<div class="double-badge" data-key="dbl-${s.rollId}">ĐÔI!</div>` : ''}
      ${cardPopup}
    </div>`;

    // ---- khu nút bấm ----
    let msg = '';
    let acts = '';
    if (s.phase === 'ended') {
      const w = s.players.find((p) => p.id === s.winner);
      msg = `🏆 <b>${UI.esc(w.name)}</b> là TỶ PHÚ!`;
      if (s.ranking) msg += '<div class="rank-list">' + s.ranking.map((r, k) => `<span>${['🥇', '🥈', '🥉'][k] || k + 1 + '.'} ${UI.esc(r.name)} — ${r.bankrupt ? 'phá sản' : UI.money(r.worth)}</span>`).join('') + '</div>';
    } else if (me && me.money < 0 && !me.bankrupt) {
      msg = `⚠️ Bạn đang thiếu <b>${UI.money(-me.money)}</b>. Chạm vào đất của bạn để bán nhà / cầm cố, hoặc phá sản.`;
      acts = '<button class="tile danger" data-act="bankrupt"><span class="ti">💀</span>PHÁ SẢN</button>';
    } else if (myTurn) {
      const sq = s.board[me.pos];
      if (s.phase === 'roll') {
        msg = me.inJail ? `🔒 Bạn đang ở tù (${me.jailTurns}/3 lượt). Đổ ra đôi để ra tù, hoặc nộp phạt.` : 'Tới lượt bạn! Đổ xúc xắc nào 🎲';
        acts = `${me.inJail ? `<button class="tile gold" data-act="pay_jail" ${me.money >= s.jailFine ? '' : 'disabled'}><span class="ti">💵</span>NỘP ${s.jailFine}</button>` : ''}
          ${me.inJail && me.jailCards ? '<button class="tile teal" data-act="use_card"><span class="ti">🎫</span>DÙNG THẺ</button>' : ''}
          <button class="tile primary pulse" data-act="roll"><span class="ti">🎲</span>ĐỔ XÚC XẮC</button>`;
      } else if (s.phase === 'buy') {
        msg = `<div class="buy-deed" style="--g:${sq.groupColor || '#4b5563'}"><span class="bd-head">${iconFor(sq) || '🏙️'} ${UI.esc(sq.name)}</span><span>Giá <b>${UI.money(sq.price)}</b> · Bạn có ${UI.money(me.money)}</span></div>`;
        acts = `<button class="tile ghost" data-act="skip_buy"><span class="ti">✋</span>BỎ QUA</button>
          <button class="tile ghost small" data-info="${me.pos}"><span class="ti">ℹ️</span>XEM</button>
          <button class="tile primary pulse" data-act="buy" ${me.money >= sq.price ? '' : 'disabled'}><span class="ti">🏠</span>MUA ĐẤT</button>`;
      } else if (s.phase === 'end') {
        msg = 'Chạm vào đất của bạn trên bàn để xây nhà 🔨, rồi kết thúc lượt.';
        acts = '<button class="tile primary" data-act="end_turn"><span class="ti">✅</span>KẾT THÚC LƯỢT</button>';
      }
    } else if (cur) {
      msg = `Đang chờ <b>${UI.esc(cur.name)}</b>${s.phase === 'buy' ? ' quyết định mua đất' : s.phase === 'end' ? ' kết thúc lượt' : ' đổ xúc xắc'}…`;
    }
    const dock = `<div class="tp-dock ${myTurn ? 'mine' : ''}">
      <div class="dock-msg">${cur ? `<span class="dock-av">${ctx.avatar(cur.id, 52, TOKEN_COLORS[cur.token % TOKEN_COLORS.length])}</span>` : ''}<div class="bubble">${msg}</div></div>
      <div class="dock-acts">${acts}</div>
    </div>`;

    // ---- tài sản của bạn + nhật ký ----
    const myProps = me ? s.board.map((q, i) => ({ q, i })).filter((x) => x.q.owner === me.id) : [];
    const bottom = `<div class="tp-bottom">
      ${me ? `<div class="my-assets"><b>🏘️ Đất của bạn</b>${myProps.length ? myProps.map((x) => `<span class="tp-prop-chip ${x.q.mortgaged ? 'mort' : ''}" style="background:${x.q.groupColor || '#4b5563'}" data-info="${x.i}" data-key="mp${x.i}">${UI.esc(x.q.name)}${x.q.houses ? ' ' + (x.q.houses === 5 ? '🏨' : x.q.houses + '🏠') : ''}</span>`).join('') : '<span class="muted-light">Chưa có — hãy mua đất khi dừng ở ô trống!</span>'}</div>` : ''}
      <details class="log-box"><summary>📜 Diễn biến</summary>${UI.logHTML(s.log)}</details>
      ${ctx.isHost() && s.phase !== 'ended' ? '<button class="btn btn-ghost btn-small" data-act="end_game">⏱ Hết giờ: kết thúc & tính tài sản</button>' : ''}
    </div>`;

    UI.render(root, `
      <div class="tp-wrap">
        ${hud}
        <div class="tp-stage">
          <div class="tp-board3d" id="tp-board">
            ${squaresHTML(s, tokenOf)}
            <div class="tp-center" data-key="center">
              <div class="lake"><span class="pad p1"></span><span class="pad p2"></span><span class="pad p3"></span><span class="stand boat">⛵</span></div>
              <span class="stand tree t1">🌳</span><span class="stand tree t2">🌴</span><span class="stand tree t3">🌳</span><span class="stand tree t4">🌲</span>
              <span class="stand skyline">🏙️</span>
              <div class="logo">CỜ TỶ PHÚ</div>
            </div>
            <div class="tp-pawns">${pawnsHTML(s, ctx)}</div>
          </div>
          ${overlay}
        </div>
        ${dock}
        ${bottom}
      </div>`);

    // ---- animation: xúc xắc, quân cờ, tiền ----
    let delay = 0;
    const d1 = root.querySelector('[data-key="d1"]');
    const d2 = root.querySelector('[data-key="d2"]');
    if (rolled && s.dice) {
      [d1, d2].forEach((d, k) => {
        d.dataset.rolling = '1';
        UI.tumble(d, s.dice[k], 600 + k * 90);
        setTimeout(() => { delete d.dataset.rolling; d.dataset.shown = String(s.dice[k]); }, 760);
      });
      delay = 720;
    } else UI.syncDice(root);

    if (prevPos && !UI.reducedMotion) {
      s.players.forEach((p) => {
        const b = prevPos[p.id];
        if (!b || b.pos === p.pos || p.bankrupt) return;
        const pawn = root.querySelector(`[data-pawn="${p.id}"]`);
        if (!pawn) return;
        const endL = pawn.style.left;
        const endT = pawn.style.top;
        const offL = parseFloat(endL) - squareCenter(p.pos).x;
        const offT = parseFloat(endT) - squareCenter(p.pos).y;
        let path = [];
        if (p.inJail && !b.inJail) path = [b.pos, p.pos];
        else {
          const fwd = (p.pos - b.pos + 32) % 32;
          if (fwd <= 28) for (let k = 0; k <= fwd; k++) path.push((b.pos + k) % 32);
          else for (let k = 0; k <= 32 - fwd; k++) path.push((b.pos - k + 32) % 32);
        }
        const step = Math.min(STEP_MS, 2600 / path.length);
        const frames = path.map((i) => { const c = squareCenter(i); return { left: `${c.x + offL}%`, top: `${c.y + offT}%` }; });
        frames[frames.length - 1] = { left: endL, top: endT };
        pawn.getAnimations().forEach((a) => a.cancel());
        pawn.animate(frames, { duration: step * (path.length - 1), delay, easing: 'linear', fill: 'backwards' });
        const body = pawn.querySelector('.pawn-body');
        body.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }],
          { duration: step, iterations: path.length - 1, delay, composite: 'add', easing: 'ease-out' });
        for (let k = 1; k < path.length; k++) setTimeout(() => UI.sfx('step'), delay + k * step);
      });
    }

    // Tiền tăng / giảm bay lên
    if (prevMoney) {
      s.players.forEach((p) => {
        const diff = p.money - (prevMoney[p.id] ?? p.money);
        if (!diff) return;
        const pill = root.querySelector(`[data-pill="${p.id}"]`);
        if (!pill) return;
        const f = document.createElement('div');
        f.className = 'money-float ' + (diff > 0 ? 'up' : 'down');
        f.textContent = (diff > 0 ? '+' : '') + UI.money(diff);
        pill.appendChild(f);
        setTimeout(() => f.remove(), 1600);
      });
    }

    lastRollId = s.rollId;
    lastPhase = s.phase;
    prevOwned = owned;
    lastCardId = s.card ? s.card.id + s.card.text : (lastCardId === null ? '' : lastCardId);
    prevPos = Object.fromEntries(s.players.map((p) => [p.id, { pos: p.pos, inJail: p.inJail }]));
    prevMoney = Object.fromEntries(s.players.map((p) => [p.id, p.money]));

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
