'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { playOne, duel } = require('./bot-sim');

const GAMES = [['tienlen', 4], ['poker', 4], ['cangua', 4], ['typhu', 3]];
const LEVELS = ['easy', 'medium', 'hard'];

for (const [g, seats] of GAMES) {
  for (const lv of LEVELS) {
    test(`Máy ${lv} chơi ${g}: hết ván, không đi sai luật`, () => {
      for (let k = 0; k < 3; k++) {
        const r = playOne(g, Array(seats).fill(lv), { hands: 3 });
        assert.equal(r.invalid, 0);
      }
    });
  }
}

test('Máy Khó thắng máy Dễ rõ rệt ở cả 4 game', () => {
  const plan = [['tienlen', 4, 80], ['poker', 4, 16], ['cangua', 2, 200], ['typhu', 2, 80]];
  for (const [g, seats, n] of plan) {
    const r = duel(g, 'hard', 'easy', n, seats);
    assert.equal(r.invalid, 0, `${g}: có nước sai luật`);
    assert.ok(r.rate > 0.58, `${g}: máy Khó chỉ thắng ${(r.rate * 100).toFixed(0)}%`);
  }
});
