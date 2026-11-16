'use strict';
// ===================== POKER TEXAS HOLD'EM (No-Limit) =====================
// Luật chi tiết: docs/luat-choi/poker.md
const { newDeck, shuffle, parse } = require('./cards');

const RANK_VAL = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const HAND_NAMES = ['Mậu thầu', 'Một đôi', 'Thú (hai đôi)', 'Sám cô', 'Sảnh', 'Thùng', 'Cù lũ', 'Tứ quý', 'Thùng phá sảnh'];

/** Chấm điểm 5 lá. Trả về mảng điểm so sánh theo thứ tự từ điển. */
function evaluate5(cards) {
  const vals = cards.map((c) => RANK_VAL[parse(c).rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => parse(c).suit);
  const flush = suits.every((s) => s === suits[0]);
  const uniq = [...new Set(vals)];
  let straightTop = 0;
  if (uniq.length === 5) {
    if (vals[0] - vals[4] === 4) straightTop = vals[0];
    else if (vals[0] === 14 && vals[1] === 5) straightTop = 5; // A-2-3-4-5
  }
  const counts = {};
  vals.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  const groups = Object.entries(counts)
    .map(([v, c]) => [Number(v), c])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const g = groups.map((x) => x[0]);
  if (straightTop && flush) return [8, straightTop];
  if (groups[0][1] === 4) return [7, ...g];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, ...g];
  if (flush) return [5, ...vals];
  if (straightTop) return [4, straightTop];
  if (groups[0][1] === 3) return [3, ...g];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...g];
  if (groups[0][1] === 2) return [1, ...g];
  return [0, ...vals];
}

