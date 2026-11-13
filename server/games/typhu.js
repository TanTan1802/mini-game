'use strict';
// ===================== CỜ TỶ PHÚ (bản Việt Nam, bàn 32 ô) =====================
// Luật chi tiết: docs/luat-choi/co-ty-phu.md

const START_MONEY = 1500;
const PASS_START = 200;
const JAIL_POS = 8;
const JAIL_FINE = 50;

const GROUPS = {
  nau: { name: 'Nâu', color: '#8d5a3b', house: 50 },
  xanhnhat: { name: 'Xanh nhạt', color: '#7cc7e8', house: 50 },
  hong: { name: 'Hồng', color: '#e06bb0', house: 100 },
  cam: { name: 'Cam', color: '#f39237', house: 100 },
  do: { name: 'Đỏ', color: '#e2483d', house: 150 },
  vang: { name: 'Vàng', color: '#f2c94c', house: 150 },
  la: { name: 'Xanh lá', color: '#3aa76d', house: 200 },
  tim: { name: 'Tím than', color: '#3d4ba8', house: 200 },
};
const RENT_MULT = [1, 5, 14, 40, 55, 70]; // 0 nhà, 1–4 nhà, khách sạn

const prop = (name, group, price) => ({ type: 'property', name, group, price, base: Math.ceil(price * 0.06) });
const BOARD = [
  { type: 'start', name: 'Xuất Phát' },
  prop('Cà Mau', 'nau', 60),
  { type: 'chance', name: 'Cơ Hội' },
  prop('Bạc Liêu', 'nau', 60),
  { type: 'tax', name: 'Thuế Thu Nhập', amount: 200 },
  { type: 'station', name: 'Bến Xe Miền Tây', price: 200 },
  prop('Cần Thơ', 'xanhnhat', 100),
  prop('Vĩnh Long', 'xanhnhat', 120),
  { type: 'jail', name: 'Nhà Tù / Thăm Tù' },
  prop('Đà Lạt', 'hong', 140),
  { type: 'utility', name: 'Công Ty Điện Lực', price: 150 },
  prop('Nha Trang', 'hong', 160),
  { type: 'luck', name: 'Vận May' },
  { type: 'station', name: 'Ga Đà Nẵng', price: 200 },
  prop('Quy Nhơn', 'cam', 180),
  prop('Hội An', 'cam', 200),
  { type: 'free', name: 'Lễ Hội (Nghỉ chân)' },
  prop('Huế', 'do', 220),
  { type: 'chance', name: 'Cơ Hội' },
  prop('Quảng Bình', 'do', 240),
  { type: 'station', name: 'Sân Bay Nội Bài', price: 200 },
  prop('Hạ Long', 'vang', 260),
  { type: 'utility', name: 'Công Ty Cấp Nước', price: 150 },
  prop('Hải Phòng', 'vang', 280),
  { type: 'gotojail', name: 'Vào Tù' },
  prop('Sa Pa', 'la', 300),
  prop('Ninh Bình', 'la', 320),
  { type: 'luck', name: 'Vận May' },
  { type: 'station', name: 'Cảng Sài Gòn', price: 200 },
  { type: 'tax', name: 'Thuế Xa Xỉ', amount: 100 },
  prop('TP. Hồ Chí Minh', 'tim', 350),
  prop('Hà Nội', 'tim', 400),
];
const STATIONS = BOARD.map((s, i) => (s.type === 'station' ? i : -1)).filter((i) => i >= 0);

