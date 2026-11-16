'use strict';
// ===================== MÁY CHƠI (AI) =====================
// 3 chế độ, khác nhau rõ rệt nhưng chế độ Dễ vẫn chơi có lý (không đánh bừa):
//   easy   (Dễ):  chơi đúng luật + chiến thuật cơ bản, hay mạo hiểm, không tính xa
//   medium (Vừa): giữ cấu trúc bài / bài mạnh, tính tỉ lệ, tránh nước nguy hiểm
//   hard   (Khó): đếm bài, mô phỏng xác suất kỹ, canh đối thủ, quản lý rủi ro
// Máy chỉ dùng thông tin công khai + bài của chính nó (không nhìn trộm bài người khác).

const TL = require('./games/tienlen');
const PK = require('./games/poker');
const CN = require('./games/cangua');
const TP = require('./games/typhu');
const { newDeck } = require('./games/cards');

const LEVELS = {
  easy: { label: 'Dễ', emoji: '🟢' },
  medium: { label: 'Vừa', emoji: '🟡' },
  hard: { label: 'Khó', emoji: '🔴' },
};
const rnd = Math.random;
// Tham số Tiến Lên cho chế độ Khó (được tinh chỉnh bằng test/bot-sim.js)
const TUNE = { powerOpp: 5, breakOpp: 8, next: true, master: true, mediumSlip: 0.2, searchCards: 8, rollouts: 14, topK: 4 };

// =========================================================================
// TIẾN LÊN
// =========================================================================
const tlRank = (c) => Math.floor(TL.value(c) / 4); // 0 = 3 ... 12 = heo (2)

/** Ước lượng số "lượt" cần để đánh hết bài (càng ít càng tốt). Heo và Át lẻ được tính nhẹ vì dễ thắng vòng. */
function tlMoves(cards) {
  const cnt = new Array(13).fill(0);
  cards.forEach((c) => cnt[tlRank(c)]++);
  let moves = 0;
  for (let r = 0; r < 13; r++) if (cnt[r] === 4) { moves += 1; cnt[r] = 0; }
  // Sảnh: lấy dần sảnh dài nhất nếu không phá quá nhiều đôi
  for (;;) {
    let best = null;
    for (let s = 0; s < 12; s++) {
      let e = s;
      while (e < 12 && cnt[e] > 0) e++;
      const len = e - s;
      if (len >= 3) {
        const loose = cnt.slice(s, e).filter((x) => x === 1 || x === 3).length;
        if (loose >= 2 && (!best || len > best.len)) best = { s, len };
      }
    }
    if (!best) break;
    for (let r = best.s; r < best.s + best.len; r++) cnt[r]--;
    moves += 1;
  }
  for (let r = 0; r < 13; r++) {
    if (!cnt[r]) continue;
    moves += r >= 11 ? 0.55 : 1; // A, heo: gần như chắc thắng vòng
  }
  return moves;
}