function compareScore(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Chọn 5 lá tốt nhất từ 5–7 lá. */
function bestHand(cards) {
  let best = null;
  const n = cards.length;
  const pick = (start, cur) => {
    if (cur.length === 5) {
      const score = evaluate5(cur);
      if (!best || compareScore(score, best.score) > 0) best = { score, cards: cur.slice() };
      return;
    }
    for (let i = start; i < n; i++) { cur.push(cards[i]); pick(i + 1, cur); cur.pop(); }
  };
  pick(0, []);
  let name = HAND_NAMES[best.score[0]];
  if (best.score[0] === 8 && best.score[1] === 14) name = 'Sảnh chúa (Royal Flush)';
  best.name = name;
  return best;
}

class Poker {
  static meta = { id: 'poker', name: "Poker Texas Hold'em", minPlayers: 2, maxPlayers: 8 };

  constructor(players, opts = {}) {
    this.rng = opts.rng || Math.random;
    this.startChips = opts.startChips || 1000;
    this.sb = opts.smallBlind || 10;
    this.bb = this.sb * 2;
    this.players = players.map((p) => ({
      id: p.id, name: p.name, chips: this.startChips, rebuys: 0, wins: 0, items: [], handStart: this.startChips,
      hole: [], bet: 0, total: 0, folded: true, allIn: false, acted: false, raiseLocked: false, lastAction: '',
    }));
    this.dealer = -1;
    this.handNo = 0;
    this.log = [];
    this.startHand();
  }

  addLog(m) { this.log.push(m); if (this.log.length > 80) this.log.shift(); }
  n() { return this.players.length; }
  inHand(p) { return !p.folded; }
  canAct(p) { return !p.folded && !p.allIn; }

  nextSeat(from, pred) {
    for (let k = 1; k <= this.n(); k++) {
      const j = (from + k) % this.n();
      if (pred(this.players[j])) return j;
    }
    return -1;
  }

  startHand() {
    const eligible = this.players.filter((p) => p.chips > 0);
    this.result = null;
    if (eligible.length < 2) {
      this.phase = 'waiting';
      this.addLog('Cần ít nhất 2 người còn chip để chia bài. Người hết chip có thể bấm "Mua thêm chip".');
      return;
    }
    this.handNo++;
    this.deck = shuffle(newDeck(), this.rng);
    this.community = [];
    this.players.forEach((p) => {
      Object.assign(p, { hole: [], bet: 0, total: 0, folded: p.chips <= 0, allIn: false, acted: false, raiseLocked: false, lastAction: '', items: [], handStart: p.chips });
    });
    this.dealer = this.nextSeat(this.dealer < 0 ? this.n() - 1 : this.dealer, (p) => !p.folded);
    const headsUp = eligible.length === 2;
    this.sbSeat = headsUp ? this.dealer : this.nextSeat(this.dealer, (p) => !p.folded);
    this.bbSeat = this.nextSeat(this.sbSeat, (p) => !p.folded);
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.phase = 'betting';
    this.street = 'preflop';
    this.addLog(`— Ván ${this.handNo} — Nhà cái (D): ${this.players[this.dealer].name}`);
    this.post(this.sbSeat, this.sb, 'Mù nhỏ');
    this.post(this.bbSeat, this.bb, 'Mù lớn');
    this.currentBet = Math.max(this.bb, ...this.players.map((p) => p.bet));
    for (let r = 0; r < 2; r++) this.players.forEach((p) => { if (!p.folded) p.hole.push(this.deck.pop()); });
    this.turn = this.nextSeat(this.bbSeat, (p) => this.canAct(p));
    if (this.isRoundDone()) this.nextStreet();
  }

  post(seat, amount, label) {
    const p = this.players[seat];
    const amt = Math.min(amount, p.chips);
    this.put(p, amt);
    p.lastAction = `${label} ${amt}`;
  }

  put(p, amt) {
    p.chips -= amt;
    p.bet += amt;
    p.total += amt;
    if (p.chips === 0) p.allIn = true;
  }

  pot() { return this.players.reduce((s, p) => s + p.total, 0); }

  action(playerId, a) {
    const i = this.players.findIndex((p) => p.id === playerId);
    if (i < 0) throw new Error('Bạn không ở bàn này.');
    const p = this.players[i];
    if (a.type === 'next') {
      if (this.phase === 'betting') throw new Error('Ván đang diễn ra.');
      return this.startHand();
    }
    if (a.type === 'rebuy') {
      if (this.phase === 'betting' && !p.folded) throw new Error('Chỉ mua thêm chip khi không ở trong ván.');
      if (p.chips > 0) throw new Error('Bạn vẫn còn chip.');
      p.chips = this.startChips;
      p.rebuys++;
      this.addLog(`${p.name} mua thêm ${this.startChips} chip.`);
      return;
    }
    if (this.phase !== 'betting') throw new Error('Ván đã kết thúc, bấm "Ván mới".');
    if (i !== this.turn) throw new Error('Chưa tới lượt bạn.');
    const toCall = this.currentBet - p.bet;
    let type = a.type;
    let raiseTo = Math.floor(Number(a.amount));
    if (type === 'allin') {
      raiseTo = p.bet + p.chips;
      type = raiseTo <= this.currentBet ? 'call' : 'raise';
    }
    switch (type) {
      case 'fold':
        p.folded = true;
        p.lastAction = 'Úp bỏ';
        this.addLog(`${p.name} úp bài.`);
        break;
      case 'check':
        if (toCall > 0) throw new Error(`Bạn phải theo ${toCall} hoặc úp bài.`);
        p.lastAction = 'Xem';
        this.addLog(`${p.name} xem (check).`);
        break;
      case 'call': {
        if (toCall <= 0) throw new Error('Không có cược để theo — hãy bấm Xem.');
        const amt = Math.min(toCall, p.chips);
        this.put(p, amt);
        p.lastAction = p.allIn ? `All-in ${p.bet}` : `Theo ${amt}`;
        this.addLog(`${p.name} ${p.allIn ? 'all-in' : 'theo'} ${amt}.`);
        break;
      }
      case 'raise': {
        if (p.raiseLocked) throw new Error('Không được tố lại (lần tố trước chưa đủ mức tối thiểu). Chỉ được theo hoặc úp.');
        const maxTo = p.bet + p.chips;
        if (!Number.isFinite(raiseTo) || raiseTo <= this.currentBet) throw new Error('Mức tố phải lớn hơn mức cược hiện tại.');
        if (raiseTo > maxTo) throw new Error(`Bạn chỉ có thể tố tối đa tới ${maxTo}.`);
        const minTo = this.currentBet + this.minRaise;
        if (raiseTo < minTo && raiseTo < maxTo) throw new Error(`Tố tối thiểu tới ${minTo}.`);
        const size = raiseTo - this.currentBet;
        const full = size >= this.minRaise;
        const wasBet = this.currentBet === 0;
        this.put(p, raiseTo - p.bet);
        this.players.forEach((q) => {
          if (q === p || !this.canAct(q)) return;
          if (full) { q.raiseLocked = false; q.acted = false; } else if (q.acted) { q.acted = false; q.raiseLocked = true; }
        });
        if (full) this.minRaise = size;
        this.currentBet = raiseTo;
        p.lastAction = p.allIn ? `All-in ${raiseTo}` : `${wasBet ? 'Cược' : 'Tố'} ${raiseTo}`;
        this.addLog(`${p.name} ${p.allIn ? 'ALL-IN' : wasBet ? 'cược' : 'tố lên'} ${raiseTo}.`);
        break;
      }
      default:
        throw new Error('Hành động không hợp lệ.');
    }
    p.acted = true;
    p.raiseLocked = false;

    const remaining = this.players.filter((q) => !q.folded);
    if (remaining.length === 1) return this.winUncontested(remaining[0]);
    if (this.isRoundDone()) this.nextStreet();
    else this.turn = this.nextSeat(i, (q) => this.canAct(q));
  }

  isRoundDone() {
    const actors = this.players.filter((q) => this.canAct(q));
    if (actors.length === 0) return true;
    if (actors.length === 1 && actors[0].bet >= this.currentBet) {
      // Không còn ai để đối cược
      const others = this.players.filter((q) => !q.folded && q !== actors[0]);
      if (others.every((q) => q.allIn)) return true;
    }
    return actors.every((q) => q.acted && q.bet === this.currentBet);
  }

  nextStreet() {
    while (true) {
      this.players.forEach((q) => { q.bet = 0; q.acted = false; q.raiseLocked = false; });
      this.currentBet = 0;
      this.minRaise = this.bb;
      if (this.street === 'river') return this.showdown();
      if (this.street === 'preflop') { this.street = 'flop'; this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop()); }
      else if (this.street === 'flop') { this.street = 'turn'; this.community.push(this.deck.pop()); }
      else if (this.street === 'turn') { this.street = 'river'; this.community.push(this.deck.pop()); }
      const names = { flop: 'Lật 3 lá (Flop)', turn: 'Lá thứ 4 (Turn)', river: 'Lá cuối (River)' };
      this.addLog(`${names[this.street]}: ${this.community.join(' ')}`);
      this.players.forEach((q) => { if (!q.folded && !q.allIn) q.lastAction = ''; });
      const actors = this.players.filter((q) => this.canAct(q));
      if (actors.length >= 2) {
        this.turn = this.nextSeat(this.dealer, (q) => this.canAct(q));
        return;
      }
      // 0–1 người còn cược được: tự lật hết bài
    }
  }

  returnUncalled() {
    const sorted = this.players.slice().sort((a, b) => b.total - a.total);
    const [top, second] = sorted;
    if (top.total > second.total) {
      const diff = top.total - second.total;
      top.total -= diff;
      top.chips += diff;
      if (top.chips > 0) top.allIn = false;
      return { player: top, diff };
    }
    return null;
  }

  winUncontested(winner) {
    this.returnUncalled();
    const pot = this.pot();
    winner.chips += pot;
    winner.items.push({ label: 'Thắng pot (mọi người úp bài)', pts: pot });
    winner.wins++;
    this.addLog(`🏆 ${winner.name} thắng ${pot} (mọi người đã úp bài).`);
    this.result = { pots: [{ amount: pot, winners: [winner.name], hand: null }], showCards: false };
    this.finishHand();
  }

  showdown() {
    const ret = this.returnUncalled();
    if (ret) this.addLog(`Trả lại ${ret.diff} không ai theo cho ${ret.player.name}.`);
    const contenders = this.players.filter((p) => !p.folded);
    contenders.forEach((p) => { p.best = bestHand([...p.hole, ...this.community]); });
    const levels = [...new Set(this.players.filter((p) => p.total > 0).map((p) => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const level of levels) {
      const amount = this.players.reduce((s, p) => s + Math.min(p.total, level) - Math.min(p.total, prev), 0);
      const eligible = contenders.filter((p) => p.total >= level);
      if (eligible.length === 0 && pots.length) pots[pots.length - 1].amount += amount;
      else if (amount > 0) {
        const last = pots[pots.length - 1];
        // Gộp các tầng có cùng tập người được nhận
        if (last && last.eligible.length === eligible.length) last.amount += amount;
        else pots.push({ amount, eligible });
      }
      prev = level;
    }
    this.result = { pots: [], showCards: true };
    pots.forEach((pot, k) => {
      let best = null;
      pot.eligible.forEach((p) => { if (!best || compareScore(p.best.score, best) > 0) best = p.best.score; });
      const winners = pot.eligible.filter((p) => compareScore(p.best.score, best) === 0);
      // Chia đều, chip lẻ cho người gần bên trái nhà cái nhất
      winners.sort((a, b) => this.seatAfterDealer(a) - this.seatAfterDealer(b));
      const share = Math.floor(pot.amount / winners.length);
      let rem = pot.amount - share * winners.length;
      const label = pots.length > 1 ? (k === 0 ? 'Pot chính' : `Pot phụ ${k}`) : 'Pot';
      winners.forEach((w) => {
        const got = share + (rem > 0 ? 1 : 0);
        rem--;
        w.chips += got;
        w.items.push({ label: `Thắng ${label.toLowerCase()} (${w.best.name})`, pts: got });
      });
      this.addLog(`🏆 ${label} ${pot.amount}: ${winners.map((w) => w.name).join(', ')} thắng với ${winners[0].best.name}.`);
      this.result.pots.push({
        label, amount: pot.amount, winners: winners.map((w) => w.name), hand: winners[0].best.name,
        bestCards: winners[0].best.cards,
      });
    });
    this.result.hands = contenders.map((p) => ({ id: p.id, name: p.name, hole: p.hole, hand: p.best.name }));
    const potWinners = new Set();
    this.result.pots.forEach((pt) => pt.winners.forEach((nm) => potWinners.add(this.players.find((q) => q.name === nm))));
    potWinners.forEach((w) => { w.wins++; });
    // Thưởng tay bài đẹp: thắng khi lật bài bằng Tứ quý / Thùng phá sảnh / Sảnh chúa
    this.result.bonus = [];
    potWinners.forEach((w) => {
      const [cat, top] = w.best.score;
      const mult = cat === 8 && top === 14 ? 10 : cat === 8 ? 5 : cat === 7 ? 2 : 0;
      if (!mult) return;
      const each = mult * this.bb;
      const label = `Thưởng ${w.best.name}`;
      let got = 0;
      this.players.forEach((q) => {
        if (q === w || !q.hole.length) return;
        const amt = Math.min(q.chips, each);
        if (!amt) return;
        q.chips -= amt;
        q.items.push({ label: `${label} của ${w.name}`, pts: -amt });
        got += amt;
      });
      if (got) {
        w.chips += got;
        w.items.push({ label: `${label} (mỗi người ${each})`, pts: got });
        this.result.bonus.push({ name: w.name, hand: w.best.name, each, total: got });
        this.addLog(`🎁 ${w.name} được thưởng ${w.best.name}: mỗi người trả ${each}, tổng ${got}.`);
      }
    });
    this.finishHand();
  }

  /** Lãi/lỗ = chip đang có − tổng chip đã nhận (lúc vào + mua thêm) */
  net(p) { return p.chips - this.startChips * (1 + p.rebuys); }

  seatAfterDealer(p) {
    const i = this.players.indexOf(p);
    return (i - this.dealer - 1 + this.n()) % this.n();
  }

  finishHand() {
    this.phase = 'handover';
    this.turn = -1;
    // Bảng điểm ván: tiền cược đã bỏ ra + tiền thắng + thưởng; điểm = lãi/lỗ so với số chip đã nhận
    this.players.forEach((p) => { if (p.total > 0) p.items.unshift({ label: 'Tiền cược', pts: -p.total }); });
    this.result.ranking = this.players.filter((p) => p.hole.length || p.items.length).map((p) => ({
      id: p.id, name: p.name, delta: p.chips - p.handStart, net: this.net(p), wins: p.wins, items: p.items,
    })).sort((a, b) => b.delta - a.delta);
    const busted = this.players.filter((p) => p.chips === 0 && p.total > 0);
    busted.forEach((p) => this.addLog(`💸 ${p.name} đã hết chip.`));
    this.players.forEach((p) => { p.bet = 0; p.total = 0; p.allIn = false; });
  }

  getState(playerId) {
    const showdown = this.result && this.result.showCards;
    const me = this.players.find((p) => p.id === playerId);
    const myTurn = this.phase === 'betting' && this.players[this.turn] === me;
    let options = null;
    if (myTurn) {
      const toCall = this.currentBet - me.bet;
      const maxTo = me.bet + me.chips;
      options = {
        toCall: Math.min(toCall, me.chips),
        canCheck: toCall === 0,
        canRaise: !me.raiseLocked && maxTo > this.currentBet,
        minRaiseTo: Math.min(this.currentBet + this.minRaise, maxTo),
        maxRaiseTo: maxTo,
        currentBet: this.currentBet,
        pot: this.pot(),
      };
    }
    return {
      game: 'poker',
      phase: this.phase,
      street: this.street,
      handNo: this.handNo,
      blinds: [this.sb, this.bb],
      community: this.community || [],
      pot: this.pot(),
      turn: this.turn >= 0 && this.players[this.turn] ? this.players[this.turn].id : null,
      players: this.players.map((p, i) => ({
        id: p.id, name: p.name, chips: p.chips, bet: p.bet, folded: p.folded, allIn: p.allIn,
        lastAction: p.lastAction, rebuys: p.rebuys, cardCount: p.hole.length, net: this.net(p), wins: p.wins,
        dealer: i === this.dealer, sb: i === this.sbSeat, bb: i === this.bbSeat,
        hole: p.id === playerId || (showdown && !p.folded) ? p.hole : null,
      })),
      myBest: me && me.hole.length && this.community && this.community.length >= 3 && !me.folded
        ? bestHand([...me.hole, ...this.community]).name : null,
      options,
      result: this.result,
      log: this.log.slice(-30),
    };
  }

  playerLeft(playerId) {
    const i = this.players.findIndex((p) => p.id === playerId);
    if (i >= 0 && this.phase === 'betting' && i === this.turn) this.action(playerId, { type: 'fold' });
  }
}

module.exports = { Poker, evaluate5, bestHand, compareScore, HAND_NAMES };
