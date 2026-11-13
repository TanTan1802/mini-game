'use strict';
// Tiện ích bộ bài 52 lá dùng chung cho Poker và Tiến Lên.
// Lá bài được biểu diễn bằng chuỗi: hạng + chất, ví dụ "AS" (Át Bích), "10H" (10 Cơ).

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'C', 'D', 'H']; // Bích ♠, Chuồn ♣, Rô ♦, Cơ ♥

function newDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parse(card) {
  return { rank: card.slice(0, -1), suit: card.slice(-1) };
}

module.exports = { RANKS, SUITS, newDeck, shuffle, parse };
