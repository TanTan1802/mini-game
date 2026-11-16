'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { TienLen, classify, canBeat, checkInstantWin } = require('../server/games/tienlen');
const { Poker, bestHand, compareScore } = require('../server/games/poker');
const { CaNgua } = require('../server/games/cangua');
const { TyPhu } = require('../server/games/typhu');
const { autoAction } = require('../server/rooms');

const mkPlayers = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Người ' + (i + 1) }));
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

// ---------------- Tiến Lên ----------------
test('Tiến lên: phân loại bộ bài', () => {
  assert.equal(classify(['3S']).type, 'single');
  assert.equal(classify(['5S', '5H']).type, 'pair');
  assert.equal(classify(['5S', '6H']), null);
  assert.equal(classify(['9S', '9H', '9D']).type, 'triple');
  assert.equal(classify(['9S', '9H', '9D', '9C']).type, 'quad');
  assert.equal(classify(['3S', '4H', '5D']).type, 'straight');
  assert.equal(classify(['QS', 'KH', 'AD']).type, 'straight');
  assert.equal(classify(['KS', 'AH', '2D']), null, 'sảnh không được có heo');
  assert.equal(classify(['3S', '3H', '4D', '4C', '5S', '5H']).type, 'dstraight');
  assert.equal(classify(['3S', '3H', '4D', '4C', '6S', '6H']), null);
});

test('Tiến lên: so bài và chặt heo', () => {
  const c = classify;
  assert.ok(canBeat(c(['4S']), c(['3H'])));
  assert.ok(!canBeat(c(['3S']), c(['3H'])), '3♠ < 3♥');
  assert.ok(canBeat(c(['3H']), c(['3S'])));
  assert.ok(canBeat(c(['2S']), c(['AH'])));
  assert.ok(!canBeat(c(['4S', '5S', '6S']), c(['4H', '5H', '6H'])));
  assert.ok(!canBeat(c(['4S', '5S', '6S', '7S']), c(['4H', '5H', '6H'])), 'khác số lá');
  assert.equal(canBeat(c(['3S', '3H', '4D', '4C', '5S', '5H']), c(['2H'])), 'chat');
  assert.ok(!canBeat(c(['3S', '3H', '4D', '4C', '5S', '5H']), c(['2H', '2D'])), '3 đôi thông không chặt đôi heo');
  assert.equal(canBeat(c(['7S', '7H', '7D', '7C']), c(['2H', '2D'])), 'chat');
  assert.equal(canBeat(c(['7S', '7H', '7D', '7C']), c(['3S', '3H', '4D', '4C', '5S', '5H'])), 'chat');
  assert.equal(canBeat(c(['3S', '3H', '4D', '4C', '5S', '5H', '6S', '6H']), c(['7S', '7H', '7D', '7C'])), 'chat');
  assert.ok(!canBeat(c(['7S', '7H', '7D', '7C']), c(['AS'])), 'tứ quý không chặt rác thường');
});

test('Tiến lên: tới trắng', () => {
  assert.equal(checkInstantWin(['2S', '2C', '2D', '2H', '3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS']), 'Tứ quý heo');
  assert.equal(checkInstantWin(['3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS', '2H']), 'Sảnh rồng (3 → A)');
  assert.equal(checkInstantWin(['3S', '3H', '5S', '5H', '7S', '7H', '9S', '9H', 'JS', 'JH', 'KS', 'KH', '2H']), '6 đôi');
  assert.equal(checkInstantWin(['3S', '4H', '6S', '8H', '9S', 'JH', 'KS', '2H', '5D', '7D', '10D', '3H', 'AD']), null);
});

test('Tiến lên: lượt đầu phải có lá nhỏ nhất, bỏ lượt bị loại khỏi vòng', () => {
  const g = new TienLen(mkPlayers(4), { rng: seeded(7) });
  if (g.phase === 'ended') return; // tới trắng hiếm gặp
  const first = g.players[g.turn];
  assert.equal(g.requiredCard, '3S');
  const other = first.hand.find((c) => c !== '3S');
  assert.throws(() => g.action(first.id, { type: 'play', cards: [other] }), /lá nhỏ nhất/);
  assert.throws(() => g.action(first.id, { type: 'pass' }), /cầm vòng/);
  g.action(first.id, { type: 'play', cards: ['3S'] });
  const second = g.players[g.turn];
  g.action(second.id, { type: 'pass' });
  assert.ok(g.passed.has(second.id));
});

