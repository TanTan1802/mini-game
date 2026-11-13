// Giao diện Tiến Lên Miền Nam — bàn oval, người ngồi quanh bàn, bài xòe hình quạt
(function () {
  let selected = new Set();
  let lastHandKey = '';
  let prev = null; // trạng thái lần vẽ trước để tạo hiệu ứng
  let pileOld = null; // bộ bài bị chặn ngay trước bộ hiện tại

  function render(root, s, ctx) {
    const me = s.players.find((p) => p.id === ctx.me);
    const myTurn = s.turn === ctx.me && s.phase === 'playing';
    const handKey = s.myHand.join(',');
    if (handKey !== lastHandKey) {
      selected = new Set([...selected].filter((c) => s.myHand.includes(c)));
      lastHandKey = handKey;
    }
    const playKey = s.lastPlay ? s.lastPlay.by + s.lastPlay.cards.join('') : '';
    const newGame = prev && s.gameNo !== prev.gameNo;
    const newPlay = prev && playKey && playKey !== prev.playKey && !newGame;
    if (newGame || !s.lastPlay) pileOld = null;
    else if (newPlay && prev.lastPlay) pileOld = prev.lastPlay;

    // ---- Ghế quanh bàn (mình luôn ở dưới) ----
    const n = s.players.length;
    const myIdx = Math.max(0, s.players.findIndex((p) => p.id === ctx.me));
    const seats = s.players.map((p, i) => {
      const k = (i - myIdx + n) % n;
      const pos = UI.seatPos(k, n);
      const isMe = p.id === ctx.me;
      const turn = s.turn === p.id && s.phase === 'playing';
      let cards = '';
      if (s.phase === 'ended' && p.hand && p.hand.length && !isMe) {
        cards = `<div class="seat-cards reveal">${p.hand.map((c) => UI.card(c, { small: true })).join('')}</div>`;
      } else if (!isMe && p.count) {
        cards = `<div class="seat-cards fan">${Array.from({ length: Math.min(p.count, 5) }, (_, j) => UI.card(null, { back: true, small: true, key: `b${j}` })).join('')}</div>`;
      }
      const badges = [];
      if (p.place) badges.push(`<span class="stamp gold">${p.place === 1 ? 'Nhất' : 'Hạng ' + p.place}</span>`);
      else if (p.passed) badges.push('<span class="stamp red">Bỏ lượt</span>');
      if (p.count === 1 && !p.finished) badges.push('<span class="mini-tag red blink">Báo 1 lá!</span>');
      return `<div class="seat ${isMe ? 'me' : ''} ${turn ? 'turn' : ''} ${p.finished ? 'done' : ''}" style="left:${pos.x}%;top:${pos.y}%"
          data-key="seat-${p.id}" data-anchor="seat-${p.id}">
        <div class="seat-av">${ctx.avatar(p.id, 58)}${!isMe && !p.finished ? `<span class="count-badge" data-bump="${p.count}">${p.count}</span>` : ''}</div>
        <div class="seat-plate"><span class="seat-name">${UI.esc(p.name)}${isMe ? ' (bạn)' : ''}</span>
          <span class="seat-sub" data-bump="${p.score}">${p.score >= 0 ? '+' : ''}${p.score} điểm</span></div>
        ${cards}
        <div class="seat-badges">${badges.join('')}</div>
      </div>`;
    }).join('');

    // ---- Giữa bàn: chồng bài ----
    const turnPlayer = s.players.find((p) => p.id === s.turn);
    let pile;
    if (s.lastPlay) {
      const fromOther = s.lastPlay.by !== ctx.me;
      pile = `<div class="pile" data-key="pile">
        ${pileOld ? `<div class="pile-old" data-key="old-${pileOld.cards.join('')}" style="transform:rotate(-9deg) translate(-14px,-8px)">${pileOld.cards.map((c) => UI.card(c)).join('')}</div>` : ''}
        <div class="pile-label" data-key="lbl-${playKey}">${UI.esc(s.lastPlay.byName)} · <b>${UI.esc(s.lastPlay.label)}</b></div>
        <div class="pile-cur" data-key="cur-${playKey}">${s.lastPlay.cards.map((c, k) => UI.card(c, {
          key: 't-' + c, flip: 'c-' + c, from: fromOther ? 'seat-' + s.lastPlay.by : null, arc: (k - s.lastPlay.cards.length / 2) * 9, delay: k * 45,
        })).join('')}</div>
      </div>`;
    } else {
      pile = `<div class="pile" data-key="pile-empty"><div class="pile-empty">${s.phase === 'playing' && turnPlayer
        ? `♠ Bàn trống ♥<br><small>${UI.esc(turnPlayer.name)} được đánh tự do</small>` : '♠ ♥ ♦ ♣'}</div></div>`;
    }

    let status;
    if (s.phase === 'ended') status = '🏁 Ván đã kết thúc';
    else if (myTurn) status = s.lastPlay ? '👉 Tới lượt bạn — chặn hoặc bỏ lượt' : '👉 Tới lượt bạn — đánh tự do';
    else status = `⏳ Chờ ${UI.esc(turnPlayer ? turnPlayer.name : '')}…`;

    // ---- Bảng của mình ----
    let panel = '';
    if (s.phase === 'ended' && s.result) {
      const rows = s.result.instantWin
        ? `<p>🎉 <b>${UI.esc(s.result.instantWin.player)}</b> TỚI TRẮNG với <b>${UI.esc(s.result.instantWin.why)}</b>!</p>`
        : `<table>${s.result.ranking.map((r) => `<tr><td>${['🥇', '🥈', '🥉', '🐢'][r.place - 1] || r.place}</td><td>${UI.esc(r.name)}</td><td>Hạng ${r.place}</td></tr>`).join('')}</table>`;
      const scores = s.players.slice().sort((a, b) => b.score - a.score)
        .map((p) => `${UI.esc(p.name)} <b>${p.score >= 0 ? '+' : ''}${p.score}</b>`).join(' · ');
      panel = `<div class="result-box" data-key="result-${s.gameNo}"><h3>Kết quả ván ${s.gameNo}</h3>${rows}
        <p class="muted">Tổng điểm: ${scores}</p>
        ${ctx.spectator ? '' : '<button class="btn btn-primary btn-big" data-act="next">🔄 Chia ván mới</button>'}</div>`;
    } else if (me) {
      const nCards = s.myHand.length;
      const W = Math.min(root.clientWidth || 360, 1240) - 30;
      const cw = W < 560 ? 58 : 78;
      const gap = nCards > 1 ? Math.max(16, Math.min(cw * 0.62, (W - cw - 10) / (nCards - 1))) : 0;
      const spread = Math.min(44, nCards * 3.6);
      const fan = s.myHand.map((c, i) => {
        const t = nCards > 1 ? i / (nCards - 1) - 0.5 : 0;
        const x = (i - (nCards - 1) / 2) * gap;
        const style = `--x:${x.toFixed(1)}px;--r:${(t * spread).toFixed(1)}deg;z-index:${i + 1};animation-delay:${newGame || !prev ? i * 55 : 0}ms`;
        return UI.card(c, { clickable: true, selected: selected.has(c), highlight: c === s.requiredCard, key: 'h-' + c, flip: 'c-' + c, style });
      }).join('');
      panel = `
        <div class="mp-head">
          <span class="grow">${UI.esc(me.name)} — <span data-bump="${nCards}">${nCards}</span> lá</span>
          ${me.place ? `<span class="mini-tag gold">Hạng ${me.place}</span>` : ''}
          ${me.passed ? '<span class="mini-tag red">Đã bỏ lượt vòng này</span>' : ''}
        </div>
        <div class="hand-fan" id="tl-hand" data-key="hand-${s.gameNo}">${fan}</div>
        ${s.phase === 'playing' && !me.finished ? `
        <div class="action-bar tl-actions">
          <button class="btn btn-ghost btn-icon" data-act="hint" title="Gợi ý" ${myTurn ? '' : 'disabled'}>💡</button>
          <button class="btn btn-ghost btn-icon" data-act="clear" title="Bỏ chọn" ${selected.size ? '' : 'disabled'}>✕</button>
          <button class="btn btn-danger" data-act="pass" ${myTurn && s.lastPlay ? '' : 'disabled'}>Bỏ lượt</button>
          <button class="btn btn-primary" data-act="play" ${myTurn && selected.size ? '' : 'disabled'}>Đánh${selected.size ? ` (${selected.size})` : ''}</button>
        </div>` : ''}
        ${s.requiredCard && myTurn ? `<p class="hint-line">Lượt đầu: phải đánh kèm lá <b>${UI.cardText(s.requiredCard)}</b> (viền vàng)</p>` : ''}`;
    }

    UI.render(root, `
      <div class="ct-wrap">
        <div class="status-banner ${myTurn ? 'my-turn' : ''}">${status}</div>
        <div class="ct-table tl" id="ct-table">
          <div class="ct-oval"><div class="ct-felt"><div class="ct-logo">Tiến Lên</div></div></div>
          <div class="deck" data-anchor="deck"></div>
          <div class="ct-center">${pile}</div>
          ${seats}
        </div>
        <div class="my-panel ${myTurn ? 'active' : ''}">${panel}</div>
        <details class="log-box"><summary>📜 Diễn biến</summary>${UI.logHTML(s.log)}</details>
      </div>`);

    // ---- Hiệu ứng ----
    const table = root.querySelector('#ct-table');
    if (newGame || (!prev && s.log.length < 4)) {
      UI.sfx('shuffle');
      setTimeout(() => UI.sfx('deal'), 400);
      const deck = root.querySelector('.deck');
      s.players.forEach((p, i) => {
        if (p.id === ctx.me) return;
        const seat = root.querySelector(`[data-anchor="seat-${p.id}"] .seat-av`);
        for (let r = 0; r < 3; r++) {
          FX.fly(UI.card(null, { back: true }), deck, seat, { duration: 420, delay: 120 + (r * n + i) * 70, rotate: 200 + r * 40, scaleTo: 0.5, fadeOut: true });
        }
      });
    }
    if (newPlay) {
      UI.sfx('card');
      const lastLog = s.log[s.log.length - 1] || '';
      if (/CHẶT/.test(lastLog)) {
        setTimeout(() => {
          FX.banner('CHẶT!', { kind: 'red', sub: `${UI.esc(s.lastPlay.byName)} chặt bằng ${UI.esc(s.lastPlay.label)}` });
          FX.shake(table, 12);
          UI.sfx('boom');
        }, 350);
      }
    }
    if (prev) {
      s.players.forEach((p) => {
        const before = prev.places[p.id];
        if (p.place === 1 && !before) {
          setTimeout(() => {
            FX.banner('VỀ NHẤT', { sub: UI.esc(p.name) });
            if (p.id === ctx.me) { FX.confetti(); UI.sfx('fanfare'); } else UI.sfx('win');
          }, 500);
        }
      });
      if (prev.phase === 'playing' && s.phase === 'ended' && s.result && s.result.instantWin) {
        FX.banner('TỚI TRẮNG!', { sub: `${UI.esc(s.result.instantWin.player)} · ${UI.esc(s.result.instantWin.why)}` });
        FX.confetti();
        UI.sfx('fanfare');
      }
    }

    prev = {
      gameNo: s.gameNo, playKey, phase: s.phase, lastPlay: s.lastPlay,
      places: Object.fromEntries(s.players.map((p) => [p.id, p.place])),
    };

    // ---- Thao tác ----
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
        if (res.ok) selected.clear();
        else { UI.sfx('bad'); FX.shake(root.querySelector('#tl-hand'), 6); }
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
