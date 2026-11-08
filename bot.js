'use strict';
// Bilgisayar oyuncusu: eli olabildiğince per/seri (ya da çift) halinde tutmaya çalışır.
const { evaluateFinish, split, isWild, cardValue, removeOne } = require('./game');

// Doğal kartlardan en fazla kaçı per/seriye yerleşebilir (okeyler serbest joker)
function maxCover(cards, w, memo) {
  if (!cards.length) return 0;
  const key = cards.map((c) => c.s + c.r).join(',') + '|' + w;
  if (memo.has(key)) return memo.get(key);
  const c = cards[0];
  const rest = cards.slice(1);
  let best = maxCover(rest, w, memo); // c boşta kalır

  const others = [...new Set(rest.filter((x) => x.r === c.r && x.s !== c.s).map((x) => x.s))];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    let rem = rest;
    let k = 1;
    for (let i = 0; i < others.length; i++) if (mask & (1 << i)) { rem = removeOne(rem, others[i], c.r); k++; }
    for (const size of [3, 4]) {
      const need = size - k;
      if (need >= 0 && need <= w) best = Math.max(best, k + maxCover(rem, w - need, memo));
    }
  }
  for (let start = c.r; start >= Math.max(2, c.r - w); start--) {
    let used = c.r - start;
    let rem = rest;
    for (let end = c.r; end <= 14; end++) {
      if (end > c.r) {
        const r2 = removeOne(rem, c.s, end);
        if (r2) rem = r2; else used++;
      }
      if (used > w) break;
      const len = end - start + 1;
      if (len >= 3) best = Math.max(best, len - used + maxCover(rem, w - used, memo));
    }
  }
  memo.set(key, best);
  return best;
}

// Yakınlık: aynı renkte ±1/±2, farklı renkte aynı sayı
function potential(nat) {
  let p = 0;
  for (const c of nat) {
    let nb = 0;
    const seen = new Set();
    for (const o of nat) {
      if (o === c) continue;
      const k = o.s + o.r;
      if (seen.has(k)) continue;
      if (o.s === c.s && Math.abs(o.r - c.r) <= 2 && o.r !== c.r) { nb += Math.abs(o.r - c.r) === 1 ? 1 : 0.6; seen.add(k); }
      else if (o.r === c.r && o.s !== c.s) { nb += 1; seen.add(k); }
    }
    p += Math.min(nb, 2);
  }
  return p;
}

function pairCover(nat, w) {
  const cnt = {};
  for (const c of nat) cnt[c.s + c.r] = (cnt[c.s + c.r] || 0) + 1;
  let pairs = 0;
  let singles = 0;
  for (const k in cnt) { pairs += Math.floor(cnt[k] / 2); singles += cnt[k] % 2; }
  return { pairs, cover: pairs * 2 + Math.min(w, singles) };
}

function score(cards, okey) {
  const { nat, w } = split(cards, okey);
  const cover = maxCover(nat, w, new Map());
  const pc = pairCover(nat, w);
  // 5+ çift varsa çifte gitmek mantıklı
  const best = pc.pairs >= 5 ? Math.max(cover, pc.cover + 1) : cover;
  return best * 10 + potential(nat) + w * 6;
}

function bestDiscard(hand, okey, shownId = null) {
  // 1) Bitebiliyorsa bit (okey atarak bitmek x2 olduğu için önce onu dene)
  const finishes = [];
  for (const c of hand) {
    const rest = hand.filter((x) => x !== c);
    if (evaluateFinish(rest, okey, shownId).ok) finishes.push(c);
  }
  if (finishes.length) {
    const wild = finishes.find((c) => isWild(c, okey));
    return { card: wild || finishes[0], finish: true };
  }
  // 2) En az işe yarayan kartı at (eşitlikte puanı yüksek olanı)
  let best = null;
  const tried = new Set();
  for (const c of hand) {
    if (isWild(c, okey) || c.id === shownId) continue; // okeyi ve gösterilen kağıdı tutar
    const k = c.joker ? 'X' : c.s + c.r;
    if (tried.has(k)) continue;
    tried.add(k);
    const sc = score(hand.filter((x) => x !== c), okey) + (c.joker ? 0 : cardValue(c.r) * 0.05);
    if (!best || sc > best.sc) best = { card: c, sc };
  }
  return { card: best.card, finish: false, sc: best.sc };
}

function decideDraw(game, seat) {
  const top = game.pile[game.pile.length - 1];
  if (!top || top.by !== game.prevSeat(seat)) return 'deck';
  if (!game.deck.length) return 'pile';
  if (isWild(top, game.okey)) return 'deck'; // yerdeki okey alınamaz
  const hand = game.hands[seat];
  const withTop = hand.concat([top]);
  const after = bestDiscard(withTop, game.okey, game.shownFor(seat));
  if (after.finish) return 'pile';
  if (after.card === top) return 'deck';
  // Mevcut elin değeri ile karşılaştır
  const now = score(hand, game.okey);
  return after.sc >= now + 8 ? 'pile' : 'deck';
}

function botAct(game, seat) {
  if (game.canShow(seat)) { game.showIndicator(seat); return; } // gösterge elindeyse önce göster (oyun 1 sn durur)
  if (game.phase === 'draw') {
    game.draw(seat, decideDraw(game, seat));
  } else {
    const d = bestDiscard(game.hands[seat], game.okey, game.shownFor(seat));
    game.discard(seat, d.card.id, d.finish);
  }
}

module.exports = { botAct, bestDiscard, score };
