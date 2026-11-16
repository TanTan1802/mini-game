'use strict';
// Cho máy đấu với nhau để kiểm tra: không đi sai luật, không kẹt ván, và độ khó phân định rõ.
//   node test/bot-sim.js [số-ván]
const { TienLen } = require('../server/games/tienlen');
const { Poker } = require('../server/games/poker');
const { CaNgua } = require('../server/games/cangua');
const { TyPhu } = require('../server/games/typhu');
const Bots = require('../server/bots');

const GAMES = { tienlen: TienLen, poker: Poker, cangua: CaNgua, typhu: TyPhu };

/** Chạy 1 ván với các máy theo `levels`; trả về điểm từng ghế (càng cao càng tốt). */
function playOne(gameId, levels, opts = {}) {
  const players = levels.map((lv, i) => ({ id: 'b' + i, name: lv + i }));
  const g = new GAMES[gameId](players);
  let invalid = 0;
  let steps = 0;
  const maxSteps = opts.maxSteps || 20000;
  const step = () => {
    for (let i = 0; i < levels.length; i++) {
      const a = Bots.decide(gameId, g, 'b' + i, levels[i]);
      if (!a) continue;
      try { g.action('b' + i, a); } catch (e) { invalid++; if (invalid > 50) throw new Error(`${gameId}/${levels[i]}: quá nhiều nước sai: ${e.message} ${JSON.stringify(a)}`); continue; }
      return true;
    }
    return false;
  };
  if (gameId === 'tienlen') {
    const hands = opts.hands || 6;
    for (let h = 0; h < hands; h++) {
      while (g.phase === 'playing') { if (!step()) throw new Error('Tiến Lên kẹt'); if (++steps > maxSteps) throw new Error('quá dài'); }
      if (h < hands - 1) g.action('b0', { type: 'next' });
    }
    return { score: g.players.map((p) => p.score), invalid };
  }
  if (gameId === 'poker') {
    const hands = opts.hands || 40;
    for (let h = 0; h < hands && g.phase !== 'waiting'; h++) {
      while (g.phase === 'betting') { if (!step()) throw new Error('Poker kẹt'); if (++steps > maxSteps) throw new Error('quá dài'); }
      g.players.forEach((p) => { if (p.chips === 0) g.action(p.id, { type: 'rebuy' }); });
      g.action('b0', { type: 'next' });
    }
    return { score: g.players.map((p) => p.chips - 1000 * (1 + p.rebuys)), invalid };
  }
  if (gameId === 'cangua') {
    while (g.phase !== 'ended') { if (!step()) throw new Error('Cá Ngựa kẹt'); if (++steps > maxSteps) throw new Error('quá dài'); }
    return { score: g.players.map((p) => (p.id === g.winner ? 1 : 0)), invalid };
  }
  // Tỷ phú: tối đa 400 lượt, rồi xếp theo tài sản
  while (g.phase !== 'ended' && g.turnNo < (opts.turns || 400)) { if (!step()) throw new Error('Tỷ Phú kẹt ở pha ' + g.phase); if (++steps > maxSteps) throw new Error('quá dài'); }
  return { score: g.players.map((p) => (p.bankrupt ? 0 : g.netWorth(p))), win: g.players.map((p) => (g.phase === 'ended' ? (p.id === g.winner ? 1 : 0) : 0)), invalid };
}

/** Đấu đối kháng 2 chế độ (ngồi xen kẽ, đổi chỗ mỗi ván); trả về tỉ lệ thắng của A. */
function duel(gameId, A, B, n, seats) {
  let winA = 0; let total = 0; let invalid = 0;
  for (let k = 0; k < n; k++) {
    const levels = Array.from({ length: seats }, (_, i) => ((i + k) % 2 === 0 ? A : B));
    const r = playOne(gameId, levels);
    invalid += r.invalid;
    const sum = (lv) => r.score.reduce((s, x, i) => s + (levels[i] === lv ? x : 0), 0);
    const a = sum(A); const b = sum(B);
    if (a > b) winA++; else if (a === b) winA += 0.5;
    total++;
  }
  return { rate: winA / total, invalid };
}

module.exports = { playOne, duel };

if (require.main === module) {
  const N = Number(process.argv[2]) || 60;
  const plan = [
    ['tienlen', 4, N], ['poker', 4, Math.ceil(N / 3)], ['cangua', 2, N * 2], ['typhu', 2, Math.ceil(N / 2)],
  ];
  const names = { tienlen: 'Tiến Lên', poker: 'Poker', cangua: 'Cá Ngựa', typhu: 'Tỷ Phú' };
  for (const [g, seats, n] of plan) {
    const t = Date.now();
    const hm = duel(g, 'hard', 'medium', n, seats);
    const me = duel(g, 'medium', 'easy', n, seats);
    const he = duel(g, 'hard', 'easy', n, seats);
    console.log(`${names[g].padEnd(9)} Khó thắng Vừa ${(hm.rate * 100).toFixed(0).padStart(3)}% | Vừa thắng Dễ ${(me.rate * 100).toFixed(0).padStart(3)}% | Khó thắng Dễ ${(he.rate * 100).toFixed(0).padStart(3)}%  (${n} trận mỗi cặp, nước sai: ${hm.invalid + me.invalid + he.invalid}, ${((Date.now() - t) / 1000).toFixed(0)}s)`);
  }
}