const CHANCE_CARDS = [
  { text: 'Tiến thẳng tới ô Xuất Phát, nhận 200.', moveTo: 0 },
  { text: 'Bay ra Hà Nội công tác. Nếu đi qua Xuất Phát được nhận 200.', moveTo: 31 },
  { text: 'Đi du lịch Huế. Nếu đi qua Xuất Phát được nhận 200.', moveTo: 17 },
  { text: 'Đi tới bến/ga/sân bay/cảng gần nhất phía trước. Nếu có chủ, trả gấp đôi tiền thuê.', nearestStation: true },
  { text: 'Quên đồ! Lùi lại 3 ô.', back: 3 },
  { text: 'Vượt đèn đỏ bị bắt — Vào tù ngay (không qua Xuất Phát).', jail: true },
  { text: 'Thẻ RA TÙ MIỄN PHÍ — giữ lại dùng khi cần.', jailCard: true },
  { text: 'Ngân hàng trả cổ tức: nhận 50.', money: 50 },
  { text: 'Sửa sang nhà cửa: trả 25 mỗi nhà, 100 mỗi khách sạn.', repairs: [25, 100] },
  { text: 'Phạt không đội mũ bảo hiểm: trả 15.', money: -15 },
  { text: 'Được bầu làm trưởng nhóm: mời mỗi người chơi 50.', eachPlayer: -50 },
  { text: 'Trúng vé số: nhận 150.', money: 150 },
];
const LUCK_CARDS = [
  { text: 'Tiến thẳng tới ô Xuất Phát, nhận 200.', moveTo: 0 },
  { text: 'Ngân hàng tính nhầm có lợi cho bạn: nhận 200.', money: 200 },
  { text: 'Tiền khám răng: trả 50.', money: -50 },
  { text: 'Bán cổ phiếu có lãi: nhận 50.', money: 50 },
  { text: 'Thẻ RA TÙ MIỄN PHÍ — giữ lại dùng khi cần.', jailCard: true },
  { text: 'Bị nghi trốn thuế — Vào tù ngay (không qua Xuất Phát).', jail: true },
  { text: 'Sinh nhật bạn! Mỗi người chơi mừng bạn 10.', eachPlayer: 10 },
  { text: 'Hoàn thuế thu nhập: nhận 20.', money: 20 },
  { text: 'Đóng viện phí: trả 100.', money: -100 },
  { text: 'Nhận thừa kế: 100.', money: 100 },
  { text: 'Đóng góp sửa đường làng: trả 40 mỗi nhà, 115 mỗi khách sạn.', repairs: [40, 115] },
  { text: 'Đoạt giải nhì cuộc thi karaoke: nhận 10.', money: 10 },
];

class TyPhu {
  static meta = { id: 'typhu', name: 'Cờ Tỷ Phú', minPlayers: 2, maxPlayers: 6 };

  constructor(players, opts = {}) {
    this.rng = opts.rng || Math.random;
    this.players = players.map((p, i) => ({
      id: p.id, name: p.name, token: i, money: START_MONEY, pos: 0,
      inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false, debts: [],
    }));
    this.owned = {}; // pos -> { owner, houses, mortgaged }
    this.turn = 0;
    this.turnNo = 1;
    this.phase = 'roll';
    this.doubles = 0;
    this.rollAgain = false;
    this.dice = null;
    this.rollId = 0;
    this.card = null;
    this.decks = { chance: this.shuffle(CHANCE_CARDS.map((_, i) => i)), luck: this.shuffle(LUCK_CARDS.map((_, i) => i)) };
    this.winner = null;
    this.log = [`Ván Cờ Tỷ Phú bắt đầu! Mỗi người có ${START_MONEY}. ${this.players[0].name} đổ trước.`];
  }

  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  addLog(m) { this.log.push(m); if (this.log.length > 80) this.log.shift(); }
  cur() { return this.players[this.turn]; }
  byId(id) { return this.players.find((p) => p.id === id); }

  // ---------- Tiền ----------
  /** Trả tiền. Nếu không đủ, phần thiếu thành nợ (tiền âm) phải bù bằng cách bán nhà/cầm cố. */
  pay(p, amount, creditor = null) {
    if (amount <= 0) return;
    const covered = Math.max(0, Math.min(amount, p.money));
    p.money -= amount;
    if (creditor) {
      creditor.money += covered;
      if (amount > covered) p.debts.push({ to: creditor.id, amount: amount - covered });
    }
    if (p.money < 0) this.addLog(`⚠️ ${p.name} đang thiếu ${-p.money}. Hãy bán nhà / cầm cố đất, hoặc tuyên bố phá sản.`);
  }

  gain(p, amount) {
    p.money += amount;
    this.settleDebts(p);
  }

  settleDebts(p) {
    if (p.money < 0) return;
    for (const d of p.debts) {
      const c = this.byId(d.to);
      if (c && !c.bankrupt) c.money += d.amount;
    }
    if (p.debts.length) this.addLog(`${p.name} đã trả hết nợ.`);
    p.debts = [];
  }