function tlCandidates(game, me) {
  const prev = game.lastPlay && game.lastPlay.combo;
  let out = TL.generateCombos(me.hand)
    .map((cards) => ({ cards, combo: TL.classify(cards) }))
    .filter((o) => o.combo && TL.canBeat(o.combo, prev));
  if (game.requiredCard) out = out.filter((o) => o.cards.includes(game.requiredCard));
  // bỏ trùng
  const seen = new Set();
  return out.filter((o) => { const k = TL.sortCards(o.cards).join(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Lá/bộ này có còn ai chặn được không (dựa trên các lá chưa lộ). Dùng cho chế độ Khó. */
function tlIsMaster(o, unseen) {
  const c = o.combo;
  if (c.type === 'single') return !unseen.some((u) => TL.value(u) > c.top);
  if (c.type === 'pair' || c.type === 'triple') {
    const need = c.n;
    const byRank = {};
    unseen.forEach((u) => { (byRank[tlRank(u)] = byRank[tlRank(u)] || []).push(TL.value(u)); });
    return !Object.entries(byRank).some(([r, vals]) => vals.length >= need && (Number(r) > c.rank || (Number(r) === c.rank && Math.max(...vals) > c.top)));
  }
  return c.type === 'quad' || c.type === 'dstraight' || c.n >= 6;
}

function tlHeuristic(game, id, level) {
  if (game.phase !== 'playing') return null;
  const i = game.players.findIndex((p) => p.id === id);
  if (i !== game.turn) return null;
  const me = game.players[i];
  const cands = tlCandidates(game, me);
  const leading = !game.lastPlay;
  if (!cands.length) return leading ? null : { type: 'pass' };

  const opponents = game.players.filter((p) => p.id !== id && !p.finished);
  const minOpp = Math.min(...opponents.map((p) => p.hand.length));

  // ---- DỄ: chặn bằng bộ nhỏ nhất, cầm vòng thì đổ bộ chứa lá nhỏ nhất; thỉnh thoảng nhường ----
  // (Vừa thỉnh thoảng cũng "sơ suất" đánh theo kiểu này)
  if (level === 'easy' || (level === 'medium' && rnd() < TUNE.mediumSlip)) {
    let pick;
    if (leading) {
      const low = Math.min(...cands.map((o) => TL.value(TL.sortCards(o.cards)[0])));
      pick = cands.filter((o) => TL.value(TL.sortCards(o.cards)[0]) === low).sort((a, b) => b.cards.length - a.cards.length)[0];
    } else {
      pick = cands.slice().sort((a, b) => a.combo.top - b.combo.top)[0];
      const usesTwo = pick.cards.some((c) => tlRank(c) === 12);
      if (level === 'easy' && rnd() < (usesTwo ? 0.35 : 0.08) && minOpp > 2) return { type: 'pass' };
    }
    return { type: 'play', cards: pick.cards };
  }

  // ---- VỪA / KHÓ: chọn bộ giữ được cấu trúc bài tốt nhất ----
  const hard = level === 'hard';
  const unseen = hard ? TL.sortCards(newDeck().filter((c) => !me.hand.includes(c) && !game.played.includes(c))) : [];
  const nextIdx = (() => { let j = i; do j = (j + 1) % game.players.length; while (game.players[j].finished && j !== i); return j; })();
  const nextCount = game.players[nextIdx].hand.length;
  const baseMoves = tlMoves(me.hand);

  const scored = cands.map((o) => {
    const rest = me.hand.filter((c) => !o.cards.includes(c));
    if (!rest.length) return { o, cost: -1000 }; // đánh hết bài: thắng!
    let cost = tlMoves(rest) * 10;
    for (const c of o.cards) { const r = tlRank(c); if (r === 12) cost += 9; else if (r === 11) cost += 2.5; }
    const bomb = o.combo.type === 'quad' || o.combo.type === 'dstraight';
    const chop = game.lastPlay && TL.canBeat(o.combo, game.lastPlay.combo) === 'chat';
    if (bomb && !chop) cost += 14;
    if (chop) cost -= 6; // chặt heo là có lời
    if (leading) cost -= o.cards.length * 0.9; else cost += o.combo.top / 25;
    if (hard) {
      // Người kế tiếp sắp hết bài: đừng cầm vòng bằng rác thấp
      if (TUNE.next && leading && nextCount === 1 && o.combo.type === 'single' && !tlIsMaster(o, unseen)) cost += 25 - o.combo.top / 4;
      if (TUNE.next && !leading && nextCount === 1 && game.lastPlay.combo.type === 'single') cost -= o.combo.top / 6; // chặn bằng lá to nhất
      // Còn ít bộ: đánh bộ "chắc thắng" trước để giữ quyền đánh
      if (TUNE.master && leading && tlMoves(rest) <= 1.6 && tlIsMaster(o, unseen)) cost -= 12;
    }
    return { o, cost };
  }).sort((a, b) => a.cost - b.cost);

  const best = scored[0];
  if (!leading && best.cost > -1000) {
    const usesPower = best.o.cards.some((c) => tlRank(c) === 12) || ['quad', 'dstraight'].includes(best.o.combo.type);
    const restMoves = tlMoves(me.hand.filter((c) => !best.o.cards.includes(c)));
    const chop = TL.canBeat(best.o.combo, game.lastPlay.combo) === 'chat';
    // Giữ heo / bom khi đối thủ còn nhiều bài
    if (usesPower && !chop && minOpp > (hard ? TUNE.powerOpp : 3) && restMoves > 2) return { type: 'pass' };
    // Không phá bộ đẹp chỉ để chặn khi chưa cần
    if (restMoves * 10 - baseMoves * 10 > 9 && minOpp > (hard ? TUNE.breakOpp : 6)) return { type: 'pass' };
  }
  return { type: 'play', cards: best.o.cards };
}

/** Chép trạng thái ván để chơi thử; bài đối thủ được chia lại ngẫu nhiên từ các lá chưa lộ. */
function tlClone(game, meId) {
  const g = Object.create(TL.TienLen.prototype);
  const me = game.players.find((p) => p.id === meId);
  const unseen = newDeck().filter((c) => !me.hand.includes(c) && !game.played.includes(c));
  for (let k = unseen.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [unseen[k], unseen[j]] = [unseen[j], unseen[k]]; }
  let off = 0;
  g.players = game.players.map((p) => {
    let hand = p.hand.slice();
    if (p.id !== meId) { hand = TL.sortCards(unseen.slice(off, off + p.hand.length)); off += p.hand.length; }
    return { id: p.id, name: p.name, hand, finished: p.finished, place: p.place, score: 0, delta: 0, items: [], burned: p.burned };
  });
  Object.assign(g, {
    rng: rnd, gameNo: game.gameNo, lastWinner: game.lastWinner, log: [], phase: game.phase, turn: game.turn,
    lastPlay: game.lastPlay ? { ...game.lastPlay } : null, passed: new Set(game.passed), played: game.played.slice(),
    nextPlace: game.nextPlace, lastFree: game.lastFree, requiredCard: game.requiredCard, result: null,
  });
  g.addLog = () => {};
  return g;
}

/** Chơi thử tới khi mình về đích; trả về điểm (về nhất = cao nhất). */
function tlRollout(g, meId) {
  const n = g.players.length;
  for (let guard = 0; guard < 400 && g.phase === 'playing'; guard++) {
    const me = g.players.find((p) => p.id === meId);
    if (me.finished) break;
    const cur = g.players[g.turn];
    const a = tlHeuristic(g, cur.id, 'medium') || { type: 'pass' };
    try { g.action(cur.id, a); } catch (e) { try { g.action(cur.id, { type: 'pass' }); } catch (e2) { break; } }
  }
  const me = g.players.find((p) => p.id === meId);
  const place = me.place || n;
  return (n - place) / (n - 1);
}

function tienlenBot(game, id, level) {
  const base = tlHeuristic(game, id, level);
  if (level !== 'hard' || !base || game.phase !== 'playing') return base;
  const me = game.players.find((p) => p.id === id);
  if (me.hand.length > TUNE.searchCards) return base;
  // Khó: tìm kiếm Monte Carlo ở cuối ván
  const opts = [];
  const leading = !game.lastPlay;
  const cands = tlCandidates(game, me);
  const seen = new Set();
  const add = (a) => { const k = a.type + (a.cards ? TL.sortCards(a.cards).join() : ''); if (!seen.has(k)) { seen.add(k); opts.push(a); } };
  add(base);
  if (!leading) add({ type: 'pass' });
  // các bộ hứa hẹn: bộ lớn nhất, bộ nhỏ nhất, bộ nhiều lá nhất
  const byTop = cands.slice().sort((a, b) => a.combo.top - b.combo.top);
  if (byTop.length) { add({ type: 'play', cards: byTop[0].cards }); add({ type: 'play', cards: byTop[byTop.length - 1].cards }); }
  const byLen = cands.slice().sort((a, b) => b.cards.length - a.cards.length);
  if (byLen.length) add({ type: 'play', cards: byLen[0].cards });
  if (opts.length === 1) return base;
  let best = base; let bestV = -1;
  for (const a of opts.slice(0, TUNE.topK + 1)) {
    let v = 0;
    for (let r = 0; r < TUNE.rollouts; r++) {
      const g = tlClone(game, id);
      try { g.action(id, a); } catch (e) { v = -1e9; break; }
      v += tlRollout(g, id);
    }
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

// =========================================================================
// POKER
// =========================================================================
// Chấm nhanh tay 7 lá (dùng cho mô phỏng): trả về 1 số, số lớn hơn = bài mạnh hơn.
const PK_RANK = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const PK_SUIT = { S: 0, C: 1, D: 2, H: 3 };
const pkCode = (c) => PK_RANK[c.slice(0, -1)] * 4 + PK_SUIT[c.slice(-1)];
function straightTop(mask) {
  // mask: bit r bật nếu có hạng r (2..14); A cũng tính là 1
  if (mask & (1 << 14)) mask |= 1 << 1;
  for (let top = 14; top >= 5; top--) {
    const need = (0b11111 << (top - 4));
    if ((mask & need) === need) return top;
  }
  return 0;
}
function pkFast7(codes) {
  const cnt = new Array(15).fill(0);
  const suitMask = [0, 0, 0, 0];
  const suitCnt = [0, 0, 0, 0];
  let mask = 0;
  for (const x of codes) { const r = x >> 2; const su = x & 3; cnt[r]++; suitMask[su] |= 1 << r; suitCnt[su]++; mask |= 1 << r; }
  const B = 15;
  const pack = (cat, ks) => { let v = cat; for (let k = 0; k < 5; k++) v = v * B + (ks[k] || 0); return v; };
  for (let su = 0; su < 4; su++) {
    if (suitCnt[su] >= 5) {
      const sf = straightTop(suitMask[su]);
      if (sf) return pack(8, [sf]);
    }
  }
  const quads = []; const trips = []; const pairs = []; const singles = [];
  for (let r = 14; r >= 2; r--) {
    if (cnt[r] === 4) quads.push(r); else if (cnt[r] === 3) trips.push(r); else if (cnt[r] === 2) pairs.push(r); else if (cnt[r] === 1) singles.push(r);
  }
  if (quads.length) { const k = [...trips, ...pairs, ...singles].sort((a, b) => b - a)[0]; return pack(7, [quads[0], k]); }
  if (trips.length && (trips.length > 1 || pairs.length)) { const p2 = Math.max(trips[1] || 0, pairs[0] || 0); return pack(6, [trips[0], p2]); }
  for (let su = 0; su < 4; su++) {
    if (suitCnt[su] >= 5) { const ks = []; for (let r = 14; r >= 2 && ks.length < 5; r--) if (suitMask[su] & (1 << r)) ks.push(r); return pack(5, ks); }
  }
  const st = straightTop(mask);
  if (st) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...[...pairs, ...singles].sort((a, b) => b - a).slice(0, 2)]);
  if (pairs.length >= 2) { const k = [...pairs.slice(2), ...singles].sort((a, b) => b - a)[0]; return pack(2, [pairs[0], pairs[1], k]); }
  if (pairs.length) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}

/** Ước lượng tỉ lệ thắng bằng mô phỏng Monte Carlo (chỉ biết bài mình + bài chung). */
function pkEquity(hole, board, nOpp, iters) {
  const known = new Set([...hole, ...board]);
  const deck = newDeck().filter((c) => !known.has(c)).map(pkCode);
  const myBase = [...hole, ...board].map(pkCode);
  const boardC = board.map(pkCode);
  const need = nOpp * 2 + (5 - board.length);
  let score = 0;
  for (let it = 0; it < iters; it++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rnd() * (deck.length - k));
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    const extra = deck.slice(nOpp * 2, need);
    const mine = pkFast7(myBase.concat(extra));
    const full = boardC.concat(extra);
    let best = 1;
    for (let o = 0; o < nOpp && best > 0; o++) {
      const theirs = pkFast7([deck[o * 2], deck[o * 2 + 1], ...full]);
      if (theirs > mine) best = 0; else if (theirs === mine) best = Math.min(best, 0.5);
    }
    score += best;
  }
  return score / iters;
}

const PK_LEVEL = {
  easy: { iters: 70, strong: 2.3, call: -0.06, bluff: 0.03, size: [0.4, 0.6] },
  medium: { iters: 220, strong: 1.8, call: 0.0, bluff: 0.06, size: [0.5, 0.8] },
  hard: { iters: 450, strong: 1.5, call: 0.02, bluff: 0.11, size: [0.55, 1.0] },
};

function pokerBot(game, id, level) {
  const me = game.players.find((p) => p.id === id);
  if (game.phase !== 'betting') return me.chips === 0 ? { type: 'rebuy' } : null;
  if (game.players[game.turn] !== me) return null;
  const s = game.getState(id);
  const o = s.options;
  const L = PK_LEVEL[level] || PK_LEVEL.medium;
  const nOpp = game.players.filter((p) => p !== me && !p.folded).length;
  const eq = pkEquity(me.hole, game.community, Math.max(1, nOpp), L.iters);
  const fair = 1 / (nOpp + 1); // tỉ lệ "trung bình"
  const strong = eq > Math.min(0.88, fair * L.strong);
  const pot = o.pot;
  const toCall = o.toCall;
  const raiseTo = (frac) => {
    const target = o.currentBet + Math.max(game.bb, Math.round((pot * frac) / game.sb) * game.sb);
    const amt = Math.min(o.maxRaiseTo, Math.max(o.minRaiseTo, target));
    return amt >= o.maxRaiseTo * 0.85 ? { type: 'allin' } : { type: 'raise', amount: amt };
  };
  const size = () => L.size[0] + rnd() * (L.size[1] - L.size[0]);
  const lateStreet = game.street !== 'preflop';

  if (toCall === 0) {
    if (o.canRaise && (strong || (lateStreet && rnd() < L.bluff))) return raiseTo(size());
    return { type: 'check' };
  }
  const potOdds = toCall / (pot + toCall);
  // bài rất mạnh: tố lại
  if (o.canRaise && strong && eq > fair * L.strong * 1.15 && rnd() < (level === 'easy' ? 0.5 : 0.8)) return raiseTo(size());
  // đủ tỉ lệ thì theo
  if (eq >= potOdds + L.call) return { type: 'call' };
  // Dễ: hay theo cho vui khi cược nhỏ
  if (level === 'easy' && toCall <= me.chips * 0.06 && eq > fair * 0.6) return { type: 'call' };
  // Khó: thỉnh thoảng tố lừa ở vòng sau khi ít người
  if (level === 'hard' && o.canRaise && lateStreet && nOpp === 1 && rnd() < L.bluff * 0.6) return raiseTo(0.8);
  return { type: 'fold' };
}

// =========================================================================
// CÁ NGỰA
// =========================================================================
/** Số ngựa đối thủ có thể đá trúng ô tuyệt đối `abs` ở lượt tới (xấp xỉ, bỏ qua cản đường). */
function cnThreat(game, me, abs) {
  let t = 0;
  for (const p of game.players) {
    if (p === me) continue;
    p.horses.forEach((r) => {
      if (r >= 0 && r < 60) {
        const oppAbs = CN.absPos(p.color, r);
        const d = (abs - oppAbs + 60) % 60;
        if (d >= 1 && d <= 6 && r + d <= 59) t += 1;
      }
    });
    if (CN.absPos(p.color, 0) === abs && p.horses.includes(-1)) t += 1.5; // ô xuất quân của đối thủ
  }
  return t;
}

// Trọng số Cá Ngựa (tinh chỉnh bằng test/bot-sim.js): danger = mức né nguy hiểm, noise = độ ngẫu hứng
const CN_W = { easy: { danger: 0, noise: 14 }, medium: { danger: 22, noise: 0 }, hard: { danger: 30, noise: 0 } };

function canguaBot(game, id, level) {
  const p = game.players[game.turn];
  if (!p || p.id !== id || game.phase === 'ended') return null;
  if (game.phase === 'roll') return { type: 'roll' };
  if (!game.moves.length) return null;
  const W = CN_W[level] || CN_W.medium;
  const scored = game.moves.map((m) => {
    const from = p.horses[m.h];
    let s = 0;
    if (m.kick) s += 60 + (level === 'hard' ? m.kick.player.horses[m.kick.h] / 2 : 0);
    if (m.to > 100) s += from > 100 ? 45 : 55; // lên chuồng
    if (from === -1) s += 34 + (p.horses.filter((r) => r >= 0 && r < 60).length === 0 ? 20 : 0);
    if (m.to < 60) s += (m.to - Math.max(from, 0)) * 0.6 + (level === 'hard' ? m.to * 0.12 : 0);
    if (W.danger) {
      if (m.to < 60) s -= cnThreat(game, p, CN.absPos(p.color, m.to)) * W.danger;
      if (from >= 0 && from < 60) s += cnThreat(game, p, CN.absPos(p.color, from)) * W.danger * 0.8; // thoát khỏi chỗ nguy hiểm
      if (level === 'hard' && m.to === 59) s += 12; // tới cửa chuồng: an toàn
    }
    s += (rnd() - 0.5) * W.noise * 2;
    return { m, s };
  }).sort((a, b) => b.s - a.s);
  return { type: 'move', horse: scored[0].m.h };
}

// =========================================================================
// CỜ TỶ PHÚ
// =========================================================================
// Tham số Tỷ Phú cho chế độ Khó (tinh chỉnh bằng test/bot-sim.js)
const TP_TUNE = { earlyOwned: 14, hardEarlyReserve: 100, hardLateCap: 350, hardLateFrac: 0.5, hardBuildRes: 0, hardJailMedium: false, hardBlock: true, hardOrder: true, leverage: true };

function tpOwnedBy(game, id) {
  return Object.entries(game.owned).filter(([, o]) => o.owner === id).map(([pos, o]) => ({ pos: Number(pos), o, sq: TP.BOARD[pos] }));
}

/** Tiền thuê cao nhất mà đối thủ đang có thể thu (để giữ tiền dự trữ). */
function tpMaxRent(game, id) {
  let m = 0;
  for (const [pos, o] of Object.entries(game.owned)) {
    if (o.owner === id || o.mortgaged) continue;
    const sq = TP.BOARD[pos];
    m = Math.max(m, sq.type === 'utility' ? 12 * 10 : game.rentFor(Number(pos), 7));
  }
  return m;
}

function typhuBot(game, id, level) {
  const p = game.byId(id);
  if (!p || p.bankrupt || game.phase === 'ended') return null;
  const mine = tpOwnedBy(game, id);

  // ---- Đang nợ (kể cả không phải lượt mình): bán nhà → cầm cố → phá sản ----
  if (p.money < 0) {
    const withHouses = mine.filter((x) => x.o.houses > 0).sort((a, b) => b.o.houses - a.o.houses);
    if (withHouses.length) {
      const g = withHouses[0];
      const max = Math.max(...game.groupOf(g.pos).map((i) => game.owned[i].houses));
      const pick = game.groupOf(g.pos).find((i) => game.owned[i].houses === max);
      return { type: 'sell_house', pos: pick };
    }
    const canMort = mine.filter((x) => !x.o.mortgaged).sort((a, b) => {
      const fullA = a.sq.group && game.ownsGroup(id, a.pos) ? 1 : 0;
      const fullB = b.sq.group && game.ownsGroup(id, b.pos) ? 1 : 0;
      return fullA - fullB || a.sq.price - b.sq.price;
    });
    if (canMort.length) return { type: 'mortgage', pos: canMort[0].pos };
    return { type: 'bankrupt' };
  }
  if (game.cur() !== p) return null;

  const ownedTotal = Object.keys(game.owned).length;
  const early = ownedTotal < TP_TUNE.earlyOwned;
  const reserve = level === 'easy' ? 60 : level === 'medium' ? 150
    : early ? TP_TUNE.hardEarlyReserve : Math.max(TP_TUNE.hardEarlyReserve, Math.min(TP_TUNE.hardLateCap, tpMaxRent(game, id) * TP_TUNE.hardLateFrac));

  if (game.phase === 'roll') {
    if (p.inJail) {
      const wantOut = level === 'hard' && !TP_TUNE.hardJailMedium ? early : level === 'medium' ? early || p.money > 600 : p.money > 200;
      if (wantOut && p.jailCards) return { type: 'use_card' };
      if (wantOut && p.money >= 50 + reserve / 2) return { type: 'pay_jail' };
    }
    return { type: 'roll' };
  }

  if (game.phase === 'buy') {
    const sq = TP.BOARD[p.pos];
    if (p.money < sq.price) return { type: 'skip_buy' };
    const group = sq.group ? game.groupOf(p.pos) : [];
    const others = group.filter((i) => i !== p.pos);
    const completes = sq.group && others.every((i) => game.owned[i] && game.owned[i].owner === id);
    const blocks = sq.group && others.some((i) => game.owned[i] && game.owned[i].owner !== id);
    const left = p.money - sq.price;
    let buy = left >= reserve;
    if (completes && left >= 20) buy = true;
    if (level === 'hard' && TP_TUNE.hardBlock && blocks && left >= 60) buy = true;
    if (level === 'easy' && left >= 0 && rnd() < 0.7) buy = true; // Dễ: thích mua
    return { type: buy ? 'buy' : 'skip_buy' };
  }

  if (game.phase === 'end') {
    // Xây nhà trên nhóm đã đủ
    const buildable = mine.filter((x) => {
      if (x.sq.type !== 'property' || x.o.mortgaged || x.o.houses >= 5) return false;
      if (!game.ownsGroup(id, x.pos)) return false;
      const grp = game.groupOf(x.pos);
      if (grp.some((i) => game.owned[i].mortgaged)) return false;
      return x.o.houses === Math.min(...grp.map((i) => game.owned[i].houses));
    });
    const maxHouses = level === 'easy' ? 3 : 5;
    const buildRes = level === 'easy' ? 250 : level === 'hard' && TP_TUNE.hardBuildRes ? TP_TUNE.hardBuildRes : reserve;
    const order = buildable.filter((x) => x.o.houses < maxHouses).sort((a, b) =>
      (level === 'hard' && TP_TUNE.hardOrder ? (Math.min(a.o.houses, 3) - Math.min(b.o.houses, 3)) || (b.sq.base - a.sq.base) : a.sq.price - b.sq.price));
    for (const x of order) {
      const cost = TP.GROUPS[x.sq.group].house;
      if (p.money - cost >= buildRes && (level !== 'easy' || rnd() < 0.6)) return { type: 'build', pos: x.pos };
    }
    // Khó: thiếu vốn xây lên 3 nhà → cầm cố đất lẻ (không thuộc nhóm đủ) để dồn tiền xây
    if (level === 'hard' && TP_TUNE.leverage) {
      const target = order.find((x) => x.o.houses < 3);
      if (target && p.money < TP.GROUPS[target.sq.group].house + buildRes) {
        const loose = mine.filter((x) => !x.o.mortgaged && x.o.houses === 0 && !(x.sq.group && game.ownsGroup(id, x.pos)))
          .sort((a, b) => a.sq.price - b.sq.price)[0];
        if (loose) return { type: 'mortgage', pos: loose.pos };
      }
    }
    // Chuộc đất khi dư tiền
    if (level !== 'easy') {
      const mort = mine.filter((x) => x.o.mortgaged).sort((a, b) => a.sq.price - b.sq.price)[0];
      if (mort && p.money - Math.ceil(mort.sq.price * 0.55) > reserve + 200) return { type: 'unmortgage', pos: mort.pos };
    }
    return { type: 'end_turn' };
  }
  return null;
}

// =========================================================================
const BY_GAME = { tienlen: tienlenBot, poker: pokerBot, cangua: canguaBot, typhu: typhuBot };

/** Nước đi của máy `id` ở chế độ `level`, hoặc null nếu chưa tới lượt máy. */
function decide(gameId, game, id, level) {
  const fn = BY_GAME[gameId];
  return fn ? fn(game, id, LEVELS[level] ? level : 'medium') : null;
}

module.exports = { decide, LEVELS, pkEquity, pkFast7, pkCode, tlMoves, TUNE, CN_W, TP_TUNE };
