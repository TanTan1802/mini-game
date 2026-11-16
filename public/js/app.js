// Điều khiển chính: kết nối, phòng chờ, chat, chuyển màn hình
(function () {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };

  const GAME_INFO = {
    tienlen: { icon: '🃏', desc: 'Đánh bài miền Nam, 2–4 người' },
    poker: { icon: '♠️', desc: "Texas Hold'em, 2–8 người" },
    cangua: { icon: '🐴', desc: 'Đua ngựa về chuồng, 2–4 người' },
    typhu: { icon: '🏠', desc: 'Mua đất xây nhà, 2–6 người' },
  };
  const GAME_ORDER = ['tienlen', 'poker', 'cangua', 'typhu'];
  const GAME_NAMES = { tienlen: 'Tiến Lên Miền Nam', poker: "Poker Texas Hold'em", cangua: 'Cá Ngựa', typhu: 'Cờ Tỷ Phú' };

  let playerId = store.get('vct-player-id');
  if (!playerId) {
    playerId = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    store.set('vct-player-id', playerId);
  }
  let selectedGame = store.get('vct-game') || 'tienlen';
  let myAvatar;
  try { myAvatar = Avatar.normalize(JSON.parse(store.get('vct-avatar'))); } catch (e) { myAvatar = null; }
  const firstTime = !store.get('vct-avatar');
  if (firstTime) { myAvatar = Avatar.random(); store.set('vct-avatar', JSON.stringify(myAvatar)); }
  let room = null;
  let gameState = null;
  let chat = [];
  let unread = 0;
  let lastTurnWasMe = false;

  $('inp-name').value = store.get('vct-name') || '';
  const params = new URLSearchParams(location.search);
  if (params.get('room')) $('inp-code').value = params.get('room').toUpperCase();

  const socket = Net.socket; // Socket.io (chạy server) hoặc P2P (chạy trên GitHub Pages)
  const P2P = Net.mode === 'p2p';
  // Link mời bạn bè: trang đang mở + ?room=MÃ
  const pageBase = () => location.href.split(/[?#]/)[0].replace(/index\.html$/, '');
  const inviteLink = (code) => (P2P ? `${pageBase()}?room=${code}` : `${window.__lanUrl || location.origin}/?room=${code}`);
  function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || 'Đang kết nối…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  function emit(ev, data) {
    return new Promise((resolve) => {
      socket.emit(ev, data, (res) => {
        if (res && res.error) UI.toast(res.error, 'error');
        resolve(res || {});
      });
    });
  }

  socket.on('connect', () => {
    $('conn-status').classList.add('hidden');
    socket.emit('hello', { playerId, name: $('inp-name').value || store.get('vct-name'), avatar: myAvatar }, (res) => {
      if (!res || !res.room) { room = null; gameState = null; showScreen(); }
    });
  });
  socket.on('disconnect', () => { if (!P2P || room) $('conn-status').classList.remove('hidden'); });
  socket.on('host-gone', () => {
    $('conn-status').classList.add('hidden');
    if (room) UI.toast('Chủ phòng đã đóng phòng hoặc mất kết nối.', 'error');
    room = null; gameState = null;
    closeModals();
    showScreen();
  });

  socket.on('room:state', (r) => {
    const wasPlaying = room && room.playing;
    room = r;
    chat = r.chat || [];
    if (!r.playing) gameState = null;
    if (wasPlaying && !r.playing) closeModals();
    renderChat();
    showScreen();
  });
  socket.on('game:state', (s) => {
    gameState = s;
    const myTurn = s.turn === playerId;
    if (myTurn && !lastTurnWasMe) { UI.buzz(); setTimeout(() => UI.sfx('turn'), 300); }
    lastTurnWasMe = myTurn;
    showScreen();
  });
  socket.on('chat', (m) => {
    chat.push(m);
    if ($('chat').classList.contains('hidden') && !m.system) {
      unread++;
      $('chat-badge').textContent = unread;
      $('chat-badge').classList.remove('hidden');
      UI.toast(`💬 ${m.from}: ${m.text}`);
    }
    renderChat();
  });
  socket.on('room:kicked', () => {
    room = null; gameState = null;
    Net.leave();
    UI.toast('Bạn đã được mời ra khỏi phòng.', 'error');
    showScreen();
  });

  // ---------- Màn hình ----------
  function showScreen() {
    const screen = !room ? 'home' : room.playing && gameState ? 'game' : 'room';
    for (const s of ['home', 'room', 'game']) $('screen-' + s).classList.toggle('hidden', s !== screen);
    document.body.dataset.screen = screen;
    if (screen === 'home') renderHome();
    if (screen === 'room') renderRoom();
    if (screen === 'game') renderGame();
    if (screen !== 'game') $('chat').classList.add('hidden');
  }

  function pickerHTML(current, disabled) {
    return GAME_ORDER.map((id) => `
      <button class="game-option g-${id} ${id === current ? 'active' : ''}" data-game="${id}" ${disabled ? 'disabled' : ''}>
        <span class="go-table"><span class="go-icon">${GAME_INFO[id].icon}</span></span>
        <span class="go-name">${GAME_NAMES[id]}</span>
        <span class="go-desc">${GAME_INFO[id].desc}</span>
      </button>`).join('');
  }

  // ---------- Chơi với máy ----------
  const LEVELS = [
    { id: 'easy', icon: '🟢', name: 'Dễ', tag: 'Làm quen', desc: 'Đi đúng luật, biết chặn bài, đá ngựa, mua đất — nhưng hay liều và không tính xa.' },
    { id: 'medium', icon: '🟡', name: 'Vừa', tag: 'Thử thách', desc: 'Giữ bài mạnh, tính tỉ lệ thắng, tránh nước nguy hiểm. Thỉnh thoảng vẫn sơ suất.' },
    { id: 'hard', icon: '🔴', name: 'Khó', tag: 'Cao thủ', desc: 'Đếm bài, tính trước nhiều nước, canh từng sơ hở và dồn vốn rất khôn.' },
  ];
  const LEVEL_NAME = Object.fromEntries(LEVELS.map((l) => [l.id, l.name]));
  const MAX_PLAYERS = { tienlen: 4, poker: 8, cangua: 4, typhu: 6 };
  const DEFAULT_BOTS = { tienlen: 3, poker: 4, cangua: 3, typhu: 3 };
  let soloLevel = store.get('vct-level') || 'medium';
  const botCountFor = (g) => {
    const v = Number(store.get('vct-bots-' + g)) || DEFAULT_BOTS[g];
    return Math.max(1, Math.min(MAX_PLAYERS[g] - 1, v));
  };

  function renderHome() {
    $('game-picker').innerHTML = pickerHTML(selectedGame);
    $('btn-avatar').innerHTML = Avatar.svg(myAvatar, { size: 96 });
    $('level-picker').innerHTML = LEVELS.map((l) => `
      <button class="level-option lv-${l.id} ${l.id === soloLevel ? 'active' : ''}" data-level="${l.id}">
        <span class="lv-head"><span class="lv-icon">${l.icon}</span><b>${l.name}</b><small>${l.tag}</small></span>
        <span class="lv-desc">${l.desc}</span>
      </button>`).join('');
    $('bot-count').textContent = botCountFor(selectedGame);
    $('btn-solo').textContent = `▶ Chơi ${GAME_NAMES[selectedGame]} với ${botCountFor(selectedGame)} máy (${LEVEL_NAME[soloLevel]})`;
  }
  $('level-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    soloLevel = b.dataset.level;
    store.set('vct-level', soloLevel);
    renderHome();
  });
  const stepBots = (d) => { store.set('vct-bots-' + selectedGame, botCountFor(selectedGame) + d); renderHome(); };
  $('bot-minus').onclick = () => stepBots(-1);
  $('bot-plus').onclick = () => stepBots(1);
  $('btn-solo').onclick = async () => {
    const name = getName();
    if (!name) return;
    const btn = $('btn-solo');
    busy(btn, true, 'Đang dọn bàn…');
    try {
      if (P2P) await Net.host({ offline: true });
      const r = await emit('room:create', { name, game: selectedGame, avatar: myAvatar });
      if (!r.ok) return;
      for (let k = 0; k < botCountFor(selectedGame); k++) {
        const b = await emit('room:addBot', { level: soloLevel });
        if (!b.ok) return;
      }
      await emit('room:start');
    } catch (e) {
      UI.toast(e.message || 'Không mở được bàn chơi.', 'error');
    } finally { busy(btn, false); renderHome(); }
  };
  $('game-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-game]');
    if (!b) return;
    selectedGame = b.dataset.game;
    store.set('vct-game', selectedGame);
    renderHome();
  });

  function getName() {
    const name = $('inp-name').value.trim();
    if (!name) { UI.toast('Nhập tên của bạn trước nhé!', 'error'); $('inp-name').focus(); return null; }
    store.set('vct-name', name);
    return name;
  }
  $('btn-create').onclick = async () => {
    const name = getName();
    if (!name) return;
    if (P2P) {
      busy($('btn-create'), true, 'Đang mở bàn…');
      try { await Net.host(); } catch (e) { UI.toast(e.message || 'Không mở được bàn chơi.', 'error'); return; } finally { busy($('btn-create'), false); }
    }
    await emit('room:create', { name, game: selectedGame, avatar: myAvatar });
  };
  const join = async () => {
    const name = getName();
    const code = $('inp-code').value.trim().toUpperCase();
    if (!name) return;
    if (code.length !== 4) return UI.toast('Mã phòng gồm 4 ký tự.', 'error');
    if (P2P) {
      busy($('btn-join'), true, '…');
      try { await Net.join(code); } catch (e) { UI.toast(e.message || 'Không vào được phòng.', 'error'); return; } finally { busy($('btn-join'), false); }
    }
    await emit('room:join', { name, code, avatar: myAvatar });
  };
  $('btn-join').onclick = join;
  $('inp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('inp-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

  if (P2P) {
    window.__lanUrl = pageBase();
    $('lan-info').innerHTML = '🌐 <b>Chơi online</b> — mở bàn rồi gửi link / mã phòng cho bạn bè. Giữ tab này mở trong lúc chơi nếu bạn là chủ phòng.';
    // Tải lại trang khi đang là khách: tự vào lại phòng cũ
    const saved = Net.savedRoom();
    if (saved) Net.join(saved).catch(() => {});
  } else fetch('api/info').then((r) => r.json()).then((info) => {
    // Chỉ khi mở bằng localhost mới cần chỉ địa chỉ Wi-Fi nội bộ; còn lại (mở qua IP LAN
    // hoặc chạy online) thì chính địa chỉ đang mở là link để mời bạn bè.
    const onLocalhost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
    const urls = onLocalhost ? info.lanUrls || [] : [];
    window.__lanUrl = urls[0] || location.origin;
    $('lan-info').innerHTML = urls.length
      ? `📶 Bạn bè cùng Wi-Fi mở: ${urls.map((u) => `<b>${UI.esc(u)}</b>`).join(' hoặc ')}`
      : `🔗 Mời bạn bè mở: <b>${UI.esc(location.origin)}</b>`;
  }).catch(() => {});

  // ---------- Phòng chờ ----------
  function isHost() { return room && room.hostId === playerId; }

  function playerListHTML(withKick) {
    return room.players.map((p) => `
      <li class="${p.connected ? '' : 'offline'}">
        <span class="avatar-img">${Avatar.svg(p.avatar, { size: 44 })}</span>
        <span class="pl-name">${UI.esc(p.name)}${p.id === playerId ? ' <i class="muted">(bạn)</i>' : ''}</span>
        ${p.id === room.hostId ? '<span class="tag">👑 Chủ phòng</span>' : ''}
        ${p.bot ? `<span class="tag lv-${p.bot}">Máy ${LEVEL_NAME[p.bot] || ''}</span>` : ''}
        ${p.left ? '<span class="tag gray">Đã rời</span>' : !p.connected ? '<span class="tag gray">Mất kết nối</span>' : ''}
        ${withKick && isHost() && p.id !== playerId ? `<button class="btn btn-ghost btn-small" data-kick="${p.id}">Mời ra</button>` : ''}
      </li>`).join('');
  }

  function renderRoom() {
    $('room-code').textContent = room.code;
    const shareUrl = P2P ? inviteLink(room.code) : (window.__lanUrl || location.origin);
    const offline = P2P && Net.isOffline();
    $('share-hint').innerHTML = offline
      ? '🔒 Bàn chơi một mình với máy (không cần mạng). Muốn mời bạn bè: rời phòng rồi bấm <b>♠ Mở bàn chơi</b>.'
      : `Bạn bè mở <b id="share-url">${UI.esc(shareUrl)}</b> rồi nhập mã phòng ở trên để vào.`;
    $('add-bot-row').classList.toggle('hidden', !isHost() || room.playing);
    $('room-game-picker').innerHTML = pickerHTML(room.gameId, !isHost());
    const active = room.players.filter((p) => !p.left).length;
    const meta = room.gameMeta;
    $('player-count').textContent = `(${active} — ${meta.name} cần ${meta.minPlayers}–${meta.maxPlayers})`;
    $('room-players').innerHTML = playerListHTML(true);
    $('btn-start').classList.toggle('hidden', !isHost());
    $('wait-host').classList.toggle('hidden', isHost());
    const ok = active >= meta.minPlayers && active <= meta.maxPlayers;
    $('btn-start').disabled = !ok;
    $('btn-start').textContent = ok ? `Bắt đầu ${meta.name}` : active < meta.minPlayers ? `Cần thêm ${meta.minPlayers - active} người nữa` : `Quá số người (tối đa ${meta.maxPlayers})`;
  }

  $('room-game-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-game]');
    if (b && isHost()) emit('room:setGame', { game: b.dataset.game });
  });
  $('room-players').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kick]');
    if (b && confirm('Mời người này ra khỏi phòng?')) emit('room:kick', { playerId: b.dataset.kick });
  });
  $('btn-start').onclick = () => emit('room:start');
  $('add-bot-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-addbot]');
    if (b) emit('room:addBot', { level: b.dataset.addbot });
  });
  const leave = async () => {
    const others = room && room.players.some((p) => p.id !== playerId && !p.left && !p.bot);
    if (P2P && Net.isHosting() && others) {
      if (!confirm('Bạn là chủ phòng — rời đi sẽ đóng phòng của mọi người. Tiếp tục?')) return;
    } else if (room && room.playing && !confirm('Rời phòng khi đang chơi? Máy sẽ tự đi thay bạn.')) return;
    await emit('room:leave');
    await Net.leave();
    room = null; gameState = null;
    closeModals();
    showScreen();
  };
  $('btn-leave').onclick = leave;
  $('room-code').onclick = () => {
    const link = inviteLink(room.code);
    navigator.clipboard && navigator.clipboard.writeText(link).then(() => UI.toast('Đã chép link mời vào bộ nhớ tạm!'));
  };

  // ---------- Trong game ----------
  const ctx = {
    me: playerId,
    act: (action) => emit('game:action', action),
    hint: () => emit('game:hint'),
    isHost,
    toast: UI.toast,
    /** SVG nhân vật của người chơi theo id */
    avatar(id, size = 40, ring) {
      const p = room && room.players.find((x) => x.id === id);
      return Avatar.svg(p ? p.avatar : {}, { size, ring });
    },
  };

  function renderGame() {
    const SHORT = { tienlen: 'Tiến Lên', poker: 'Poker', cangua: 'Cá Ngựa', typhu: 'Tỷ Phú' };
    $('game-title').textContent = window.innerWidth < 600 ? SHORT[gameState.game] : GAME_NAMES[gameState.game];
    $('game-room-code').textContent = room.code;
    const spectator = !room.gamePlayers.includes(playerId);
    $('spectator-bar').classList.toggle('hidden', !spectator);
    document.body.dataset.game = gameState.game;
    const view = window.GameViews[gameState.game];
    ctx.room = room;
    ctx.spectator = spectator;
    view.render($('game-root'), gameState, ctx);
  }

  // ---------- Tạo hình nhân vật ----------
  let draft = null;
  let aeTab = 'hair';
  const TAB_ORDER = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'outfit', 'outfitColor', 'acc', 'bg'];
  function openEditor() {
    draft = { ...myAvatar };
    $('ae-name').value = $('inp-name').value || store.get('vct-name') || '';
    renderEditor();
    openModal('avatar-modal');
  }
  function renderEditor() {
    $('ae-preview').innerHTML = Avatar.svg(draft, { size: 150 });
    $('ae-tabs').innerHTML = TAB_ORDER.map((k) => `<button class="ae-tab ${k === aeTab ? 'active' : ''}" data-tab="${k}">${Avatar.OPTIONS[k].label}</button>`).join('');
    const opt = Avatar.OPTIONS[aeTab];
    let html = '';
    for (let i = 0; i < opt.count; i++) {
      const active = draft[aeTab] === i ? 'active' : '';
      if (opt.colors) {
        // lựa chọn màu: hiện luôn nhân vật với màu đó để thấy ngay
        html += `<button class="ae-opt ${active}" data-val="${i}">${Avatar.svg({ ...draft, [aeTab]: i }, { size: 56 })}<span class="swatch" style="background:${opt.colors[i]}"></span></button>`;
      } else {
        html += `<button class="ae-opt ${active}" data-val="${i}">${Avatar.svg({ ...draft, [aeTab]: i }, { size: 56 })}<small>${opt.names[i]}</small></button>`;
      }
    }
    $('ae-options').innerHTML = html;
  }
  $('ae-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { aeTab = b.dataset.tab; renderEditor(); }
  });
  $('ae-options').addEventListener('click', (e) => {
    const b = e.target.closest('[data-val]');
    if (!b) return;
    draft[aeTab] = Number(b.dataset.val);
    UI.sfx('step');
    renderEditor();
    $('ae-preview').firstElementChild.animate([{ transform: 'scale(.9) rotate(-4deg)' }, { transform: 'scale(1.05) rotate(2deg)' }, { transform: 'none' }], { duration: 300 });
  });
  $('ae-random').onclick = () => { draft = Avatar.random(); renderEditor(); UI.sfx('dice'); };
  $('ae-save').onclick = async () => {
    const name = $('ae-name').value.trim();
    if (!name) { UI.toast('Đặt tên cho nhân vật nhé!', 'error'); $('ae-name').focus(); return; }
    myAvatar = Avatar.normalize(draft);
    store.set('vct-avatar', JSON.stringify(myAvatar));
    store.set('vct-name', name);
    $('inp-name').value = name;
    closeModals();
    UI.sfx('buy');
    await emit('profile', { name, avatar: myAvatar });
    showScreen();
  };
  $('btn-avatar').onclick = openEditor;
  $('btn-edit-avatar').onclick = openEditor;
  $('btn-room-avatar').onclick = openEditor;
  $('inp-name').addEventListener('change', () => store.set('vct-name', $('inp-name').value.trim()));

  // ---------- Âm thanh ----------
  const soundBtn = $('btn-sound');
  const syncSound = () => { soundBtn.textContent = UI.muted ? '🔇' : '🔊'; };
  soundBtn.onclick = () => { UI.setMuted(!UI.muted); syncSound(); if (!UI.muted) UI.sfx('turn'); };
  syncSound();

  // ---------- Menu, luật chơi ----------
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModals() { document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden')); }
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) m.classList.add('hidden');
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  async function showRules(gameId) {
    $('rules-title').textContent = 'Luật chơi — ' + GAME_NAMES[gameId];
    $('rules-body').textContent = 'Đang tải…';
    openModal('rules-modal');
    try {
      const md = await (await fetch(P2P ? `rules/${gameId}.md` : `rules/${gameId}`)).text();
      $('rules-body').innerHTML = UI.markdown(md);
      $('rules-body').scrollTop = 0;
    } catch (e) {
      $('rules-body').textContent = 'Không tải được luật chơi.';
    }
  }
  window.showRules = showRules;
  $('btn-room-rules').onclick = () => showRules(room.gameId);
  $('btn-game-rules').onclick = () => showRules(gameState.game);

  $('btn-game-menu').onclick = () => {
    $('menu-stop').classList.toggle('hidden', !isHost());
    $('menu-player-list').classList.add('hidden');
    openModal('menu-modal');
  };
  $('menu-players').onclick = () => {
    $('menu-player-list').innerHTML = playerListHTML(false);
    $('menu-player-list').classList.toggle('hidden');
  };
  $('menu-stop').onclick = async () => {
    if (!confirm('Kết thúc ván này và quay về phòng chờ?')) return;
    await emit('room:stop');
    closeModals();
  };
  $('menu-leave').onclick = leave;

  // ---------- Chat ----------
  function renderChat() {
    const list = $('chat-list');
    list.innerHTML = chat.map((m) => m.system
      ? `<div class="chat-msg system">${UI.esc(m.text)}</div>`
      : `<div class="chat-msg"><b>${UI.esc(m.from)}:</b> ${UI.esc(m.text)}</div>`).join('');
    list.scrollTop = list.scrollHeight;
  }
  $('btn-chat-toggle').onclick = () => {
    $('chat').classList.toggle('hidden');
    unread = 0;
    $('chat-badge').classList.add('hidden');
    renderChat();
    if (!$('chat').classList.contains('hidden') && window.innerWidth > 700) $('chat-input').focus();
  };
  $('btn-chat-close').onclick = () => $('chat').classList.add('hidden');
  $('chat-form').onsubmit = (e) => {
    e.preventDefault();
    const text = $('chat-input').value.trim();
    if (!text) return;
    socket.emit('chat', { text });
    $('chat-input').value = '';
  };
  document.querySelector('.quick-emoji').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') socket.emit('chat', { text: e.target.textContent });
  });

  showScreen();
})();