  // ---------- Sở hữu ----------
  groupOf(pos) { return BOARD.map((s, i) => i).filter((i) => BOARD[i].group && BOARD[i].group === BOARD[pos].group); }
  ownsGroup(pid, pos) { return this.groupOf(pos).every((i) => this.owned[i] && this.owned[i].owner === pid); }

  rentFor(pos, diceSum) {
    const sq = BOARD[pos];
    const o = this.owned[pos];
    if (sq.type === 'property') {
      if (o.houses > 0) return sq.base * RENT_MULT[o.houses];
      return sq.base * (this.ownsGroup(o.owner, pos) ? 2 : 1);
    }
    if (sq.type === 'station') {
      const n = STATIONS.filter((i) => this.owned[i] && this.owned[i].owner === o.owner).length;
      return 25 * 2 ** (n - 1);
    }
    if (sq.type === 'utility') {
      const n = BOARD.filter((s, i) => s.type === 'utility' && this.owned[i] && this.owned[i].owner === o.owner).length;
      return diceSum * (n === 2 ? 10 : 4);
    }
    return 0;
  }

  netWorth(p) {
    let w = p.money;
    for (const [pos, o] of Object.entries(this.owned)) {
      if (o.owner !== p.id) continue;
      const sq = BOARD[pos];
      w += o.mortgaged ? sq.price / 2 : sq.price;
      if (o.houses) w += o.houses * GROUPS[sq.group].house;
    }
    return w;
  }

  // ---------- Di chuyển ----------
  moveTo(p, target, collect = true) {
    if (collect && target < p.pos) {
      this.gain(p, PASS_START);
      this.addLog(`${p.name} đi qua Xuất Phát, nhận ${PASS_START}.`);
    }
    p.pos = target;
  }

  sendToJail(p) {
    p.pos = JAIL_POS;
    p.inJail = true;
    p.jailTurns = 0;
    this.rollAgain = false;
    this.addLog(`🚔 ${p.name} vào tù!`);
  }

  land(p, diceSum, rentMult = 1) {
    const sq = BOARD[p.pos];
    this.addLog(`${p.name} tới ô ${sq.name}.`);
    switch (sq.type) {
      case 'property': case 'station': case 'utility': {
        const o = this.owned[p.pos];
        if (!o) { this.phase = 'buy'; return; }
        if (o.owner === p.id) return;
        if (o.mortgaged) { this.addLog('Đất đang cầm cố nên không thu tiền thuê.'); return; }
        const owner = this.byId(o.owner);
        const rent = this.rentFor(p.pos, diceSum) * rentMult;
        this.addLog(`${p.name} trả ${rent} tiền thuê cho ${owner.name}.`);
        this.pay(p, rent, owner);
        return;
      }
      case 'tax':
        this.addLog(`${p.name} nộp ${sq.amount} tiền thuế.`);
        this.pay(p, sq.amount);
        return;
      case 'gotojail':
        this.sendToJail(p);
        return;
      case 'chance': case 'luck':
        this.drawCard(p, sq.type, diceSum);
        return;
      default:
    }
  }

  drawCard(p, kind, diceSum) {
    const deck = this.decks[kind];
    const list = kind === 'chance' ? CHANCE_CARDS : LUCK_CARDS;
    const idx = deck.shift();
    deck.push(idx);
    const c = list[idx];
    this.card = { kind: kind === 'chance' ? 'Cơ Hội' : 'Vận May', text: c.text, player: p.name, id: this.rollId };
    this.addLog(`🃏 ${p.name} rút thẻ ${this.card.kind}: "${c.text}"`);
    if (c.money > 0) this.gain(p, c.money);
    if (c.money < 0) this.pay(p, -c.money);
    if (c.jailCard) p.jailCards++;
    if (c.jail) return this.sendToJail(p);
    if (c.repairs) {
      let total = 0;
      for (const o of Object.values(this.owned)) {
        if (o.owner !== p.id) continue;
        total += o.houses === 5 ? c.repairs[1] : o.houses * c.repairs[0];
      }
      this.addLog(`Tổng chi phí sửa chữa: ${total}.`);
      this.pay(p, total);
    }
    if (c.eachPlayer) {
      const others = this.players.filter((q) => q !== p && !q.bankrupt);
      if (c.eachPlayer > 0) others.forEach((q) => this.pay(q, c.eachPlayer, p));
      else others.forEach((q) => this.pay(p, -c.eachPlayer, q));
    }
    if (c.moveTo !== undefined) { this.moveTo(p, c.moveTo); this.land(p, diceSum); }
    if (c.back) { p.pos = (p.pos - c.back + BOARD.length) % BOARD.length; this.land(p, diceSum); }
    if (c.nearestStation) {
      const target = STATIONS.find((i) => i > p.pos) ?? STATIONS[0];
      this.moveTo(p, target);
      this.land(p, diceSum, 2);
    }
  }

