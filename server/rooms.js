'use strict';
// Quản lý phòng chơi: tạo / vào phòng, chọn game, bắt đầu, chuyển hành động tới game.
const { Poker } = require('./games/poker');
const { TienLen } = require('./games/tienlen');
const { CaNgua } = require('./games/cangua');
const { TyPhu } = require('./games/typhu');
const Bots = require('./bots');

const BOT_NAMES = ['Bé Na', 'Chú Tư', 'Cô Ba', 'Anh Hai', 'Bác Sáu', 'Út Mập', 'Cậu Bảy', 'Dì Năm', 'Ông Tám', 'Chị Mười'];
const randomBotAvatar = () => ({
  skin: Math.floor(Math.random() * 5), hair: Math.floor(Math.random() * 8), hairColor: Math.floor(Math.random() * 8),
  eyes: Math.floor(Math.random() * 5), mouth: Math.floor(Math.random() * 5), outfit: Math.floor(Math.random() * 4),
  outfitColor: Math.floor(Math.random() * 8), acc: Math.floor(Math.random() * 9), bg: Math.floor(Math.random() * 8),
});
const isHuman = (p) => !p.bot;

const GAMES = { poker: Poker, tienlen: TienLen, cangua: CaNgua, typhu: TyPhu };
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
const AVATAR_KEYS = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'outfit', 'outfitColor', 'acc', 'bg'];
const cleanAvatar = (a) => {
  const out = {};
  AVATAR_KEYS.forEach((k) => {
    const v = Math.floor(Number(a && a[k]));
    out[k] = Number.isFinite(v) && v >= 0 && v < 20 ? v : 0;
  });
  return out;
};
const cleanId = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

/** Nước đi tự động cho người đã rời phòng, để ván không bị kẹt. */
function autoAction(game, playerId) {
  const s = game.getState(playerId);
  if (s.turn !== playerId) return null;
  switch (s.game) {
    case 'tienlen': {
      if (s.phase !== 'playing') return null;
      if (s.lastPlay) return { type: 'pass' };
      return { type: 'play', cards: game.hint(playerId) };
    }
    case 'poker':
      if (s.phase !== 'betting') return null;
      return s.options && s.options.canCheck ? { type: 'check' } : { type: 'fold' };
    case 'cangua':
      if (s.phase === 'roll') return { type: 'roll' };
      if (s.phase === 'move') return { type: 'move', horse: s.movable[0].h };
      return null;
    case 'typhu': {
      const me = s.players.find((p) => p.id === playerId);
      if (me.money < 0) return { type: 'bankrupt' };
      if (s.phase === 'roll') return { type: 'roll' };
      if (s.phase === 'buy') return { type: 'skip_buy' };
      if (s.phase === 'end') return { type: 'end_turn' };
      return null;
    }
    default:
      return null;
  }
}

class RoomManager {
  /** opts.codeGen: hàm tạo mã phòng (chế độ P2P dùng mã đã đăng ký làm địa chỉ kết nối) */
  constructor(io, opts = {}) {
    this.io = io;
    if (opts.codeGen) this.newCode = opts.codeGen;
    this.rooms = new Map(); // code -> room
    this.playerRoom = new Map(); // playerId -> code
    io.on('connection', (socket) => this.onConnection(socket));
  }

