'use strict';
// ===================== CÁ NGỰA =====================
// Luật chi tiết: docs/luat-choi/ca-ngua.md
//
// Bàn cờ: đường đua vòng 60 ô, mỗi màu có 6 ô chuồng (đích) đánh số 1..6.
// Vị trí ngựa (tương đối theo màu):
//   -1          : còn trong chuồng xuất phát (chưa ra quân)
//   0..59       : trên đường đua (0 = ô xuất quân, 59 = ô cửa chuồng đích)
//   101..106    : đã lên chuồng đích, bậc 1..6

const TRACK = 60;
const GATE = 59;
const COLOR_NAMES = ['Đỏ', 'Xanh dương', 'Vàng', 'Xanh lá'];
const EXIT_ROLLS = [1, 6];

const absPos = (color, rel) => (color * 15 + rel) % TRACK;

class CaNgua {
  static meta = { id: 'cangua', name: 'Cá Ngựa', minPlayers: 2, maxPlayers: 4 };

  constructor(players, opts = {}) {
    this.rng = opts.rng || Math.random;
    const colorSets = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
    const colors = colorSets[players.length];
    this.players = players.map((p, i) => ({
      id: p.id, name: p.name, color: colors[i], horses: [-1, -1, -1, -1],
    }));
    this.turn = 0;
    this.dice = null;
    this.phase = 'roll';
    this.moves = [];
    this.winner = null;
    this.log = [`Ván cá ngựa bắt đầu! ${this.players[0].name} (${COLOR_NAMES[this.players[0].color]}) đổ trước.`];
    this.lastMove = null;
  }

  addLog(m) { this.log.push(m); if (this.log.length > 60) this.log.shift(); }

  /** Tìm ngựa đang đứng ở ô tuyệt đối trên đường đua. */
  occupant(abs) {
    for (const p of this.players) {
      for (let h = 0; h < 4; h++) {
        const r = p.horses[h];
        if (r >= 0 && r < TRACK && absPos(p.color, r) === abs) return { player: p, h };
      }
    }
    return null;
  }

  /** Tính nước đi hợp lệ của 1 con ngựa với số xúc xắc d. Trả về null nếu không đi được. */
  moveFor(p, h, d) {
    const r = p.horses[h];
    if (r === -1) {
      if (!EXIT_ROLLS.includes(d)) return null;
      const occ = this.occupant(absPos(p.color, 0));
      if (occ && occ.player === p) return null;
      return { h, to: 0, kick: occ, label: 'Ra quân' };
    }
    if (r > 100) {
      const step = r - 100;
      if (step >= 6 || d !== step + 1) return null;
      if (p.horses.includes(100 + d)) return null;
      return { h, to: 100 + d, label: `Lên bậc ${d}` };
    }
    if (r === GATE) {
      // Từ cửa chuồng: đổ số mấy thì lên bậc đó, không được nhảy qua ngựa nhà trong chuồng
      for (let s = 1; s <= d; s++) if (p.horses.includes(100 + s)) return null;
      return { h, to: 100 + d, label: `Vào chuồng bậc ${d}` };
    }
    const t = r + d;
    if (t > GATE) return null; // không được vượt quá cửa chuồng
    for (let k = r + 1; k < t; k++) if (this.occupant(absPos(p.color, k))) return null; // bị cản
    const occ = this.occupant(absPos(p.color, t));
    if (occ && occ.player === p) return null;
    return { h, to: t, kick: occ, label: occ ? 'Đá ngựa!' : `Đi ${d} ô` };
  }

  validMoves(p, d) {
    const out = [];
    for (let h = 0; h < 4; h++) { const m = this.moveFor(p, h, d); if (m) out.push(m); }
    return out;
  }

  action(playerId, a) {
    if (this.phase === 'ended') throw new Error('Ván đã kết thúc.');
    const p = this.players[this.turn];
    if (!p || p.id !== playerId) throw new Error('Chưa tới lượt bạn.');
    if (a.type === 'roll') {
      if (this.phase !== 'roll') throw new Error('Bạn đã đổ rồi, hãy chọn ngựa để đi.');
      this.dice = 1 + Math.floor(this.rng() * 6);
      this.rollId = (this.rollId || 0) + 1;
      this.moves = this.validMoves(p, this.dice);
      this.addLog(`${p.name} đổ được ${this.dice}.`);
      if (this.moves.length === 0) {
        this.addLog(this.dice === 6 ? 'Không có nước đi, nhưng được đổ thêm (ra 6).' : 'Không có nước đi — mất lượt.');
        this.endMove(p);
      } else if (this.moves.length === 1) {
        this.doMove(p, this.moves[0], true);
      } else {
        this.phase = 'move';
      }
      return;
    }
    if (a.type === 'move') {
      if (this.phase !== 'move') throw new Error('Hãy đổ xúc xắc trước.');
      const m = this.moves.find((x) => x.h === Number(a.horse));
      if (!m) throw new Error('Con ngựa này không đi được với số vừa đổ.');
      this.doMove(p, m, false);
      return;
    }
    throw new Error('Hành động không hợp lệ.');
  }

  doMove(p, m, auto) {
    const from = p.horses[m.h];
    if (m.kick) {
      m.kick.player.horses[m.kick.h] = -1;
      this.addLog(`💥 ${p.name} đá ngựa của ${m.kick.player.name} về chuồng!`);
    }
    p.horses[m.h] = m.to;
    this.lastMove = { player: p.id, h: m.h, from, to: m.to };
    this.addLog(`${p.name}${auto ? ' (tự động)' : ''}: ngựa ${m.h + 1} — ${m.label}.`);
    const won = [3, 4, 5, 6].every((s) => p.horses.includes(100 + s));
    if (won) {
      this.phase = 'ended';
      this.winner = p.id;
      this.addLog(`🏆 ${p.name} (${COLOR_NAMES[p.color]}) đã đưa đủ 4 ngựa lên chuồng và CHIẾN THẮNG!`);
      return;
    }
    this.endMove(p);
  }

  endMove(p) {
    this.moves = [];
    this.phase = 'roll';
    if (this.dice !== 6) {
      this.turn = (this.turn + 1) % this.players.length;
    } else {
      this.addLog(`${p.name} ra 6 nên được đổ tiếp.`);
    }
  }

  getState(playerId) {
    const cur = this.players[this.turn];
    return {
      game: 'cangua',
      phase: this.phase,
      dice: this.dice,
      rollId: this.rollId || 0,
      turn: cur ? cur.id : null,
      winner: this.winner,
      lastMove: this.lastMove,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, colorName: COLOR_NAMES[p.color],
        horses: p.horses.map((r) => (r === -1 ? { state: 'base' } : r > 100 ? { state: 'home', step: r - 100 } : { state: 'track', abs: absPos(p.color, r), rel: r })),
        homeCount: p.horses.filter((r) => r > 100).length,
      })),
      movable: cur && cur.id === playerId && this.phase === 'move'
        ? this.moves.map((m) => ({
          h: m.h, label: m.label, kick: !!m.kick,
          target: m.to > 100 ? { state: 'home', step: m.to - 100 } : { state: 'track', abs: absPos(cur.color, m.to) },
        }))
        : [],
      log: this.log.slice(-30),
    };
  }

  playerLeft() {}
}

module.exports = { CaNgua, absPos, TRACK, GATE };