  // ---------- Hành động ----------
  action(playerId, a) {
    if (this.phase === 'ended') throw new Error('Ván đã kết thúc.');
    const p = this.byId(playerId);
    if (!p) throw new Error('Bạn không ở trong ván này.');
    if (a.type === 'end_game') {
      if (!a._host) throw new Error('Chỉ chủ phòng mới được kết thúc ván.');
      return this.finishByWorth();
    }
    if (p.bankrupt) throw new Error('Bạn đã phá sản.');
    const myTurn = this.cur() === p;
    const pos = Number(a.pos);

    switch (a.type) {
      case 'roll': return this.roll(p, myTurn);
      case 'buy': {
        if (!myTurn || this.phase !== 'buy') throw new Error('Không thể mua lúc này.');
        const sq = BOARD[p.pos];
        if (p.money < sq.price) throw new Error('Bạn không đủ tiền mua.');
        this.pay(p, sq.price);
        this.owned[p.pos] = { owner: p.id, houses: 0, mortgaged: false };
        this.addLog(`🏠 ${p.name} mua ${sq.name} với giá ${sq.price}.`);
        this.afterResolve();
        return;
      }
      case 'skip_buy':
        if (!myTurn || this.phase !== 'buy') throw new Error('Không thể bỏ qua lúc này.');
        this.addLog(`${p.name} không mua ${BOARD[p.pos].name}.`);
        this.afterResolve();
        return;
      case 'pay_jail':
        if (!myTurn || this.phase !== 'roll' || !p.inJail) throw new Error('Không thể nộp phạt lúc này.');
        if (p.money < JAIL_FINE) throw new Error('Không đủ tiền nộp phạt.');
        this.pay(p, JAIL_FINE);
        p.inJail = false;
        this.addLog(`${p.name} nộp phạt ${JAIL_FINE} để ra tù.`);
        return;
      case 'use_card':
        if (!myTurn || this.phase !== 'roll' || !p.inJail || !p.jailCards) throw new Error('Không thể dùng thẻ lúc này.');
        p.jailCards--;
        p.inJail = false;
        this.addLog(`${p.name} dùng thẻ Ra Tù Miễn Phí.`);
        return;
      case 'end_turn':
        if (!myTurn || this.phase !== 'end') throw new Error('Chưa thể kết thúc lượt.');
        if (p.money < 0) throw new Error('Bạn đang nợ — hãy bán nhà/cầm cố hoặc tuyên bố phá sản.');
        return this.nextTurn();
      case 'build': return this.build(p, pos, myTurn);
      case 'sell_house': return this.sellHouse(p, pos);
      case 'mortgage': return this.mortgage(p, pos);
      case 'unmortgage': return this.unmortgage(p, pos);
      case 'bankrupt': return this.bankrupt(p);
      default:
        throw new Error('Hành động không hợp lệ.');
    }
  }

