'use strict';
// ===================== TIẾN LÊN MIỀN NAM =====================
// Luật chi tiết: docs/luat-choi/tien-len.md
const { newDeck, shuffle, parse } = require('./cards');

const TL_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const TL_SUITS = ['S', 'C', 'D', 'H']; // Bích < Chuồn < Rô < Cơ
const TWO = 12; // chỉ số hạng của quân 2 (heo)

const rankIdx = (c) => TL_RANKS.indexOf(parse(c).rank);
const suitIdx = (c) => TL_SUITS.indexOf(parse(c).suit);
const value = (c) => rankIdx(c) * 4 + suitIdx(c);
const sortCards = (cards) => cards.slice().sort((a, b) => value(a) - value(b));

const TYPE_NAMES = {
  single: 'Rác (1 lá)',
  pair: 'Đôi',
  triple: 'Sám (bộ ba)',
  quad: 'Tứ quý',
  straight: 'Sảnh',
  dstraight: 'Đôi thông',
};

/** Xác định loại bộ bài. Trả về null nếu không hợp lệ. */
function classify(cards) {
  if (!cards || !cards.length) return null;
  const s = sortCards(cards);
  const n = s.length;
  const ranks = s.map(rankIdx);
  const top = value(s[n - 1]);
  const allSame = ranks.every((r) => r === ranks[0]);
  if (n === 1) return { type: 'single', n, top, rank: ranks[0] };
  if (allSame && n === 2) return { type: 'pair', n, top, rank: ranks[0] };
  if (allSame && n === 3) return { type: 'triple', n, top, rank: ranks[0] };
  if (allSame && n === 4) return { type: 'quad', n, top, rank: ranks[0] };
  // Sảnh: >= 3 lá liên tiếp, không có heo
  if (n >= 3 && !ranks.includes(TWO)) {
    let ok = true;
    for (let i = 1; i < n; i++) if (ranks[i] !== ranks[i - 1] + 1) ok = false;
    if (ok) return { type: 'straight', n, top, rank: ranks[n - 1] };
  }
  // Đôi thông: >= 3 đôi liên tiếp, không có heo
  if (n >= 6 && n % 2 === 0 && !ranks.includes(TWO)) {
    let ok = true;
    for (let i = 0; i < n; i += 2) {
      if (ranks[i] !== ranks[i + 1]) ok = false;
      if (i > 0 && ranks[i] !== ranks[i - 2] + 1) ok = false;
    }
    if (ok) return { type: 'dstraight', n, pairs: n / 2, top, rank: ranks[n - 1] };
  }
  return null;
}

/** Bộ `play` có chặn được bộ `prev` không. Trả về 'normal' | 'chat' (chặt) | false. */
function canBeat(play, prev) {
  if (!play) return false;
  if (!prev) return 'normal';
  if (play.type === prev.type && play.n === prev.n) return play.top > prev.top ? 'normal' : false;
  const prevIsSingle2 = prev.type === 'single' && prev.rank === TWO;
  const prevIsPair2 = prev.type === 'pair' && prev.rank === TWO;
  const isDs = (c, k) => c.type === 'dstraight' && c.pairs === k;
  // 3 đôi thông chặt 1 heo
  if (isDs(play, 3) && prevIsSingle2) return 'chat';
  // Tứ quý chặt: 1 heo, đôi heo, 3 đôi thông
  if (play.type === 'quad' && (prevIsSingle2 || prevIsPair2 || isDs(prev, 3))) return 'chat';
  // 4 đôi thông chặt: 1 heo, đôi heo, 3 đôi thông, tứ quý
  if (isDs(play, 4) && (prevIsSingle2 || prevIsPair2 || isDs(prev, 3) || prev.type === 'quad')) return 'chat';
  return false;
}