  newCode() {
    let code;
    do {
      code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  onConnection(socket) {
    const reply = (ack, data) => typeof ack === 'function' && ack(data);
    const guard = (fn) => (data, ack) => {
      try {
        fn(data || {}, ack);
      } catch (e) {
        reply(ack, { error: e.message || 'Có lỗi xảy ra.' });
      }
    };

    socket.on('hello', guard(({ playerId, name, avatar }, ack) => {
      socket.data.playerId = cleanId(playerId);
      socket.data.name = cleanName(name);
      socket.data.avatar = cleanAvatar(avatar);
      if (!socket.data.playerId) throw new Error('Thiếu mã người chơi.');
      const code = this.playerRoom.get(socket.data.playerId);
      const room = code && this.rooms.get(code);
      if (room) {
        const pl = room.players.find((p) => p.id === socket.data.playerId);
        pl.connected = true;
        pl.left = false;
        pl.avatar = socket.data.avatar;
        socket.join(code);
        this.broadcast(room);
        this.chatSystem(room, `${pl.name} đã kết nối lại.`);
      }
      reply(ack, { ok: true, room: room ? room.code : null });
    }));

    socket.on('room:create', guard(({ name, game, avatar }, ack) => {
      this.requireHello(socket, name, avatar);
      this.leaveCurrent(socket);
      const code = this.newCode();
      const room = {
        code, hostId: socket.data.playerId, gameId: GAMES[game] ? game : 'tienlen',
        players: [], game: null, gamePlayers: [], chat: [],
      };
      this.rooms.set(code, room);
      this.addPlayer(room, socket);
      reply(ack, { ok: true, code });
    }));

    socket.on('room:join', guard(({ code, name, avatar }, ack) => {
      this.requireHello(socket, name, avatar);
      code = String(code || '').toUpperCase().trim();
      const room = this.rooms.get(code);
      if (!room) throw new Error(`Không tìm thấy phòng "${code}".`);
      if (this.playerRoom.get(socket.data.playerId) !== code) this.leaveCurrent(socket);
      if (room.players.length >= 10 && !room.players.some((p) => p.id === socket.data.playerId)) throw new Error('Phòng đã đầy.');
      this.addPlayer(room, socket);
      reply(ack, { ok: true, code });
    }));

    socket.on('room:leave', guard((_, ack) => {
      this.leaveCurrent(socket);
      reply(ack, { ok: true });
    }));

    socket.on('room:setGame', guard(({ game }, ack) => {
      const room = this.hostRoom(socket);
      if (room.game) throw new Error('Đang có ván chơi, hãy kết thúc trước.');
      if (!GAMES[game]) throw new Error('Game không tồn tại.');
      room.gameId = game;
      this.broadcast(room);
      reply(ack, { ok: true });
    }));

    socket.on('room:start', guard((_, ack) => {
      const room = this.hostRoom(socket);
      const G = GAMES[room.gameId];
      const players = room.players.filter((p) => !p.left);
      if (players.length < G.meta.minPlayers) throw new Error(`${G.meta.name} cần ít nhất ${G.meta.minPlayers} người.`);
      if (players.length > G.meta.maxPlayers) throw new Error(`${G.meta.name} tối đa ${G.meta.maxPlayers} người.`);
      if (!players.some(isHuman)) throw new Error('Cần ít nhất 1 người chơi thật.');
      this.clearBots(room);
      room.game = new G(players.map((p) => ({ id: p.id, name: p.name })));
      room.gamePlayers = players.map((p) => p.id);
      room.botFresh = true;
      this.chatSystem(room, `Bắt đầu ${G.meta.name}! Chúc mọi người vui vẻ 🎉`);
      this.broadcast(room);
      reply(ack, { ok: true });
    }));

    socket.on('room:stop', guard((_, ack) => {
      const room = this.hostRoom(socket);
      this.clearBots(room);
      room.game = null;
      room.gamePlayers = [];
      this.chatSystem(room, 'Chủ phòng đã kết thúc ván, quay về phòng chờ.');
      this.broadcast(room);
      reply(ack, { ok: true });
    }));

    // Thêm máy chơi (Dễ / Vừa / Khó)
    socket.on('room:addBot', guard(({ level }, ack) => {
      const room = this.hostRoom(socket);
      if (room.game) throw new Error('Đang có ván chơi, hãy kết thúc trước khi thêm máy.');
      if (!Bots.LEVELS[level]) throw new Error('Chế độ máy không hợp lệ.');
      const G = GAMES[room.gameId];
      if (room.players.filter((p) => !p.left).length >= G.meta.maxPlayers) throw new Error(`${G.meta.name} tối đa ${G.meta.maxPlayers} người.`);
      const used = new Set(room.players.map((p) => p.name));
      const base = BOT_NAMES.find((n) => !used.has('🤖 ' + n)) || 'Máy ' + (room.players.length + 1);
      const bot = {
        id: 'bot-' + Math.random().toString(36).slice(2, 9), name: '🤖 ' + base, bot: level,
        connected: true, left: false, avatar: randomBotAvatar(),
      };
      room.players.push(bot);
      this.chatSystem(room, `${bot.name} (máy ${Bots.LEVELS[level].label}) đã vào bàn.`);
      this.broadcast(room);
      reply(ack, { ok: true, id: bot.id });
    }));

    socket.on('room:kick', guard(({ playerId }, ack) => {
      const room = this.hostRoom(socket);
      if (playerId === room.hostId) throw new Error('Không thể mời chính mình ra.');
      const pl = room.players.find((p) => p.id === playerId);
      if (!pl) throw new Error('Không tìm thấy người chơi.');
      for (const s of this.io.sockets.sockets.values()) {
        if (s.data.playerId === playerId) { s.leave(room.code); s.emit('room:kicked'); }
      }
      this.removePlayer(room, playerId);
      reply(ack, { ok: true });
    }));

    // Đổi nhân vật (và tên, nếu chưa vào ván) bất cứ lúc nào
    socket.on('profile', guard(({ name, avatar }, ack) => {
      if (avatar) socket.data.avatar = cleanAvatar(avatar);
      const n = cleanName(name);
      if (n) socket.data.name = n;
      const code = this.playerRoom.get(socket.data.playerId);
      const room = code && this.rooms.get(code);
      if (room) {
        const pl = room.players.find((p) => p.id === socket.data.playerId);
        if (pl) {
          pl.avatar = socket.data.avatar;
          const inGame = room.game && room.gamePlayers.includes(pl.id);
          if (n && n !== pl.name && !inGame) {
            if (room.players.some((p) => p !== pl && p.name === n)) throw new Error('Tên này đã có người dùng trong phòng.');
            this.chatSystem(room, `${pl.name} đổi tên thành ${n}.`);
            pl.name = n;
          }
          this.broadcast(room);
        }
      }
      reply(ack, { ok: true });
    }));

    socket.on('chat', guard(({ text }) => {
      const room = this.myRoom(socket);
      const t = String(text || '').trim().slice(0, 200);
      if (!t) return;
      this.pushChat(room, { from: socket.data.name, text: t });
    }));

    socket.on('game:action', guard((action, ack) => {
      const room = this.myRoom(socket);
      if (!room.game) throw new Error('Chưa bắt đầu ván.');
      if (!room.gamePlayers.includes(socket.data.playerId)) throw new Error('Bạn đang xem, chờ ván sau nhé.');
      const a = { ...action, _host: socket.data.playerId === room.hostId };
      room.game.action(socket.data.playerId, a);
      room.lastBotAct = null;
      this.runAuto(room);
      this.broadcast(room);
      reply(ack, { ok: true });
    }));

    socket.on('game:hint', guard((_, ack) => {
      const room = this.myRoom(socket);
      if (!room.game || !room.game.hint) throw new Error('Game này không có gợi ý.');
      reply(ack, { ok: true, cards: room.game.hint(socket.data.playerId) });
    }));

    socket.on('disconnect', () => {
      const pid = socket.data.playerId;
      const code = pid && this.playerRoom.get(pid);
      const room = code && this.rooms.get(code);
      if (!room) return;
      // Còn tab khác của cùng người chơi thì không tính là mất kết nối
      for (const s of this.io.sockets.sockets.values()) if (s.data.playerId === pid && s.id !== socket.id) return;
      const pl = room.players.find((p) => p.id === pid);
      if (pl) pl.connected = false;
      this.broadcast(room);
      // Xoá phòng nếu không còn ai kết nối sau 30 phút
      const cleanup = setTimeout(() => {
        if (this.rooms.get(code) === room && room.players.filter(isHuman).every((p) => !p.connected)) {
          this.clearBots(room);
          room.players.forEach((p) => this.playerRoom.delete(p.id));
          this.rooms.delete(code);
        }
      }, 30 * 60 * 1000);
      if (cleanup.unref) cleanup.unref(); // Node: không giữ tiến trình sống vì hẹn giờ này
    });
  }

  requireHello(socket, name, avatar) {
    if (!socket.data.playerId) throw new Error('Chưa kết nối xong, thử lại nhé.');
    if (avatar) socket.data.avatar = cleanAvatar(avatar);
    const n = cleanName(name || socket.data.name);
    if (!n) throw new Error('Hãy nhập tên của bạn.');
    socket.data.name = n;
  }

  myRoom(socket) {
    const code = this.playerRoom.get(socket.data.playerId);
    const room = code && this.rooms.get(code);
    if (!room) throw new Error('Bạn chưa ở trong phòng nào.');
    return room;
  }

  hostRoom(socket) {
    const room = this.myRoom(socket);
    if (room.hostId !== socket.data.playerId) throw new Error('Chỉ chủ phòng mới làm được việc này.');
    return room;
  }

  addPlayer(room, socket) {
    const id = socket.data.playerId;
    let pl = room.players.find((p) => p.id === id);
    if (pl) {
      Object.assign(pl, { connected: true, left: false, avatar: socket.data.avatar || pl.avatar });
    } else {
      let name = socket.data.name;
      let k = 2;
      while (room.players.some((p) => p.name === name)) name = `${socket.data.name} ${k++}`;
      pl = { id, name, connected: true, left: false, avatar: socket.data.avatar || cleanAvatar({}) };
      room.players.push(pl);
      this.chatSystem(room, `${name} đã vào phòng.`);
    }
    this.playerRoom.set(id, room.code);
    socket.join(room.code);
    this.broadcast(room);
  }

  leaveCurrent(socket) {
    const pid = socket.data.playerId;
    const code = this.playerRoom.get(pid);
    const room = code && this.rooms.get(code);
    for (const s of this.io.sockets.sockets.values()) if (s.data.playerId === pid && code) s.leave(code);
    if (room) this.removePlayer(room, pid);
  }

  removePlayer(room, pid) {
    const pl = room.players.find((p) => p.id === pid);
    if (!pl) return;
    this.playerRoom.delete(pid);
    if (room.game && room.gamePlayers.includes(pid)) {
      // Đang trong ván: giữ chỗ, máy sẽ tự đánh thay để ván không bị kẹt
      pl.left = true;
      pl.connected = false;
      this.chatSystem(room, `${pl.name} đã rời phòng (máy sẽ tự đi thay).`);
      this.runAuto(room);
    } else {
      room.players = room.players.filter((p) => p.id !== pid);
      this.chatSystem(room, `${pl.name} đã rời phòng.`);
    }
    const active = room.players.filter((p) => !p.left && isHuman(p));
    if (!active.length) {
      // Không còn người thật: xoá phòng (kể cả các máy)
      this.clearBots(room);
      room.players.forEach((p) => this.playerRoom.delete(p.id));
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === pid) {
      room.hostId = active[0].id;
      this.chatSystem(room, `${active[0].name} trở thành chủ phòng.`);
    }
    this.broadcast(room);
  }

  runAuto(room) {
    if (!room.game) return;
    for (let i = 0; i < 500; i++) {
      const leftIds = room.players.filter((p) => p.left).map((p) => p.id);
      let acted = false;
      for (const id of leftIds) {
        if (!room.gamePlayers.includes(id)) continue;
        const a = autoAction(room.game, id);
        if (a) {
          try { room.game.action(id, a); acted = true; } catch (e) { /* bỏ qua */ }
        }
      }
      if (!acted) return;
    }
  }

  pushChat(room, msg) {
    room.chat.push({ ...msg, t: Date.now() });
    if (room.chat.length > 100) room.chat.shift();
    this.io.to(room.code).emit('chat', msg);
  }

  chatSystem(room, text) { this.pushChat(room, { system: true, text }); }

  // ---------- Máy chơi ----------
  clearBots(room) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }

  /** Nước đi kế tiếp của một máy trong phòng (nếu có). */
  nextBotMove(room) {
    if (!room.game) return null;
    for (const p of room.players) {
      if (!p.bot || p.left || !room.gamePlayers.includes(p.id)) continue;
      let a = null;
      try { a = Bots.decide(room.gameId, room.game, p.id, p.bot); } catch (e) { a = null; }
      if (a) return { id: p.id, action: a };
    }
    return null;
  }

  /** Thời gian "suy nghĩ" của máy, khớp với animation trên màn hình. */
  botDelay(room, move) {
    const t = move.action.type;
    const jitter = Math.random() * 400;
    let d;
    switch (room.gameId) {
      case 'tienlen': d = 900 + jitter; break;
      case 'poker': d = t === 'rebuy' ? 500 : 900 + jitter; break;
      case 'cangua': d = t === 'roll' ? 650 + jitter / 2 : 1450; break; // chờ xúc xắc lăn xong
      case 'typhu':
        if (room.lastBotAct === 'roll') d = 2500; // vừa đổ xúc xắc: chờ quân cờ đi xong
        else if (t === 'roll') d = 800 + jitter;
        else d = 700 + jitter / 2;
        break;
      default: d = 900;
    }
    // Người thật đã về đích / đã úp bài: máy đánh nhanh cho xong ván, đỡ phải ngồi chờ
    const humans = room.game.players.filter((gp) => { const rp = room.players.find((x) => x.id === gp.id); return rp && !rp.bot; });
    if (room.gameId === 'tienlen' && humans.length && humans.every((h) => h.finished)) d = 380;
    if (room.gameId === 'poker' && humans.length && humans.every((h) => h.folded || h.chips === 0)) d = 450;
    if (room.botFresh) { d += 1400; room.botFresh = false; } // chờ chia bài / dựng bàn
    return d;
  }

  scheduleBots(room) {
    if (!room.game || room.botTimer) return;
    const move = this.nextBotMove(room);
    if (!move) return;
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (!room.game || !this.rooms.has(room.code)) return;
      const m = this.nextBotMove(room);
      if (!m) return;
      try {
        room.game.action(m.id, m.action);
      } catch (e) {
        // Phòng khi máy tính sai: đi nước an toàn để ván không bị kẹt
        const safe = autoAction(room.game, m.id);
        try { if (safe) room.game.action(m.id, safe); else return; } catch (e2) { return; }
      }
      room.lastBotAct = m.action.type;
      this.runAuto(room);
      this.broadcast(room);
    }, this.botDelay(room, move));
  }

  broadcast(room) {
    const G = GAMES[room.gameId];
    const base = {
      code: room.code,
      hostId: room.hostId,
      gameId: room.gameId,
      gameMeta: G.meta,
      playing: !!room.game,
      gamePlayers: room.gamePlayers,
      players: room.players.map((p) => ({ id: p.id, name: p.name, connected: p.connected, left: p.left, avatar: p.avatar, bot: p.bot || null })),
    };
    for (const s of this.io.sockets.sockets.values()) {
      const pid = s.data.playerId;
      if (!pid || this.playerRoom.get(pid) !== room.code) continue;
      s.emit('room:state', { ...base, chat: room.chat.slice(-40) });
      if (room.game) {
        s.emit('game:state', room.game.getState(pid));
      }
    }
    this.scheduleBots(room);
  }
}

module.exports = { RoomManager, GAMES, autoAction, cleanAvatar };