  roll(p, myTurn) {
    if (!myTurn || this.phase !== 'roll') throw new Error('Chưa tới lượt bạn đổ.');
    if (p.money < 0) throw new Error('Bạn đang nợ — hãy trả nợ trước khi đổ.');
    const d1 = 1 + Math.floor(this.rng() * 6);
    const d2 = 1 + Math.floor(this.rng() * 6);
    const isDouble = d1 === d2;
    this.dice = [d1, d2];
    this.rollId++;
    this.card = null;
    this.rollAgain = false;
    this.addLog(`🎲 ${p.name} đổ ${d1} + ${d2} = ${d1 + d2}${isDouble ? ' (ĐÔI!)' : ''}.`);

    if (p.inJail) {
      if (isDouble) {
        p.inJail = false;
        this.addLog(`${p.name} đổ được đôi, ra tù!`);
      } else {
        p.jailTurns++;
        if (p.jailTurns < 3) {
          this.addLog(`${p.name} vẫn ở trong tù (lần ${p.jailTurns}/3).`);
          this.phase = 'end';
          return;
        }
        this.addLog(`${p.name} ở tù đủ 3 lượt, nộp phạt ${JAIL_FINE} và đi tiếp.`);
        this.pay(p, JAIL_FINE);
        p.inJail = false;
      }
    } else if (isDouble) {
      this.doubles++;
      if (this.doubles >= 3) {
        this.addLog('Đổ đôi 3 lần liên tiếp!');
        this.sendToJail(p);
        this.phase = 'end';
        return;
      }
      this.rollAgain = true;
    }
    const target = (p.pos + d1 + d2) % BOARD.length;
    this.moveTo(p, target);
    this.land(p, d1 + d2);
    if (this.phase !== 'buy') this.afterResolve();
  }

  afterResolve() {
    const p = this.cur();
    this.phase = this.rollAgain && !p.inJail && !p.bankrupt ? 'roll' : 'end';
    if (this.phase === 'roll') this.addLog(`${p.name} được đổ thêm lượt nữa.`);
  }

  nextTurn() {
    this.doubles = 0;
    this.rollAgain = false;
    const n = this.players.length;
    let j = this.turn;
    do j = (j + 1) % n; while (this.players[j].bankrupt);
    this.turn = j;
    this.turnNo++;
    this.phase = 'roll';
    const p = this.cur();
    this.addLog(`— Lượt của ${p.name}${p.inJail ? ' (đang ở tù)' : ''} —`);
  }

  build(p, pos, myTurn) {
    if (!myTurn) throw new Error('Chỉ được xây nhà trong lượt của bạn.');
    const sq = BOARD[pos];
    const o = this.owned[pos];
    if (!sq || sq.type !== 'property' || !o || o.owner !== p.id) throw new Error('Đây không phải đất của bạn.');
    if (!this.ownsGroup(p.id, pos)) throw new Error(`Cần sở hữu đủ nhóm ${GROUPS[sq.group].name} mới được xây.`);
    const group = this.groupOf(pos);
    if (group.some((i) => this.owned[i].mortgaged)) throw new Error('Có đất trong nhóm đang cầm cố.');
    if (o.houses >= 5) throw new Error('Đã có khách sạn, không thể xây thêm.');
    const min = Math.min(...group.map((i) => this.owned[i].houses));
    if (o.houses > min) throw new Error('Phải xây đều: hãy xây ở ô có ít nhà hơn trong nhóm trước.');
    const cost = GROUPS[sq.group].house;
    if (p.money < cost) throw new Error(`Cần ${cost} để xây.`);
    this.pay(p, cost);
    o.houses++;
    this.addLog(`🔨 ${p.name} xây ${o.houses === 5 ? 'KHÁCH SẠN' : 'nhà thứ ' + o.houses} ở ${sq.name} (-${cost}).`);
  }

  sellHouse(p, pos) {
    const sq = BOARD[pos];
    const o = this.owned[pos];
    if (!o || o.owner !== p.id || !o.houses) throw new Error('Không có nhà để bán.');
    const max = Math.max(...this.groupOf(pos).map((i) => this.owned[i].houses));
    if (o.houses < max) throw new Error('Phải bán đều: bán ở ô có nhiều nhà hơn trước.');
    o.houses--;
    const refund = GROUPS[sq.group].house / 2;
    this.addLog(`${p.name} bán 1 nhà ở ${sq.name}, nhận ${refund}.`);
    this.gain(p, refund);
  }

