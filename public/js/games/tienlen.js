// Giao diện Tiến Lên Miền Nam
(function () {
  let selected = new Set();
  let lastHandKey = '';
  let lastPlayKey = null;
  let lastGameNo = null;
  let lastPhase = null;

  function render(root, s, ctx) {
    const me = s.players.find((p) => p.id === ctx.me);
    const myTurn = s.turn === ctx.me && s.phase === 'playing';
    const handKey = s.myHand.join(',');
    if (handKey !== lastHandKey) {
      selected = new Set([...selected].filter((c) => s.myHand.includes(c)));
      lastHandKey = handKey;
    }

    // Âm thanh theo sự kiện
    const playKey = s.lastPlay ? s.lastPlay.by + s.lastPlay.cards.join('') : '';
    if (lastGameNo !== null && s.gameNo !== lastGameNo) UI.sfx('deal');
    else if (lastPlayKey !== null && playKey && playKey !== lastPlayKey) UI.sfx('card');
    if (lastPhase === 'playing' && s.phase === 'ended') UI.sfx('win');
    lastPlayKey = playKey;
    lastGameNo = s.gameNo;
    lastPhase = s.phase;

    // Đối thủ xếp theo thứ tự ngồi, bắt đầu từ người sau mình
    const myIdx = s.players.findIndex((p) => p.id === ctx.me);
    const order = s.players.map((_, i) => s.players[(Math.max(myIdx, 0) + i) % s.players.length]);
    const opponents = me ? order.slice(1) : order;

    const oppHTML = opponents.map((p) => `
      <div class="tl-opp ${s.turn === p.id && s.phase === 'playing' ? 'turn' : ''} ${p.finished ? 'done' : ''}" data-key="opp-${p.id}" data-anchor="opp-${p.id}">
        <div class="name"><span class="avatar sm">${UI.esc(p.name[0].toUpperCase())}</span>${UI.esc(p.name)}</div>
        <div class="tl-count">${UI.card(null, { back: true })}<b data-bump="${p.count}">${p.count}</b> lá</div>
        <div class="tags">
          ${p.place ? `<span class="mini-tag gold">${p.place === 1 ? '🥇 Nhất' : 'Hạng ' + p.place}</span>` : ''}
          ${p.passed && !p.finished ? '<span class="mini-tag red">Bỏ lượt</span>' : ''}
          ${p.count === 1 && !p.finished ? '<span class="mini-tag red blink">Báo 1 lá!</span>' : ''}
          <span class="mini-tag" data-bump="${p.score}">${p.score >= 0 ? '+' : ''}${p.score} điểm</span>
        </div>
        ${s.phase === 'ended' && p.hand && p.hand.length ? `<div class="tl-reveal">${p.hand.map((c) => UI.card(c, { small: true })).join('')}</div>` : ''}
      </div>`).join('');

    const turnPlayer = s.players.find((p) => p.id === s.turn);
    let status;
    if (s.phase === 'ended') status = '🏁 Ván đã kết thúc';
    else if (myTurn) status = s.lastPlay ? '👉 Tới lượt bạn — chặn hoặc bỏ lượt' : '👉 Tới lượt bạn — đánh tự do (bạn đang cầm vòng)';
    else status = `⏳ Đang chờ ${UI.esc(turnPlayer ? turnPlayer.name : '')}…`;

    const tableHTML = s.lastPlay
      ? `<div class="play-label" data-key="lbl-${playKey}">${UI.esc(s.lastPlay.byName)} đánh <b>${UI.esc(s.lastPlay.label)}</b></div>
         <div class="card-row tl-played" data-key="row-${playKey}">${s.lastPlay.cards.map((c) => UI.card(c, {
           key: 't-' + c, flip: 'c-' + c, from: s.lastPlay.by === ctx.me ? null : 'opp-' + s.lastPlay.by,
         })).join('')}</div>`
      : `<div class="empty" data-key="empty">🀄 Bàn trống<br><small>${turnPlayer && s.phase === 'playing' ? UI.esc(turnPlayer.name) + ' được đánh bất kỳ bộ nào' : ''}</small></div>`;

    let resultHTML = '';
    if (s.phase === 'ended' && s.result) {
      const rows = s.result.instantWin
        ? `<p>🎉 <b>${UI.esc(s.result.instantWin.player)}</b> TỚI TRẮNG với <b>${UI.esc(s.result.instantWin.why)}</b>!</p>`
        : `<table>${s.result.ranking.map((r) => `<tr><td>${['🥇', '🥈', '🥉', '🐢'][r.place - 1] || r.place}</td><td>${UI.esc(r.name)}</td><td>Hạng ${r.place}</td></tr>`).join('')}</table>`;
      const scores = s.players.slice().sort((a, b) => b.score - a.score)
        .map((p) => `${UI.esc(p.name)}: <b>${p.score >= 0 ? '+' : ''}${p.score}</b>`).join(' · ');
      resultHTML = `<div class="result-box" data-key="result-${s.gameNo}">
        <h3>Kết quả ván ${s.gameNo}</h3>${rows}
        <p class="muted">Tổng điểm: ${scores}</p>
        ${ctx.spectator ? '' : '<button class="btn btn-primary btn-big" data-act="next">🔄 Chia ván mới</button>'}
      </div>`;
    }

    const myHandHTML = me ? `
      <div class="tl-hand-wrap ${myTurn ? 'active' : ''}">
        <div class="tl-me-line">
          <b>${UI.esc(me.name)} (bạn) — <span data-bump="${s.myHand.length}">${s.myHand.length}</span> lá</b>
          <span class="tags">
            ${me.place ? `<span class="mini-tag gold">Hạng ${me.place}</span>` : ''}
            ${me.passed ? '<span class="mini-tag red">Đã bỏ lượt vòng này</span>' : ''}
            <span class="mini-tag" data-bump="${me.score}">${me.score >= 0 ? '+' : ''}${me.score} điểm</span>
          </span>
        </div>
        <div class="tl-hand" id="tl-hand" data-key="hand-${s.gameNo}">
          ${s.myHand.map((c, i) => UI.card(c, {
            clickable: true, selected: selected.has(c), highlight: c === s.requiredCard, key: 'h-' + c, flip: 'c-' + c,
          }).replace('<div ', `<div style="animation-delay:${i * 45}ms" `)).join('')}
        </div>
        ${s.phase === 'playing' && !me.finished ? `
        <div class="action-bar">
          <button class="btn btn-primary" data-act="play" ${myTurn && selected.size ? '' : 'disabled'}>Đánh${selected.size ? ` (${selected.size})` : ''}</button>
          <button class="btn btn-secondary" data-act="pass" ${myTurn && s.lastPlay ? '' : 'disabled'}>Bỏ lượt</button>
          <button class="btn btn-gold" data-act="hint" ${myTurn ? '' : 'disabled'}>💡 Gợi ý</button>
          <button class="btn btn-ghost" data-act="clear" ${selected.size ? '' : 'disabled'}>Bỏ chọn</button>
        </div>` : ''}
        ${s.requiredCard && myTurn ? `<p class="center hint-line">Lượt đầu: phải đánh kèm lá <b>${UI.cardText(s.requiredCard)}</b> (viền vàng)</p>` : ''}
      </div>` : '';

    UI.render(root, `
      <div class="tl-opponents">${oppHTML}</div>
      <div class="status-banner ${myTurn ? 'my-turn' : ''}">${status}</div>
      ${resultHTML || `<div class="felt tl-table">${tableHTML}</div>`}
      ${myHandHTML}
      <details class="log-box"><summary>📜 Diễn biến</summary>${UI.logHTML(s.log)}</details>
    `);

    const hand = root.querySelector('#tl-hand');
    if (hand) hand.onclick = (e) => {
      const el = e.target.closest('[data-card]');
      if (!el) return;
      const c = el.dataset.card;
      if (selected.has(c)) selected.delete(c); else selected.add(c);
      UI.sfx('step');
      render(root, s, ctx);
    };
    root.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
      const act = b.dataset.act;
      if (act === 'play') {
        if (!selected.size) return UI.toast('Chạm vào lá bài để chọn trước nhé.', 'error');
        const res = await ctx.act({ type: 'play', cards: [...selected] });
        if (res.ok) selected.clear(); else UI.sfx('bad');
      } else if (act === 'pass') {
        selected.clear();
        await ctx.act({ type: 'pass' });
      } else if (act === 'hint') {
        const res = await ctx.hint();
        if (res.ok) {
          if (!res.cards) UI.toast('Không có bộ nào chặn được — hãy bỏ lượt.');
          else { selected = new Set(res.cards); render(root, s, ctx); }
        }
      } else if (act === 'clear') {
        selected.clear();
        render(root, s, ctx);
      } else if (act === 'next') {
        selected.clear();
        await ctx.act({ type: 'next' });
      }
    }));
  }

  window.GameViews.tienlen = { render };
})();