test('Tiến lên: chơi ngẫu nhiên 300 ván không lỗi, điểm tổng = 0', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const n = 2 + (seed % 3);
    const g = new TienLen(mkPlayers(n), { rng: seeded(seed) });
    const rnd = seeded(seed * 31);
    for (let round = 0; round < 3; round++) {
      let guard = 0;
      while (g.phase === 'playing') {
        assert.ok(guard++ < 500, 'ván quá dài');
        const p = g.players[g.turn];
        const hint = g.hint(p.id);
        if (g.lastPlay && (!hint || rnd() < 0.3)) g.action(p.id, { type: 'pass' });
        else {
          assert.ok(hint, 'người cầm vòng phải luôn có bài đánh');
          g.action(p.id, { type: 'play', cards: hint });
        }
      }
      assert.equal(g.players.reduce((s, p) => s + p.score, 0), 0);
      g.action('p0', { type: 'next' });
    }
  }
});

// ---------------- Poker ----------------
test('Poker: xếp hạng bài', () => {
  const h = (cards) => bestHand(cards);
  assert.equal(h(['AS', 'KS', 'QS', 'JS', '10S', '2H', '3D']).name, 'Sảnh chúa (Royal Flush)');
  assert.equal(h(['AS', '2D', '3C', '4H', '5S', 'KD', 'KC']).name, 'Sảnh');
  assert.equal(h(['AS', 'AD', 'AC', '4H', '4S', 'KD', 'KC']).name, 'Cù lũ');
  assert.equal(h(['2S', '7S', '9S', 'JS', 'KS', 'KD', 'KC']).name, 'Thùng');
  assert.ok(compareScore(h(['AS', 'AD', 'KC', '4H', '7S', '9D', '2C']).score, h(['AH', 'AC', 'QC', '4D', '7C', '9H', '2D']).score) > 0, 'kicker K > Q');
  assert.ok(compareScore(h(['6S', '2D', '3C', '4H', '5S', 'KD', 'QC']).score, h(['AS', '2D', '3C', '4H', '5S', 'KD', 'QC']).score) > 0, 'sảnh 6 > sảnh A-5');
});

function chipsTotal(g) { return g.players.reduce((s, p) => s + p.chips, 0) + g.pot(); }

test('Poker: chơi ngẫu nhiên 400 ván, tổng chip luôn bảo toàn', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const n = 2 + (seed % 7);
    const g = new Poker(mkPlayers(n), { rng: seeded(seed) });
    const rnd = seeded(seed * 17);
    let expected = n * 1000;
    for (let hand = 0; hand < 6; hand++) {
      let guard = 0;
      while (g.phase === 'betting') {
        assert.ok(guard++ < 300);
        const pid = g.players[g.turn].id;
        const o = g.getState(pid).options;
        const r = rnd();
        let a;
        if (r < 0.1) a = { type: 'fold' };
        else if (r < 0.2) a = { type: 'allin' };
        else if (r < 0.4 && o.canRaise) a = { type: 'raise', amount: o.minRaiseTo + Math.floor(rnd() * 50) };
        else a = o.canCheck ? { type: 'check' } : { type: 'call' };
        try { g.action(pid, a); } catch (e) { g.action(pid, o.canCheck ? { type: 'check' } : { type: 'call' }); }
        assert.equal(chipsTotal(g), expected);
      }
      assert.equal(g.players.reduce((s, p) => s + p.chips, 0), expected);
      g.players.forEach((p) => { if (p.chips === 0 && rnd() < 0.5) { g.action(p.id, { type: 'rebuy' }); expected += 1000; } });
      g.action('p0', { type: 'next' });
      if (g.phase === 'waiting') break;
    }
  }
});

test('Poker: side pot chia đúng', () => {
  const g = new Poker(mkPlayers(3), { rng: seeded(3) });
  // Gán chip khác nhau rồi chia lại
  g.players[0].chips = 100; g.players[1].chips = 300; g.players[2].chips = 300;
  g.handNo = 0; g.dealer = -1;
  g.startHand();
  while (g.phase === 'betting') {
    const pid = g.players[g.turn].id;
    g.action(pid, { type: 'allin' });
  }
  assert.equal(g.players.reduce((s, p) => s + p.chips, 0), 700);
  assert.ok(g.result.pots.length >= 1);
});

// ---------------- Cá ngựa ----------------
test('Cá ngựa: ra quân cần 1 hoặc 6, không nhảy qua ngựa', () => {
  const g = new CaNgua(mkPlayers(2));
  const [a, b] = g.players;
  assert.equal(g.moveFor(a, 0, 3), null);
  assert.ok(g.moveFor(a, 0, 6));
  assert.ok(g.moveFor(a, 0, 1));
  a.horses[0] = 5;
  b.horses[0] = (5 + 2 + 30) % 60; // b màu 2: abs = 30 + rel
  // đặt b đúng ô tuyệt đối 7 => rel = 7 - 30 + 60 = 37
  b.horses[0] = 37;
  assert.equal(g.moveFor(a, 0, 4), null, 'bị cản bởi ngựa ở ô 7');
  const kick = g.moveFor(a, 0, 2);
  assert.ok(kick && kick.kick, 'đá ngựa khi đứng đúng ô');
  a.horses[1] = 59;
  assert.ok(g.moveFor(a, 1, 4));
  a.horses[2] = 102;
  assert.equal(g.moveFor(a, 1, 4), null, 'không nhảy qua ngựa trong chuồng');
  assert.ok(g.moveFor(a, 2, 3));
  assert.equal(g.moveFor(a, 2, 4), null, 'phải đổ đúng bậc kế tiếp');
});