  mortgage(p, pos) {
    const sq = BOARD[pos];
    const o = this.owned[pos];
    if (!o || o.owner !== p.id) throw new Error('Đây không phải đất của bạn.');
    if (o.mortgaged) throw new Error('Đất đã được cầm cố.');
    if (sq.group && this.groupOf(pos).some((i) => this.owned[i] && this.owned[i].houses > 0)) {
      throw new Error('Phải bán hết nhà trong nhóm trước khi cầm cố.');
    }
    o.mortgaged = true;
    this.addLog(`${p.name} cầm cố ${sq.name}, nhận ${sq.price / 2}.`);
    this.gain(p, sq.price / 2);
  }

  unmortgage(p, pos) {
    const sq = BOARD[pos];
    const o = this.owned[pos];
    if (!o || o.owner !== p.id || !o.mortgaged) throw new Error('Đất này không bị cầm cố.');
    const cost = Math.ceil((sq.price / 2) * 1.1);
    if (p.money < cost) throw new Error(`Cần ${cost} để chuộc lại.`);
    this.pay(p, cost);
    o.mortgaged = false;
    this.addLog(`${p.name} chuộc lại ${sq.name} với giá ${cost}.`);
  }

  bankrupt(p) {
    if (p.money >= 0) throw new Error('Bạn chưa nợ nên không cần phá sản.');
    const creditorDebt = p.debts.find((d) => this.byId(d.to) && !this.byId(d.to).bankrupt);
    const creditor = creditorDebt ? this.byId(creditorDebt.to) : null;
    for (const [pos, o] of Object.entries(this.owned)) {
      if (o.owner !== p.id) continue;
      if (creditor) { o.owner = creditor.id; o.houses = 0; } else delete this.owned[pos];
    }
    if (creditor) creditor.jailCards += p.jailCards;
    p.jailCards = 0;
    p.bankrupt = true;
    p.money = 0;
    p.debts = [];
    this.addLog(`💀 ${p.name} PHÁ SẢN! ${creditor ? 'Toàn bộ đất được chuyển cho ' + creditor.name + '.' : 'Đất được trả lại ngân hàng.'}`);
    const alive = this.players.filter((q) => !q.bankrupt);
    if (alive.length === 1) {
      this.phase = 'ended';
      this.winner = alive[0].id;
      this.ranking = this.rankByWorth();
      this.addLog(`🏆 ${alive[0].name} là TỶ PHÚ cuối cùng!`);
      return;
    }
    if (this.cur() === p) this.nextTurn();
  }

  rankByWorth() {
    return this.players
      .map((p) => ({ id: p.id, name: p.name, worth: p.bankrupt ? 0 : this.netWorth(p), bankrupt: p.bankrupt }))
      .sort((a, b) => b.worth - a.worth);
  }

  finishByWorth() {
    this.ranking = this.rankByWorth();
    this.phase = 'ended';
    const top = this.byId(this.ranking[0].id);
    this.winner = top.id;
    this.addLog(`Chủ phòng kết thúc ván. Người giàu nhất: ${top.name} (${this.ranking[0].worth}).`);
  }

  getState(playerId) {
    const cur = this.cur();
    return {
      game: 'typhu',
      board: BOARD.map((s, i) => ({
        ...s,
        groupColor: s.group ? GROUPS[s.group].color : null,
        groupName: s.group ? GROUPS[s.group].name : null,
        houseCost: s.group ? GROUPS[s.group].house : null,
        rents: s.type === 'property' ? RENT_MULT.map((m) => s.base * m) : null,
        owner: this.owned[i] ? this.owned[i].owner : null,
        houses: this.owned[i] ? this.owned[i].houses : 0,
        mortgaged: this.owned[i] ? this.owned[i].mortgaged : false,
        currentRent: this.owned[i] && !this.owned[i].mortgaged && s.type !== 'utility' ? this.rentFor(i, 0) : null,
      })),
      phase: this.phase,
      turnNo: this.turnNo,
      turn: cur ? cur.id : null,
      dice: this.dice,
      rollId: this.rollId,
      card: this.card,
      winner: this.winner,
      ranking: this.ranking || null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, token: p.token, money: p.money, pos: p.pos, inJail: p.inJail,
        jailTurns: p.jailTurns, jailCards: p.jailCards, bankrupt: p.bankrupt, worth: this.netWorth(p),
      })),
      jailFine: JAIL_FINE,
      log: this.log.slice(-30),
    };
  }

  playerLeft() {}
}

module.exports = { TyPhu, BOARD, GROUPS };
