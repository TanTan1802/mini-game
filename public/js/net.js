// Lớp kết nối dùng chung cho 2 chế độ:
//  - "server": chạy bằng `npm start` → dùng Socket.io như bình thường.
//  - "p2p":    chạy dạng web tĩnh (GitHub Pages) → máy CHỦ PHÒNG chạy luật chơi ngay trong trình duyệt
//              (dùng lại nguyên server/rooms.js + server/games/*), khách kết nối thẳng tới chủ phòng qua WebRTC (PeerJS).
// Ứng dụng chỉ thấy một đối tượng giống socket.io-client: on(ev, fn) và emit(ev, data, ack).
(function () {
  const PEER_PREFIX = 'vuicuoituan-v1-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const mode = typeof window.io === 'function' ? 'server' : 'p2p';

  // ---------- Client giống socket.io-client ----------
  class Client {
    constructor() {
      this.handlers = {};
      this.connected = false;
      this.transport = null;
      this.acks = new Map();
      this.seq = 0;
    }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
    fire(ev, data) { (this.handlers[ev] || []).forEach((fn) => fn(data)); }
    emit(ev, data, ack) {
      if (!this.transport) { if (ack) ack({ error: 'Chưa kết nối tới phòng.' }); return; }
      let id = 0;
      if (ack) { id = ++this.seq; this.acks.set(id, ack); }
      this.transport.send({ t: 'ev', ev, data, id });
    }
    deliver(msg) {
      if (!msg) return;
      if (msg.t === 'ack') {
        const fn = this.acks.get(msg.id);
        if (fn) { this.acks.delete(msg.id); fn(msg.res); }
      } else if (msg.t === 'ev') this.fire(msg.ev, msg.data);
    }
    attach(transport) { this.transport = transport; this.connected = true; this.fire('connect'); }
    detach(silent) {
      this.transport = null;
      this.acks.forEach((fn) => fn({ error: 'Mất kết nối.' }));
      this.acks.clear();
      if (this.connected) { this.connected = false; if (!silent) this.fire('disconnect'); }
    }
  }

  // ---------- "Server" ảo chạy trong trình duyệt chủ phòng (giả lập API socket.io mà rooms.js dùng) ----------
  class VSocket {
    constructor(io, id, send) { this.io = io; this.id = id; this.data = {}; this.rooms = new Set(); this.h = {}; this.send = send; }
    on(ev, fn) { this.h[ev] = fn; }
    emit(ev, data) { this.send({ t: 'ev', ev, data }); }
    join(r) { this.rooms.add(r); }
    leave(r) { this.rooms.delete(r); }
    receive(msg) {
      if (!msg || msg.t !== 'ev' || msg.ev === 'disconnect') return;
      const fn = this.h[msg.ev];
      const ack = msg.id ? (res) => this.send({ t: 'ack', id: msg.id, res }) : undefined;
      if (fn) fn(msg.data, ack); else if (ack) ack({ error: 'Không hỗ trợ.' });
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.io.sockets.sockets.delete(this.id);
      if (this.h.disconnect) this.h.disconnect();
    }
  }
  class FakeIO {
    constructor() { this.sockets = { sockets: new Map() }; this.onConn = null; this.n = 0; }
    on(ev, fn) { if (ev === 'connection') this.onConn = fn; }
    to(room) {
      return { emit: (ev, data) => { for (const s of this.sockets.sockets.values()) if (s.rooms.has(room)) s.emit(ev, data); } };
    }
    connect(send) {
      const s = new VSocket(this, 'v' + ++this.n, send);
      this.sockets.sockets.set(s.id, s);
      this.onConn(s);
      return s;
    }
  }

  // ---------- PeerJS ----------
  function peerOptions() {
    // ?peer=localhost:9000 để thử với máy chủ PeerJS riêng (mặc định dùng máy chủ công khai miễn phí của PeerJS)
    const custom = new URLSearchParams(location.search).get('peer');
    const base = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
    if (!custom) return base;
    const [host, port] = custom.split(':');
    return { ...base, host, port: Number(port) || 443, path: '/', secure: location.protocol === 'https:' && !/^(localhost|127\.)/.test(host) };
  }
  function openPeer(id) {
    return new Promise((resolve, reject) => {
      const p = id ? new window.Peer(id, peerOptions()) : new window.Peer(peerOptions());
      const t = setTimeout(() => { p.destroy(); reject(Object.assign(new Error('Không kết nối được máy chủ trung gian. Kiểm tra mạng rồi thử lại.'), { type: 'timeout' })); }, 15000);
      p.on('open', () => { clearTimeout(t); resolve(p); });
      p.on('error', (e) => { clearTimeout(t); p.destroy(); reject(e); });
    });
  }
  const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } },
  };

  const client = mode === 'server' ? window.io({ transports: ['websocket', 'polling'] }) : new Client();
  let peer = null;
  let hostState = null; // { code, io, manager, conns }
  let joinedCode = null;
  let reconnectTimer = null;
  let leaving = false;

  async function host() {
    if (mode === 'server' || hostState) return;
    await leave();
    if (!window.Peer || !window.Engine) throw new Error('Thiếu thư viện kết nối.');
    let code = null;
    for (let k = 0; k < 6 && !peer; k++) {
      code = randomCode();
      try { peer = await openPeer(PEER_PREFIX + code); } catch (e) { if (e.type !== 'unavailable-id') throw e; }
    }
    if (!peer) throw new Error('Không tạo được phòng, thử lại nhé.');
    const io = new FakeIO();
    const manager = new window.Engine.RoomManager(io, { codeGen: () => code });
    hostState = { code, io, manager, conns: new Set() };
    // Chủ phòng tự kết nối vào "server" của mình qua bộ nhớ (giữ thứ tự bằng microtask)
    const local = io.connect((msg) => queueMicrotask(() => client.deliver(msg)));
    client.attach({ send: (msg) => queueMicrotask(() => local.receive(msg)) });
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        hostState.conns.add(conn);
        const vs = io.connect((msg) => { if (conn.open) conn.send(msg); });
        conn.on('data', (m) => vs.receive(m));
        const done = () => { hostState && hostState.conns.delete(conn); vs.close(); };
        conn.on('close', done);
        conn.on('error', done);
      });
    });
    // Mất kết nối máy chủ trung gian: khách đang chơi không ảnh hưởng, nhưng cần nối lại để người mới vào được
    peer.on('disconnected', () => { if (!leaving && peer && !peer.destroyed) setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500); });
    store.set('vct-p2p-room', null);
    return code;
  }

  async function join(code) {
    if (mode === 'server') return;
    code = String(code || '').toUpperCase();
    if (hostState && hostState.code === code) return; // đang là chủ phòng này
    if (joinedCode === code && client.connected) return;
    await leave();
    joinedCode = code;
    await connectTo(code);
    store.set('vct-p2p-room', code);
  }

  async function connectTo(code) {
    if (!peer || peer.destroyed) peer = await openPeer();
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Không kết nối được tới phòng ${code}. Kiểm tra lại mã phòng, hoặc chủ phòng đã thoát.`)), 15000);
      conn.on('open', () => { clearTimeout(t); resolve(); });
      conn.on('error', (e) => { clearTimeout(t); reject(e); });
      peer.on('error', (e) => {
        clearTimeout(t);
        reject(e.type === 'peer-unavailable' ? new Error(`Không tìm thấy phòng ${code}. Có thể chủ phòng đã thoát hoặc mã sai.`) : e);
      });
    });
    conn.on('data', (m) => {
      if (m && m.t === 'ev' && m.ev === 'host-closed') {
        // Chủ phòng chủ động đóng phòng
        joinedCode = null;
        store.set('vct-p2p-room', null);
        client.detach(true);
        client.fire('host-gone');
        return;
      }
      client.deliver(m);
    });
    conn.on('close', () => {
      if (leaving || joinedCode !== code) return;
      client.detach();
      scheduleReconnect(code, 0);
    });
    client.attach({ send: (m) => { if (conn.open) conn.send(m); } });
  }

  // Khách mất kết nối: thử nối lại vài lần (chủ phòng có thể chỉ rớt mạng chốc lát)
  function scheduleReconnect(code, attempt) {
    clearTimeout(reconnectTimer);
    if (attempt >= 8) {
      joinedCode = null;
      store.set('vct-p2p-room', null);
      client.fire('host-gone');
      return;
    }
    reconnectTimer = setTimeout(async () => {
      if (joinedCode !== code) return;
      try {
        if (peer) { peer.destroy(); peer = null; }
        await connectTo(code);
      } catch (e) { scheduleReconnect(code, attempt + 1); }
    }, 2500);
  }

  async function leave() {
    if (mode === 'server') return;
    leaving = true;
    clearTimeout(reconnectTimer);
    joinedCode = null;
    store.set('vct-p2p-room', null);
    const wasHosting = !!hostState;
    if (hostState) closeHosting();
    if (peer) {
      // Chủ phòng: chờ lời báo "đóng phòng" kịp gửi tới khách rồi mới huỷ kết nối
      const p = peer;
      peer = null;
      if (wasHosting) setTimeout(() => p.destroy(), 600); else p.destroy();
    }
    client.detach(true);
    leaving = false;
  }

  function closeHosting() {
    hostState.conns.forEach((c) => { try { c.send({ t: 'ev', ev: 'host-closed' }); } catch (e) { /* */ } });
    const conns = [...hostState.conns];
    hostState = null;
    setTimeout(() => conns.forEach((c) => c.close()), 300);
  }
  // Chủ phòng đóng tab: báo cho khách
  window.addEventListener('pagehide', () => { if (hostState) closeHosting(); });

  window.Net = {
    mode,
    socket: client,
    host,
    join,
    leave,
    isHosting: () => !!hostState,
    savedRoom: () => store.get('vct-p2p-room'),
  };
})();