/** Kiểm tra tới trắng (thắng ngay khi chia bài, chỉ áp dụng khi đủ 13 lá). */
function checkInstantWin(hand) {
  if (hand.length !== 13) return null;
  const counts = new Array(13).fill(0);
  hand.forEach((c) => counts[rankIdx(c)]++);
  if (counts[TWO] === 4) return 'Tứ quý heo';
  if (counts.slice(0, 12).every((x) => x >= 1)) return 'Sảnh rồng (3 → A)';
  const pairs = counts.reduce((s, x) => s + Math.floor(x / 2), 0);
  if (pairs >= 6) return '6 đôi';
  // 5 đôi thông
  let run = 0;
  for (let r = 0; r < 12; r++) {
    run = counts[r] >= 2 ? run + 1 : 0;
    if (run >= 5) return '5 đôi thông';
  }
  return null;
}

function combinations(arr, k) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length === k) return out.push(cur.slice());
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

/** Sinh các bộ có thể đánh từ bài trên tay (dùng cho nút Gợi ý). */
function generateCombos(hand) {
  const byRank = Array.from({ length: 13 }, () => []);
  sortCards(hand).forEach((c) => byRank[rankIdx(c)].push(c));
  const out = [];
  hand.forEach((c) => out.push([c]));
  byRank.forEach((g) => {
    for (const k of [2, 3, 4]) if (g.length >= k) combinations(g, k).forEach((x) => out.push(x));
  });
  for (let start = 0; start < 12; start++) {
    // sảnh
    const st = [];
    for (let r = start; r < 12 && byRank[r].length; r++) {
      st.push(byRank[r][0]);
      if (st.length >= 3) byRank[r].forEach((topCard) => out.push([...st.slice(0, -1), topCard]));
    }
    // đôi thông
    const ds = [];
    for (let r = start; r < 12 && byRank[r].length >= 2; r++) {
      ds.push(byRank[r][0], byRank[r][1]);
      if (ds.length >= 6) {
        const g = byRank[r];
        out.push([...ds.slice(0, -2), g[g.length - 2], g[g.length - 1]]);
        out.push(ds.slice());
      }
    }
  }
  return out;
}

// Điểm theo hạng (cộng ngay khi về đích)
const SCORE_TABLE = { 2: [1, -1], 3: [2, 0, -2], 4: [3, 1, -1, -3] };
const PLACE_NAMES = ['Nhất', 'Nhì', 'Ba', 'Bét'];
const SUIT_SYM = { S: '♠', C: '♣', D: '♦', H: '♥' };
const cardText = (c) => c.slice(0, -1) + SUIT_SYM[c.slice(-1)];

/** Điểm của heo: heo đen (♠ ♣) 2, heo đỏ (♦ ♥) 3. */
const heoPts = (c) => (rankIdx(c) === TWO ? (/[SC]$/.test(c) ? 2 : 3) : 0);

/** Giá trị của bộ bị chặt (người bị chặt phải đền cho người chặt). */
function chopValue(combo, cards) {
  if (combo.type === 'single' || combo.type === 'pair') return cards.reduce((t, c) => t + heoPts(c), 0);
  if (combo.type === 'quad') return 4;
  if (combo.type === 'dstraight') return combo.pairs >= 4 ? 5 : 3;
  return 0;
}

/** Bài "thối" còn trên tay người về bét: heo, tứ quý, đôi thông. */
function thoiItems(hand) {
  const items = [];
  hand.filter((c) => rankIdx(c) === TWO).forEach((c) => items.push({ what: `heo ${cardText(c)}`, pts: heoPts(c) }));
  const cnt = new Array(13).fill(0);
  hand.forEach((c) => cnt[rankIdx(c)]++);
  for (let r = 0; r < 12; r++) if (cnt[r] === 4) { items.push({ what: `tứ quý ${TL_RANKS[r]}`, pts: 4 }); cnt[r] = 0; }
  let run = 0;
  for (let r = 0; r <= 12; r++) {
    if (r < 12 && cnt[r] >= 2) { run++; continue; }
    if (run >= 3) items.push({ what: `${run} đôi thông`, pts: run >= 4 ? 5 : 3 });
    run = 0;
  }
  return items;
}

class TienLen {
  static meta = { id: 'tienlen', name: 'Tiến Lên Miền Nam', minPlayers: 2, maxPlayers: 4 };

