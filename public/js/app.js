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
  let room = null;
  let gameState = null;
  let chat = [];
  let unread = 0;
  let lastTurnWasMe = false;

  $('inp-name').value = store.get('vct-name') || '';
  const params = new URLSearchParams(location.search);
  if (params.get('room')) $('inp-code').value = params.get('room').toUpperCase();

  const socket = io({ transports: ['websocket', 'polling'] });

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
    socket.emit('hello', { playerId, name: $('inp-name').value || store.get('vct-name') }, (res) => {
      if (!res || !res.room) { room = null; gameState = null; showScreen(); }
    });
  });
  socket.on('disconnect', () => $('conn-status').classList.remove('hidden'));

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
      <button class="game-option ${id === current ? 'active' : ''}" data-game="${id}" ${disabled ? 'disabled' : ''}>
        <span class="go-icon">${GAME_INFO[id].icon}</span>
        <span class="go-name">${GAME_NAMES[id]}</span>
        <span class="go-desc">${GAME_INFO[id].desc}</span>
      </button>`).join('');
  }

  function renderHome() {
    $('game-picker').innerHTML = pickerHTML(selectedGame);
  }
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
    if (name) await emit('room:create', { name, game: selectedGame });
  };
  const join = async () => {
    const name = getName();
    const code = $('inp-code').value.trim().toUpperCase();
    if (!name) return;
    if (code.length !== 4) return UI.toast('Mã phòng gồm 4 ký tự.', 'error');
    await emit('room:join', { name, code });
  };
  $('btn-join').onclick = join;
  $('inp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('inp-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });

  fetch('/api/info').then((r) => r.json()).then((info) => {
    const urls = info.lanUrls || [];
    window.__lanUrl = urls[0] || location.origin;
    $('lan-info').innerHTML = urls.length
      ? `📶 Bạn bè cùng Wi-Fi mở: ${urls.map((u) => `<b>${UI.esc(u)}</b>`).join(' hoặc ')}`
      : '';
  }).catch(() => {});

  // ---------- Phòng chờ ----------
  function isHost() { return room && room.hostId === playerId; }

  function playerListHTML(withKick) {
    return room.players.map((p) => `
      <li class="${p.connected ? '' : 'offline'}">
        <span class="avatar">${UI.esc(p.name.slice(0, 1).toUpperCase())}</span>
        <span class="pl-name">${UI.esc(p.name)}${p.id === playerId ? ' <i class="muted">(bạn)</i>' : ''}</span>
        ${p.id === room.hostId ? '<span class="tag">👑 Chủ phòng</span>' : ''}
        ${p.left ? '<span class="tag gray">Đã rời</span>' : !p.connected ? '<span class="tag gray">Mất kết nối</span>' : ''}
        ${withKick && isHost() && p.id !== playerId ? `<button class="btn btn-ghost btn-small" data-kick="${p.id}">Mời ra</button>` : ''}
      </li>`).join('');
  }

  function renderRoom() {
    $('room-code').textContent = room.code;
    const url = (window.__lanUrl || location.origin);
    $('share-url').textContent = url;
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
  const leave = async () => {
    if (room && room.playing && !confirm('Rời phòng khi đang chơi? Máy sẽ tự đi thay bạn.')) return;
    await emit('room:leave');
    room = null; gameState = null;
    closeModals();
    showScreen();
  };
  $('btn-leave').onclick = leave;
  $('room-code').onclick = () => {
    const link = `${window.__lanUrl || location.origin}/?room=${room.code}`;
    navigator.clipboard && navigator.clipboard.writeText(link).then(() => UI.toast('Đã chép link mời vào bộ nhớ tạm!'));
  };

  // ---------- Trong game ----------
  const ctx = {
    me: playerId,
    act: (action) => emit('game:action', action),
    hint: () => emit('game:hint'),
    isHost,
    toast: UI.toast,
  };

  function renderGame() {
    $('game-title').textContent = GAME_NAMES[gameState.game];
    $('game-room-code').textContent = room.code;
    const spectator = !room.gamePlayers.includes(playerId);
    $('spectator-bar').classList.toggle('hidden', !spectator);
    document.body.dataset.game = gameState.game;
    const view = window.GameViews[gameState.game];
    ctx.room = room;
    ctx.spectator = spectator;
    view.render($('game-root'), gameState, ctx);
  }

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
      const md = await (await fetch('/rules/' + gameId)).text();
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