test('Cá ngựa: chơi ngẫu nhiên tới khi có người thắng', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const n = 2 + (seed % 3);
    const g = new CaNgua(mkPlayers(n), { rng: seeded(seed) });
    const rnd = seeded(seed + 99);
    let guard = 0;
    while (g.phase !== 'ended' && guard++ < 20000) {
      const pid = g.players[g.turn].id;
      if (g.phase === 'roll') g.action(pid, { type: 'roll' });
      else {
        const mv = g.getState(pid).movable;
        g.action(pid, { type: 'move', horse: mv[Math.floor(rnd() * mv.length)].h });
      }
      // không bao giờ 2 ngựa chung 1 ô
      const occ = new Set();
      g.players.forEach((p) => p.horses.forEach((r) => {
        if (r >= 0 && r < 60) {
          const abs = (p.color * 15 + r) % 60;
          assert.ok(!occ.has(abs), 'hai ngựa trùng ô');
          occ.add(abs);
        }
      }));
    }
    assert.equal(g.phase, 'ended', 'ván phải kết thúc (seed ' + seed + ')');
  }
});

// ---------------- Cờ Tỷ Phú ----------------
test('Tỷ phú: chơi ngẫu nhiên, tiền + tài sản hợp lệ, không kẹt', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const n = 2 + (seed % 5);
    const g = new TyPhu(mkPlayers(n), { rng: seeded(seed) });
    const rnd = seeded(seed * 7);
    let guard = 0;
    while (g.phase !== 'ended' && guard++ < 4000) {
      const p = g.cur();
      // thỉnh thoảng xây nhà / cầm cố
      const s = g.getState(p.id);
      s.board.forEach((sq, i) => {
        if (sq.owner === p.id && rnd() < 0.3) { try { g.action(p.id, { type: 'build', pos: i }); } catch (e) { /* */ } }
      });
      // người đang nợ: bán nhà, cầm cố, hoặc phá sản
      for (const q of g.players) {
        if (q.bankrupt || q.money >= 0) continue;
        const own = g.getState(q.id).board.map((sq, i) => ({ sq, i })).filter((x) => x.sq.owner === q.id);
        for (const x of own) { while (q.money < 0 && g.owned[x.i] && g.owned[x.i].houses) { try { g.action(q.id, { type: 'sell_house', pos: x.i }); } catch (e) { break; } } }
        for (const x of own) { if (q.money < 0) { try { g.action(q.id, { type: 'mortgage', pos: x.i }); } catch (e) { /* */ } } }
        if (q.money < 0 && !q.bankrupt) g.action(q.id, { type: 'bankrupt' });
        if (g.phase === 'ended') break;
        assert.ok(!g.cur().bankrupt, 'lượt hiện tại không được là người phá sản');
      }
      if (g.phase === 'ended') break;
      const a = autoAction(g, g.cur().id);
      if (a && a.type === 'skip_buy' && rnd() < 0.8 && g.cur().money >= g.getState(g.cur().id).board[g.cur().pos].price) a.type = 'buy';
      if (a) g.action(g.cur().id, a);
      g.players.forEach((q) => assert.ok(!q.bankrupt || q.money === 0));
    }
    if (g.phase !== 'ended') g.action('p0', { type: 'end_game', _host: true });
    assert.equal(g.phase, 'ended');
    assert.ok(g.ranking && g.ranking.length === n);
  }
});

test('Tỷ phú: xây nhà phải đủ nhóm và xây đều', () => {
  const g = new TyPhu(mkPlayers(2));
  const p = g.players[0];
  g.owned[1] = { owner: p.id, houses: 0, mortgaged: false };
  assert.throws(() => g.action(p.id, { type: 'build', pos: 1 }), /đủ nhóm/);
  g.owned[3] = { owner: p.id, houses: 0, mortgaged: false };
  g.action(p.id, { type: 'build', pos: 1 });
  assert.throws(() => g.action(p.id, { type: 'build', pos: 1 }), /xây đều/);
  g.action(p.id, { type: 'build', pos: 3 });
  assert.equal(g.rentFor(1, 0), Math.ceil(60 * 0.06) * 5);
});

