'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager, GAMES } = require('./rooms');

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));

// Luật chơi (markdown) để client hiển thị
const RULE_FILES = { poker: 'poker.md', tienlen: 'tien-len.md', cangua: 'ca-ngua.md', typhu: 'co-ty-phu.md' };
app.get('/rules/:game', (req, res) => {
  const f = RULE_FILES[req.params.game];
  if (!f) return res.status(404).send('Không có luật cho game này');
  res.type('text/plain; charset=utf-8');
  fs.createReadStream(path.join(__dirname, '..', 'docs', 'luat-choi', f)).pipe(res);
});

function lanUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) urls.push(`http://${ni.address}:${PORT}`);
    }
  }
  return urls;
}
app.get('/api/info', (req, res) => {
  res.json({ lanUrls: lanUrls(), games: Object.values(GAMES).map((G) => G.meta) });
});

new RoomManager(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎉  Vui Cuối Tuần đã sẵn sàng!\n');
  console.log(`   Trên máy này:     http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`   Người cùng Wi-Fi: ${u}`);
  console.log('\n   Mở địa chỉ trên bằng trình duyệt (điện thoại/máy tính) để vào chơi.\n');
});