  constructor(players, opts = {}) {
    this.rng = opts.rng || Math.random;
    this.players = players.map((p) => ({ id: p.id, name: p.name, hand: [], finished: false, place: 0, score: 0 }));
    this.gameNo = 0;
    this.lastWinner = null;
    this.log = [];
    this.deal();
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 60) this.log.shift();
  }

  deal() {
    this.gameNo++;
    const deck = shuffle(newDeck(), this.rng);
    this.players.forEach((p, i) => {
      p.hand = sortCards(deck.slice(i * 13, i * 13 + 13));
      p.finished = false;
      p.place = 0;
      p.burned = false;
      p.delta = 0; // điểm được/mất trong ván này
      p.items = []; // chi tiết từng khoản
    });
    this.phase = 'playing';
    this.lastPlay = null;
    this.passed = new Set();
    this.played = []; // các lá đã đánh ra trong ván (thông tin công khai — máy "Khó" dùng để đếm bài)
    this.nextPlace = 1;
    this.lastFree = this.players.length; // hạng cuối còn trống (dành cho người bị cháy)
    this.requiredCard = null;
    this.result = null;
    this.addLog(`— Ván ${this.gameNo} bắt đầu —`);

    // Tới trắng
    for (const p of this.players) {
      const why = checkInstantWin(p.hand);
      if (why) {
        this.addLog(`🎉 ${p.name} TỚI TRẮNG với ${why}!`);
        const n = this.players.length;
        const pay = 2 * Math.abs(SCORE_TABLE[n][n - 1]); // mỗi người thua đền gấp đôi bét
        this.players.forEach((q) => {
          q.place = q === p ? 1 : 2;
          q.finished = true;
          if (q !== p) this.transfer(q, p, pay, `${p.name} tới trắng`, `Tới trắng (${why}) — ${q.name} đền`);
        });
        this.lastWinner = p.id;
        this.phase = 'ended';
        this.result = { instantWin: { player: p.name, why } };
        this.endGame();
        return;
      }
    }

    if (this.gameNo === 1 || !this.lastWinner) {
      // Ván đầu: người giữ lá nhỏ nhất (thường là 3♠) đi trước, phải đánh kèm lá đó
      let best = null;
      this.players.forEach((p, i) => {
        const c = p.hand[0];
        if (!best || value(c) < value(best.card)) best = { i, card: c };
      });
      this.turn = best.i;
      this.requiredCard = best.card;
      this.addLog(`${this.players[best.i].name} giữ lá nhỏ nhất nên đi trước.`);
    } else {
      this.turn = Math.max(0, this.players.findIndex((p) => p.id === this.lastWinner));
      this.addLog(`${this.players[this.turn].name} thắng ván trước nên đi trước.`);
    }
  }

  idx(playerId) {
    const i = this.players.findIndex((p) => p.id === playerId);
    if (i < 0) throw new Error('Bạn không ở trong ván này.');
    return i;
  }

  action(playerId, a) {
    if (a.type === 'next') {
      if (this.phase !== 'ended') throw new Error('Ván chưa kết thúc.');
      this.deal();
      return;
    }
    if (this.phase !== 'playing') throw new Error('Ván đã kết thúc.');
    const i = this.idx(playerId);
    if (i !== this.turn) throw new Error('Chưa tới lượt bạn.');
    const p = this.players[i];
    if (a.type === 'play') return this.play(i, a.cards || []);
    if (a.type === 'pass') {
      if (!this.lastPlay) throw new Error('Bạn đang cầm vòng, phải đánh ra một bộ.');
      this.passed.add(p.id);
      this.addLog(`${p.name} bỏ lượt.`);
      this.advance(i);
      return;
    }
    throw new Error('Hành động không hợp lệ.');
  }

  play(i, cards) {
    const p = this.players[i];
    if (new Set(cards).size !== cards.length) throw new Error('Lá bài bị trùng.');
    for (const c of cards) if (!p.hand.includes(c)) throw new Error('Bạn không có lá ' + c + '.');
    const combo = classify(cards);
    if (!combo) throw new Error('Bộ bài không hợp lệ (phải là rác, đôi, sám, tứ quý, sảnh hoặc đôi thông).');
    if (this.requiredCard && !cards.includes(this.requiredCard)) {
      throw new Error('Lượt đầu tiên phải đánh kèm lá nhỏ nhất của bạn.');
    }
    const beat = canBeat(combo, this.lastPlay && this.lastPlay.combo);
    if (!beat) {
      const prev = this.lastPlay.combo;
      throw new Error(`Không chặn được ${TYPE_NAMES[prev.type]}. Cần cùng loại, cùng số lá và lớn hơn.`);
    }
    this.requiredCard = null;
    p.hand = p.hand.filter((c) => !cards.includes(c));
    this.played.push(...cards);
    const sorted = sortCards(cards);
    const prev = this.lastPlay;
    this.lastPlay = { by: p.id, byName: p.name, cards: sorted, combo, label: TYPE_NAMES[combo.type], stake: 0 };
    this.addLog(`${p.name} đánh ${TYPE_NAMES[combo.type]}: ${sorted.map(cardText).join(' ')}${beat === 'chat' ? ' 💥 CHẶT!' : ''}`);

    // Chặt: người bị chặt đền ngay; chặt chồng thì người bị chặt sau cùng đền cả phần trước
    if (beat === 'chat') {
      const victim = this.players.find((q) => q.id === prev.by);
      const stake = chopValue(prev.combo, prev.cards) + (prev.stake || 0);
      this.lastPlay.stake = stake;
      if (victim && stake) {
        const what = `${prev.label.toLowerCase()} ${prev.cards.map(cardText).join(' ')}`;
        const chong = prev.stake ? ' (chặt chồng)' : '';
        this.transfer(victim, p, stake, `Bị ${p.name} chặt ${what}${chong}`, `Chặt ${what} của ${victim.name}${chong}`);
        this.addLog(`💸 ${victim.name} bị chặt, đền ${stake} điểm cho ${p.name}.`);
      }
    }

    if (p.hand.length === 0) {
      const n = this.players.length;
      p.finished = true;
      p.place = this.nextPlace++;
      this.award(p, SCORE_TABLE[n][p.place - 1], `Về ${PLACE_NAMES[p.place - 1]}`);
      this.addLog(`🏁 ${p.name} về ${p.place === 1 ? 'NHẤT' : PLACE_NAMES[p.place - 1].toLowerCase()}!`);
      if (p.place === 1) {
        this.lastWinner = p.id;
        // Cháy bài: ai chưa đánh lá nào thì dừng, xếp cuối, bị phạt gấp đôi
        const fine = Math.abs(SCORE_TABLE[n][n - 1]);
        this.players.filter((q) => !q.finished && q.hand.length === 13).forEach((q) => {
          q.finished = true;
          q.burned = true;
          q.place = this.lastFree--;
          this.award(q, SCORE_TABLE[n][q.place - 1], `Về ${PLACE_NAMES[q.place - 1]} (cháy)`);
          this.transfer(q, p, fine, 'Cháy bài — phạt gấp đôi', `${q.name} cháy bài`);
          this.addLog(`🔥 ${q.name} bị CHÁY BÀI (chưa đánh được lá nào)!`);
        });
      }
      const left = this.players.filter((q) => !q.finished);
      if (left.length <= 1) {
        if (left.length === 1) {
          const last = left[0];
          last.finished = true;
          last.place = this.nextPlace++;
          this.award(last, SCORE_TABLE[n][last.place - 1], `Về ${PLACE_NAMES[last.place - 1]}`);
          this.addLog(`${last.name} về bét.`);
          // Thối bài: còn heo / tứ quý / đôi thông trên tay → đền cho người về Nhất
          const winner = this.players.find((q) => q.place === 1);
          for (const it of thoiItems(last.hand)) {
            this.transfer(last, winner, it.pts, `Thối ${it.what}`, `${last.name} thối ${it.what}`);
            this.addLog(`💸 ${last.name} thối ${it.what}, đền ${it.pts} điểm.`);
          }
        }
        this.endGame();
        return;
      }
    }
    this.advance(i);
  }

  advance(fromIdx) {
    const n = this.players.length;
    const contenders = this.players.filter(
      (q) => !q.finished && !this.passed.has(q.id) && q.id !== this.lastPlay.by
    );
    if (contenders.length === 0) {
      // Hết vòng — người đánh cuối cùng được đi tiếp (nếu đã về thì người kế tiếp)
      let start = this.players.findIndex((q) => q.id === this.lastPlay.by);
      if (this.players[start].finished) {
        do start = (start + 1) % n; while (this.players[start].finished);
      }
      this.passed = new Set();
      this.lastPlay = null;
      this.turn = start;
      this.addLog(`Vòng mới — ${this.players[start].name} được đánh tự do.`);
      return;
    }
    let j = fromIdx;
    do j = (j + 1) % n; while (this.players[j].finished || this.passed.has(this.players[j].id));
    this.turn = j;
  }

  /** Cộng/trừ điểm kèm lý do (hiện trong bảng kết quả). */
  award(p, pts, label) {
    if (!pts) return;
    p.score += pts;
    p.delta = (p.delta || 0) + pts;
    (p.items = p.items || []).push({ label, pts });
  }

  /** Chuyển điểm giữa 2 người (tổng cả bàn luôn bằng 0). */
  /** Chuyển điểm giữa 2 người (tổng cả bàn luôn bằng 0); mỗi bên có mô tả riêng theo góc nhìn của mình. */
  transfer(from, to, pts, labelFrom, labelTo = labelFrom) {
    if (!pts || from === to) return;
    this.award(from, -pts, labelFrom);
    this.award(to, pts, labelTo);
  }

  endGame() {
    this.phase = 'ended';
    this.result = {
      ...(this.result || {}),
      ranking: this.players.slice().sort((a, b) => a.place - b.place).map((p) => ({
        id: p.id, name: p.name, place: p.place, burned: p.burned, delta: p.delta, total: p.score, items: p.items,
      })),
    };
  }

  hint(playerId) {
    const p = this.players[this.idx(playerId)];
    let options = generateCombos(p.hand)
      .map((cards) => ({ cards, combo: classify(cards) }))
      .filter((o) => o.combo && canBeat(o.combo, this.lastPlay && this.lastPlay.combo));
    if (this.requiredCard) options = options.filter((o) => o.cards.includes(this.requiredCard));
    if (!options.length) return null;
    options.sort((a, b) => a.combo.top - b.combo.top || b.cards.length - a.cards.length);
    // Khi đang cầm vòng, ưu tiên bộ nhiều lá nhất có lá nhỏ nhất
    if (!this.lastPlay) {
      options.sort((a, b) => value(sortCards(a.cards)[0]) - value(sortCards(b.cards)[0]) || b.cards.length - a.cards.length);
    }
    return options[0].cards;
  }

  getState(playerId) {
    const me = this.players.find((p) => p.id === playerId);
    return {
      game: 'tienlen',
      phase: this.phase,
      gameNo: this.gameNo,
      turn: this.players[this.turn] ? this.players[this.turn].id : null,
      myHand: me ? me.hand : [],
      requiredCard: me && this.players[this.turn] && this.players[this.turn].id === me.id ? this.requiredCard : null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, count: p.hand.length, finished: p.finished, place: p.place,
        score: p.score, delta: p.delta || 0, burned: !!p.burned, passed: this.passed.has(p.id),
        // Lật bài khi ván kết thúc
        hand: this.phase === 'ended' ? p.hand : undefined,
      })),
      lastPlay: this.lastPlay ? { by: this.lastPlay.by, byName: this.lastPlay.byName, cards: this.lastPlay.cards, label: this.lastPlay.label } : null,
      result: this.result,
      log: this.log.slice(-30),
    };
  }

  // Người chơi rời phòng giữa ván: tự động bỏ lượt cho họ
  playerLeft(playerId) {
    const i = this.players.findIndex((p) => p.id === playerId);
    if (i < 0 || this.phase !== 'playing') return;
    if (i === this.turn && this.lastPlay) this.action(playerId, { type: 'pass' });
  }
}

module.exports = { TienLen, classify, canBeat, checkInstantWin, sortCards, value, generateCombos };