// ---------------- Tiến Lên: tính điểm ----------------
function tlSetup(hands, turn = 0) {
  const g = new TienLen(mkPlayers(hands.length), { rng: seeded(99) });
  g.phase = 'playing';
  g.requiredCard = null;
  g.lastPlay = null;
  g.passed = new Set();
  g.players.forEach((p, i) => { p.hand = hands[i]; p.finished = false; p.place = 0; p.score = 0; p.delta = 0; p.items = []; p.burned = false; });
  g.nextPlace = 1; g.lastFree = hands.length; g.turn = turn;
  return g;
}

test('Tiến lên: chặt heo đỏ bằng 3 đôi thông → người bị chặt đền 3 điểm ngay', () => {
  const g = tlSetup([['2H', '9S', 'KD'], ['4S', '4H', '5S', '5H', '6S', '6H', 'JD'], ['3S', 'QD'], ['3C', 'QH']]);
  g.action('p0', { type: 'play', cards: ['2H'] });
  g.action('p1', { type: 'play', cards: ['4S', '4H', '5S', '5H', '6S', '6H'] });
  assert.equal(g.players[0].score, -3);
  assert.equal(g.players[1].score, 3);
});

test('Tiến lên: chặt chồng → người bị chặt sau cùng đền cả phần trước', () => {
  const g = tlSetup([['2S', '9S', 'KD'], ['4S', '4H', '5S', '5H', '6S', '6H', 'JD'], ['8S', '8C', '8D', '8H', 'QD'], ['3C', 'QH']]);
  g.action('p0', { type: 'play', cards: ['2S'] }); // heo đen
  g.action('p1', { type: 'play', cards: ['4S', '4H', '5S', '5H', '6S', '6H'] }); // p0 đền 2
  g.action('p2', { type: 'play', cards: ['8S', '8C', '8D', '8H'] }); // p1 đền 3 (đôi thông) + 2 (heo) = 5
  assert.deepEqual(g.players.map((p) => p.score), [-2, 2 - 5, 5, 0]);
});

test('Tiến lên: về đích được cộng điểm ngay, bét bị thối heo + tứ quý cho người Nhất', () => {
  const g = tlSetup([['AS'], ['3S'], ['5S'], ['2D', '7S', '7C', '7D', '7H', '9S']]);
  g.action('p0', { type: 'play', cards: ['AS'] });
  assert.equal(g.players[0].score, 3, 'về Nhất được +3 ngay, không chờ hết ván');
  assert.equal(g.phase, 'playing');
  g.action('p1', { type: 'pass' });
  g.action('p2', { type: 'pass' });
  g.action('p3', { type: 'pass' }); // hết vòng → p1 đánh tự do
  g.action('p1', { type: 'play', cards: ['3S'] }); // về nhì
  g.action('p2', { type: 'play', cards: ['5S'] }); // về ba → p3 bét
  assert.equal(g.phase, 'ended');
  const [nhat, nhi, ba, bet] = g.players;
  assert.deepEqual([nhi.score, ba.score], [1, -1]);
  // bét: −3 (hạng) − 3 (heo ♦) − 4 (tứ quý 7); nhất: +3 + 7
  assert.equal(bet.score, -3 - 3 - 4);
  assert.equal(nhat.score, 3 + 7);
  assert.ok(g.result.ranking.find((r) => r.id === 'p3').items.some((it) => /Thối heo/.test(it.label)));
});

test('Tiến lên: chưa đánh lá nào khi có người về Nhất → cháy bài, phạt gấp đôi', () => {
  const full = (k) => ['3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS', '2S'].map((c) => c.replace('S', k));
  const g = tlSetup([['KH'], full('C'), ['3D', '5D'], ['4H', '6H']]);
  g.action('p0', { type: 'play', cards: ['KH'] });
  const chay = g.players[1];
  assert.ok(chay.burned && chay.finished);
  assert.equal(chay.place, 4, 'người cháy xếp bét');
  assert.equal(chay.score, -3 - 3, 'bét −3 và phạt cháy thêm −3');
  assert.equal(g.players[0].score, 3 + 3);
});

test('Tiến lên: điểm cả bàn luôn bằng 0 qua 300 ván chơi bằng máy', () => {
  const Bots = require('../server/bots');
  for (let k = 0; k < 300; k++) {
    const g = new TienLen(mkPlayers(2 + (k % 3)), { rng: seeded(k + 1) });
    let guard = 0;
    while (g.phase === 'playing' && guard++ < 500) {
      const id = g.players[g.turn].id;
      g.action(id, Bots.decide('tienlen', g, id, ['easy', 'medium', 'hard'][k % 3]));
    }
    assert.equal(g.players.reduce((t, p) => t + p.score, 0), 0, 'ván ' + k);
    assert.equal(g.phase, 'ended');
  }
});
