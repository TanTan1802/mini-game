#!/usr/bin/env node
'use strict';
// Tạo bản web tĩnh (chơi P2P) để đưa lên GitHub Pages.
//   node scripts/build-pages.js [thư-mục-ra]   (mặc định: dist-pages)
// Bản này không cần server: máy chủ phòng chạy luật chơi ngay trong trình duyệt,
// người chơi kết nối với nhau qua WebRTC (PeerJS).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist-pages'));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// 1. Giao diện
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(ROOT, 'public'), OUT);

// 2. Thư viện PeerJS (đóng gói kèm, không phụ thuộc CDN)
const peerSrc = require.resolve('peerjs/dist/peerjs.min.js', { paths: [ROOT] });
fs.mkdirSync(path.join(OUT, 'js', 'vendor'), { recursive: true });
fs.copyFileSync(peerSrc, path.join(OUT, 'js', 'vendor', 'peerjs.min.js'));

// 3. Bộ máy luật chơi: gói server/rooms.js + server/games/*.js (CommonJS) thành 1 file cho trình duyệt
const modules = ['rooms', 'games/cards', 'games/tienlen', 'games/poker', 'games/cangua', 'games/typhu'];
let bundle = `// Tự động tạo từ server/rooms.js và server/games/*.js — đừng sửa tay\n(function () {
  var defs = {}, cache = {};
  function norm(from, req) {
    var parts = from.split('/'); parts.pop();
    req.split('/').forEach(function (p) { if (p === '.' || p === '') return; if (p === '..') parts.pop(); else parts.push(p); });
    return parts.join('/').replace(/\\.js$/, '');
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    if (!defs[id]) throw new Error('Không có module ' + id);
    var m = { exports: {} }; cache[id] = m;
    defs[id](m, m.exports, function (r) { return load(norm(id, r)); });
    return m.exports;
  }\n`;
for (const id of modules) {
  const src = fs.readFileSync(path.join(ROOT, 'server', id + '.js'), 'utf8');
  bundle += `  defs[${JSON.stringify(id)}] = function (module, exports, require) {\n${src}\n};\n`;
}
bundle += `  window.Engine = load('rooms');\n})();\n`;
fs.writeFileSync(path.join(OUT, 'js', 'engine.js'), bundle);

// 4. Luật chơi
const RULES = { poker: 'poker.md', tienlen: 'tien-len.md', cangua: 'ca-ngua.md', typhu: 'co-ty-phu.md' };
fs.mkdirSync(path.join(OUT, 'rules'), { recursive: true });
for (const [id, f] of Object.entries(RULES)) {
  fs.copyFileSync(path.join(ROOT, 'docs', 'luat-choi', f), path.join(OUT, 'rules', id + '.md'));
}

// 5. index.html: thay Socket.io bằng PeerJS + bộ máy luật chơi
const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const ioTag = '<script src="socket.io/socket.io.js"></script>';
if (!html.includes(ioTag)) throw new Error('Không tìm thấy thẻ socket.io trong index.html');
html = html.replace(ioTag, '<script src="js/vendor/peerjs.min.js"></script>\n  <script src="js/engine.js"></script>');
fs.writeFileSync(indexPath, html);

// 6. GitHub Pages: không xử lý Jekyll
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log('✅ Đã tạo bản web tĩnh tại', path.relative(process.cwd(), OUT) || '.');
