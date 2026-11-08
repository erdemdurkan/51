'use strict';
// İskambil 51 - oyun kuralları (sunucu tarafı, tek doğruluk kaynağı)
const crypto = require('crypto');

const SUITS = ['S', 'H', 'D', 'C']; // Maça, Kupa, Karo, Sinek
const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

// Kolayca değiştirilebilir kurallar
const CONFIG = {
  handSize: 14,
  // Okeyin rengine göre çarpan (sinek 2, maça 3, karo 4, kupa 5)
  suitMultiplier: { C: 2, S: 3, D: 4, H: 5 },
  // Biten: normal -100; çiftten ya da okey atarak biterse -100 x renk (-200/-300/-400/-500)
  finishPoints: 100,
  // Hiç peri olmayan (ve 4 çifti olmayan): sabit ceza 100 x renk (200/300/400/500)
  noMeldPenalty: 100,
  minPairs: 4,                // en az 4 çifti olan çiftten yazılır
  readyPenalty: 100,          // okeye dönmüş (bitebilecekken bitmemiş) el: 100 x renk (200/300/400/500)
  showBonus: 10,              // göstergeyi gösteren: -10 x renk (-20/-30/-40/-50)
  falseShowPenalty: 50,       // göstergesi yokken gösteren: +50 ceza
  okeyThrowPenalty: 100,      // bitmeden yere okey atan: 100 ceza (renk önemsiz)
  freezeMs: 3000,             // duyuru penceresi (3 sn) açıkken kimse kağıt çekemez/atamaz
  settleMs: 30000,            // biri bitince diğer oyuncuların elini açması için süre (30 sn)
  pairsLoserMultiplier: 2,    // çifte giden: boştaki kağıtlar x2
  specialLoserMultiplier: 2,  // biten çiftten bitti / okey attıysa herkesin cezası x2
  heldOkeyPoints: 0,          // elde kalan okey ek ceza getirmez
};

const cardValue = (r) => (r === 14 ? 11 : r >= 10 ? 10 : r);
const nextRank = (r) => (r === 14 ? 2 : r + 1); // gösterge A ise okey 2
const label = (c) => (c.joker ? 'Sahte Okey' : `${SYM[c.s]}${RANK_LABEL[c.r] || c.r}`);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 2 deste (mavi + kırmızı) x 52 + 2 sahte okey = 106
function makeDeck() {
  const deck = [];
  for (const b of ['blue', 'red']) {
    for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ id: `${s}${r}${b[0]}`, s, r, b });
    deck.push({ id: `X${b[0]}`, joker: true, b });
  }
  return deck;
}

const isWild = (c, okey) => !c.joker && c.s === okey.s && c.r === okey.r;

// Eli: doğal kartlar (sahte okey = okeyin yerine geçen kart) + joker (okey) sayısı
function split(cards, okey) {
  let w = 0;
  const nat = [];
  for (const c of cards) {
    if (isWild(c, okey)) w++;
    else nat.push(c.joker ? { s: okey.s, r: okey.r } : { s: c.s, r: c.r });
  }
  nat.sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
  return { nat, w };
}

function removeOne(arr, s, r) {
  const i = arr.findIndex((c) => c.s === s && c.r === r);
  if (i < 0) return null;
  const out = arr.slice();
  out.splice(i, 1);
  return out;
}

// Tüm kartlar per (aynı sayı, farklı renk, 3-4) veya seri (aynı renk ardışık, en az 3,
// Q-K-A geçerli, A-2-3 geçersiz) gruplarına bölünebiliyor mu?
function canMeld(cards, w) {
  if (!cards.length) return w === 0;
  const c = cards[0]; // en küçük sayı
  const rest = cards.slice(1);

  // Per
  const others = [...new Set(rest.filter((x) => x.r === c.r && x.s !== c.s).map((x) => x.s))];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    let rem = rest;
    let k = 1;
    for (let i = 0; i < others.length; i++) {
      if (mask & (1 << i)) { rem = removeOne(rem, others[i], c.r); k++; }
    }
    for (const size of [3, 4]) {
      const need = size - k;
      if (need >= 0 && need <= w && canMeld(rem, w - need)) return true;
    }
  }

  // Seri (c en küçük kart olduğu için c'nin altındaki yerler ancak okeyle dolar)
  for (let start = c.r; start >= Math.max(2, c.r - w); start--) {
    let used = c.r - start;
    let rem = rest;
    for (let end = c.r; end <= 14; end++) {
      if (end > c.r) {
        const r2 = removeOne(rem, c.s, end);
        if (r2) rem = r2; else used++;
      }
      if (used > w) break;
      if (end - start + 1 >= 3 && canMeld(rem, w - used)) return true;
    }
  }
  return false;
}

// Bütün kartlar birebir aynı çiftlere ayrılabiliyor mu
function pairsOk(cards, w) {
  const cnt = {};
  for (const c of cards) cnt[c.s + c.r] = (cnt[c.s + c.r] || 0) + 1;
  let singles = 0;
  for (const k in cnt) singles += cnt[k] % 2;
  return singles <= w && (w - singles) % 2 === 0;
}

// 7 çift  veya  5 çift + 1 dörtlü per (4'lü seri ya da aynı sayıdan 4 renk)
function canPairs(cards, w, extra = 0) {
  if (pairsOk(cards, w + extra)) return true;
  // 4'lü seri: aynı renk ardışık 4 kağıt (Q-K-A geçerli, A-2-3 değil), eksikleri okey doldurur
  for (const s of SUITS) {
    for (let start = 2; start <= 11; start++) {
      let rem = cards;
      let need = 0;
      for (let r = start; r < start + 4; r++) {
        const r2 = removeOne(rem, s, r);
        if (r2) rem = r2; else need++;
      }
      if (need < 4 && need <= w && pairsOk(rem, w - need + extra)) return true;
    }
  }
  // 4'lü aynı sayı (dört farklı renk)
  for (let r = 2; r <= 14; r++) {
    const suits = [...new Set(cards.filter((c) => c.r === r).map((c) => c.s))];
    for (let mask = 1; mask < 1 << suits.length; mask++) {
      let rem = cards;
      let k = 0;
      for (let i = 0; i < suits.length; i++) {
        if (mask & (1 << i)) { rem = removeOne(rem, suits[i], r); k++; }
      }
      const need = 4 - k;
      if (need <= w && pairsOk(rem, w - need + extra)) return true;
    }
  }
  return false;
}

// Per/seriye girmeyen (boşta kalan) kağıtların en düşük toplamı. Okeyler joker, boşta kalırsa 0.
function minLeftover(cards, w, memo) {
  if (!cards.length) return 0;
  const key = cards.map((c) => c.s + c.r).join(',') + '|' + w;
  if (memo.has(key)) return memo.get(key);
  const c = cards[0];
  const rest = cards.slice(1);
  let best = cardValue(c.r) + minLeftover(rest, w, memo); // c boşta
  const others = [...new Set(rest.filter((x) => x.r === c.r && x.s !== c.s).map((x) => x.s))];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    let rem = rest;
    let k = 1;
    for (let i = 0; i < others.length; i++) if (mask & (1 << i)) { rem = removeOne(rem, others[i], c.r); k++; }
    for (const size of [3, 4]) {
      const need = size - k;
      if (need >= 0 && need <= w) best = Math.min(best, minLeftover(rem, w - need, memo));
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
      if (end - start + 1 >= 3) best = Math.min(best, minLeftover(rem, w - used, memo));
    }
  }
  memo.set(key, best);
  return best;
}

// Çift sayısı ve çiftlere girmeyen tek kağıtların toplamı (okey tek kağıtla çift olur)
function pairsInfo(nat, w, shown = null) {
  const cnt = {};
  for (const c of nat) cnt[c.s + c.r] = (cnt[c.s + c.r] || 0) + 1;
  let pairs = 0;
  const singles = [];
  for (const k in cnt) {
    pairs += Math.floor(cnt[k] / 2);
    if (cnt[k] % 2) singles.push({ s: k[0], r: +k.slice(1) });
  }
  singles.sort((a, b) => cardValue(b.r) - cardValue(a.r));
  // Gösterge gösterildiyse: o kağıt istenen (en değerli) tek kağıtla çift sayılır
  if (shown) {
    if (singles.length) { singles.shift(); pairs++; }
    else singles.push({ s: shown.s, r: shown.r });
  }
  // Kural: çifte giden oyuncuda SADECE EN YÜKSEK TEK PER düşülür; diğer her şey (öteki perler dahil) yazılır.
  // Okeyler tek kağıtlarla çift yapılabilir ya da o perde kullanılabilir; kalan toplam en aza indirilir.
  const maxUse = Math.min(w, singles.length);
  let leftover = Infinity;
  for (let u = 0; u <= maxUse; u++) {
    const rest = singles.slice(u);
    const total = rest.reduce((a, c) => a + cardValue(c.r), 0);
    leftover = Math.min(leftover, total - bestSingleMeld(rest, w - u).value);
  }
  pairs += maxUse + Math.floor((w - maxUse) / 2);
  return { pairs, leftover };
}

// Kağıtlardan kurulabilecek EN DEĞERLİ tek per (okeyler joker). value: perdeki kağıtların puan toplamı
function bestSingleMeld(cards, w) {
  let best = { value: 0, group: null };
  const has = (s, r) => cards.some((c) => c.s === s && c.r === r);
  // Aynı sayı, farklı renk (3-4)
  for (let r = 2; r <= 14; r++) {
    const suits = [...new Set(cards.filter((c) => c.r === r).map((c) => c.s))].slice(0, 4);
    const need = Math.max(0, 3 - suits.length);
    if (suits.length && need <= w) {
      const value = cardValue(r) * suits.length;
      if (value > best.value) best = { value, group: [...suits.map((s) => ({ s, r })), ...Array(need).fill('W')] };
    }
  }
  // Aynı renk sıralı (en az 3, Q-K-A geçerli, A-2-3 değil)
  for (const s of SUITS) {
    for (let start = 2; start <= 12; start++) {
      for (let end = start + 2; end <= 14; end++) {
        let need = 0;
        let value = 0;
        const group = [];
        for (let r = start; r <= end; r++) {
          if (has(s, r)) { value += cardValue(r); group.push({ s, r }); } else { need++; group.push('W'); }
        }
        if (need <= w && need < end - start + 1 && value > best.value) best = { value, group };
      }
    }
  }
  return best;
}

// minLeftover ile aynı arama, ama hangi kağıtların per olduğunu da döndürür
// gruplar {s,r} ya da 'W' (okey) listesi; left: boşta kalan {s,r}
function planLeftover(cards, w, memo) {
  if (!cards.length) return { cost: 0, groups: [], left: [] };
  const key = cards.map((c) => c.s + c.r).join(',') + '|' + w;
  if (memo.has(key)) return memo.get(key);
  const c = cards[0];
  const rest = cards.slice(1);
  const skip = planLeftover(rest, w, memo);
  let best = { cost: cardValue(c.r) + skip.cost, groups: skip.groups, left: [c, ...skip.left] };
  const consider = (group, rem, wLeft) => {
    const sub = planLeftover(rem, wLeft, memo);
    if (sub.cost < best.cost) best = { cost: sub.cost, groups: [group, ...sub.groups], left: sub.left };
  };
  const others = [...new Set(rest.filter((x) => x.r === c.r && x.s !== c.s).map((x) => x.s))];
  for (let mask = 0; mask < 1 << others.length; mask++) {
    let rem = rest;
    const g = [c];
    for (let i = 0; i < others.length; i++) if (mask & (1 << i)) { rem = removeOne(rem, others[i], c.r); g.push({ s: others[i], r: c.r }); }
    for (const size of [3, 4]) {
      const need = size - g.length;
      if (need >= 0 && need <= w) consider([...g, ...Array(need).fill('W')], rem, w - need);
    }
  }
  for (let start = c.r; start >= Math.max(2, c.r - w); start--) {
    let used = c.r - start;
    let rem = rest;
    const g = [...Array(used).fill('W'), c];
    for (let end = c.r; end <= 14; end++) {
      if (end > c.r) {
        const r2 = removeOne(rem, c.s, end);
        if (r2) { rem = r2; g.push({ s: c.s, r: end }); } else { used++; g.push('W'); }
      }
      if (used > w) break;
      if (end - start + 1 >= 3) consider(g.slice(), rem, w - used);
    }
  }
  memo.set(key, best);
  return best;
}

// Bir elin açıklaması: kağıt kimlikleriyle perler, çiftler ve boşta kalanlar
function explainHand(cards, okey, kind, shownId = null) {
  const wilds = cards.filter((c) => isWild(c, okey));
  const pool = {};
  for (const c of cards) {
    if (isWild(c, okey)) continue;
    const k = c.joker ? okey.s + okey.r : c.s + c.r;
    (pool[k] = pool[k] || []).push(c.id);
  }
  const take = (x) => (x === 'W' ? wilds.shift().id : pool[x.s + x.r].shift());
  const { nat, w } = split(cards, okey);
  const out = { melds: [], pairs: [], left: [] };
  if (kind === 'pairs' || kind === 'ready' || kind === 'pairsWin') {
    const sh = shownId ? cards.find((c) => c.id === shownId) : null;
    let pnat = nat;
    if (sh) { pnat = removeOne(nat, sh.s, sh.r) || nat; pool[sh.s + sh.r].splice(pool[sh.s + sh.r].indexOf(sh.id), 1); }
    const cnt = {};
    for (const c of pnat) cnt[c.s + c.r] = (cnt[c.s + c.r] || 0) + 1;
    const pairsOnly = kind === 'pairs' || kind === 'pairsWin' || canPairsQuick(pnat, w + (sh ? 1 : 0));
    if (pairsOnly) {
      let singles = [];
      for (const k in cnt) {
        for (let i = 0; i < Math.floor(cnt[k] / 2); i++) out.pairs.push([pool[k].shift(), pool[k].shift()]);
        if (cnt[k] % 2) singles.push({ s: k[0], r: +k.slice(1) });
      }
      singles.sort((a, b) => cardValue(b.r) - cardValue(a.r));
      if (sh) { // gösterge: en değerli tek kağıtla çift
        if (singles.length) out.pairs.push([take(singles.shift()), sh.id]);
        else { pool[sh.s + sh.r].push(sh.id); singles.push({ s: sh.s, r: sh.r }); }
      }
      // okeyleri en yüksek teklerle eşle. Çifte giden (ceza): kalan tekler perden sayılmaz, hepsi boşta.
      // Biten / okeye dönen: kalanlarla per aranır (5 çift + dörtlü gibi).
      let bestU = 0;
      let bestPlan = null;
      for (let u = 0; u <= Math.min(w, singles.length); u++) {
        const rest = singles.slice(u).sort((a, b) => a.r - b.r || a.s.localeCompare(b.s));
        let p;
        if (kind === 'pairs') {
          // çifte giden (ceza): sadece en yüksek TEK per düşülür, kalan her şey boşta
          const m = bestSingleMeld(rest, w - u);
          const left = rest.slice();
          if (m.group) for (const x of m.group) if (x !== 'W') left.splice(left.findIndex((c) => c.s === x.s && c.r === x.r), 1);
          p = { cost: left.reduce((a, c) => a + cardValue(c.r), 0), groups: m.group ? [m.group] : [], left };
        } else p = planLeftover(rest, w - u, new Map());
        if (!bestPlan || p.cost < bestPlan.cost) { bestPlan = p; bestU = u; }
      }
      for (let i = 0; i < bestU; i++) out.pairs.push([take(singles[i]), wilds.shift().id]);
      for (const g of bestPlan.groups) out.melds.push(g.map(take));
      for (const x of bestPlan.left) out.left.push(take(x));
      while (wilds.length >= 2) out.pairs.push([wilds.shift().id, wilds.shift().id]);
      out.left.push(...wilds.map((c) => c.id));
      return out;
    }
  }
  if (kind === 'noMeld') {
    out.left = cards.map((c) => c.id);
    return out;
  }
  const p = planLeftover(nat, w, new Map());
  for (const g of p.groups) out.melds.push(g.map(take));
  for (const x of p.left) out.left.push(take(x));
  out.left.push(...wilds.map((c) => c.id)); // boşta kalan okey (0 sayılır)
  return out;
}
function canPairsQuick(nat, w) {
  const cnt = {};
  for (const c of nat) cnt[c.s + c.r] = (cnt[c.s + c.r] || 0) + 1;
  let singles = 0;
  for (const k in cnt) singles += cnt[k] % 2;
  return canPairs(nat, w) && planLeftover(nat, w, new Map()).cost > 0; // çift düzeniyle bitiyor, per düzeniyle değil
}

// ---------- Oyuncunun KENDİ dizilişine göre ceza (gerçek masadaki gibi: ne açtıysan o sayılır) ----------
function meldValid(cards, okey) {
  let w = 0;
  const nat = [];
  for (const c of cards) {
    if (isWild(c, okey)) w++;
    else nat.push(c.joker ? { s: okey.s, r: okey.r } : c);
  }
  if (!nat.length) return false;
  if (cards.length <= 4 && nat.every((c) => c.r === nat[0].r) && new Set(nat.map((c) => c.s)).size === nat.length) return true;
  if (!nat.every((c) => c.s === nat[0].s)) return false;
  const rs = nat.map((c) => c.r).sort((a, b) => a - b);
  if (new Set(rs).size !== rs.length) return false;
  const gaps = rs[rs.length - 1] - rs[0] + 1 - rs.length;
  if (gaps > w) return false;
  return w - gaps <= rs[0] - 2 + (14 - rs[rs.length - 1]);
}
function pairValid([a, b], okey, shownId) {
  if (a.joker && b.joker) return true;
  if (isWild(a, okey) || isWild(b, okey)) return true;
  if (shownId && (a.id === shownId || b.id === shownId)) return true;
  if (a.joker || b.joker) return false;
  return a.s === b.s && a.r === b.r;
}
function groupKind(cs, okey, shownId) {
  if (cs.length === 2 && pairValid(cs, okey, shownId)) return 'pair';
  if (cs.length >= 3 && meldValid(cs, okey)) return 'meld';
  return null;
}
// Dizilişteki kesintisiz diziler: ön sıra bir dizi; arka katlarda boşlukla ayrılmış her grup bir dizi
function declaredSegments(decl, byId) {
  const segs = [];
  for (const row of [decl.r1 || [], decl.r2 || []]) {
    let cur = [];
    for (const id of [...row, null]) {
      if (id === null) { if (cur.length) segs.push(cur); cur = []; }
      else if (byId.has(id)) cur.push(id);
    }
  }
  const front = (decl.front || []).filter((id) => byId.has(id));
  if (front.length) segs.push(front);
  return segs;
}
// Bir diziyi YAN YANA duran geçerli per/çiftlere en iyi şekilde böl (boşta kalan en az; eşitse çift çok).
// Örn: ♥J ♥Q ♥K ♦9 ♦10 ♦J araya boşluk konmasa da iki per sayılır. Yan yana olmayanlar birleştirilmez.
function partitionSegment(seg, byId, okey, shownId, allowPairs, val) {
  const n = seg.length;
  const dp = new Array(n + 1);
  dp[n] = { cost: 0, pairs: 0, groups: [] };
  for (let i = n - 1; i >= 0; i--) {
    const skip = dp[i + 1];
    let best = { cost: val(byId.get(seg[i])) + skip.cost, pairs: skip.pairs, groups: skip.groups };
    for (let j = i + 1; j < Math.min(n, i + 14); j++) {
      const ids = seg.slice(i, j + 1);
      const k = groupKind(ids.map((id) => byId.get(id)), okey, shownId);
      if (!k || (k === 'pair' && !allowPairs)) continue;
      const rest = dp[j + 1];
      const cand = { cost: rest.cost, pairs: rest.pairs + (k === 'pair' ? 1 : 0), groups: [{ ids, kind: k }, ...rest.groups] };
      if (cand.cost < best.cost || (cand.cost === best.cost && cand.pairs > best.pairs)) best = cand;
    }
    dp[i] = best;
  }
  return dp[0];
}
function assessDeclared(hand, okey, decl, shownId) {
  const byId = new Map(hand.map((c) => [c.id, c]));
  const val = (c) => (isWild(c, okey) ? 0 : cardValue(c.joker ? okey.r : c.r));
  const sumOf = (ids) => ids.reduce((a, id) => a + val(byId.get(id)), 0);
  const all = hand.map((c) => c.id);
  const segs = declaredSegments(decl, byId);
  const run = (allowPairs) => segs.map((s) => partitionSegment(s, byId, okey, shownId, allowPairs, val)).flatMap((p) => p.groups);
  // Çifte gidiyorsa (en az 4 çift açtıysa): çiftlere ve perlere girmeyen kağıtlar yazılır
  const withPairs = run(true);
  const pairs = withPairs.filter((g) => g.kind === 'pair').map((g) => g.ids);
  if (pairs.length >= CONFIG.minPairs) {
    // çifte giderken sadece EN YÜKSEK tek per düşülür; diğer perler boşta sayılır
    const allMelds = withPairs.filter((g) => g.kind === 'meld').map((g) => g.ids);
    const top = allMelds.reduce((b, m) => (!b || sumOf(m) > sumOf(b) ? m : b), null);
    const melds = top ? [top] : [];
    const used = new Set([...pairs.flat(), ...melds.flat()]);
    const left = all.filter((id) => !used.has(id));
    return { kind: 'pairs', base: sumOf(left), pairs: pairs.length, declared: true, explain: { melds, pairs, left } };
  }
  // Normal: sadece perler düşülür
  const melds = run(false).filter((g) => g.kind === 'meld').map((g) => g.ids);
  if (melds.length) {
    const used = new Set(melds.flat());
    const left = all.filter((id) => !used.has(id));
    return { kind: 'normal', base: sumOf(left), declared: true, explain: { melds, pairs: [], left } };
  }
  return { kind: 'noMeld', base: sumOf(all), declared: true, explain: { melds: [], pairs: [], left: all } };
}

// Biri bittiğinde bir oyuncunun eli nasıl yazılır
//  pairs : en az 4 çift  -> boştaki tekler x2
//  normal: en az 1 per   -> perlere girmeyen kağıtlar
//  noMeld: per yok       -> sabit ceza (100 x renk)
function assessHand(cards, okey, shownId = null) {
  const sh = shownId ? cards.find((c) => c.id === shownId) : null;
  const ps = split(sh ? cards.filter((c) => c !== sh) : cards, okey);
  const p = pairsInfo(ps.nat, ps.w, sh);
  if (p.pairs >= CONFIG.minPairs) return { kind: 'pairs', base: p.leftover, pairs: p.pairs, shown: !!sh };
  const { nat, w } = split(cards, okey);
  const total = nat.reduce((a, c) => a + cardValue(c.r), 0);
  const left = minLeftover(nat, w, new Map());
  if (left < total) return { kind: 'normal', base: left };
  return { kind: 'noMeld', base: total };
}

function evaluateFinish(cards, okey, shownId = null) {
  if (cards.length !== CONFIG.handSize) return { ok: false };
  const sh = shownId ? cards.find((c) => c.id === shownId) : null;
  if (sh) { // gösterilen kağıt çiftte joker
    const ps = split(cards.filter((c) => c !== sh), okey);
    if (canPairs(ps.nat, ps.w, 1)) return { ok: true, pairs: true };
  }
  const { nat, w } = split(cards, okey);
  if (canPairs(nat, w)) return { ok: true, pairs: true };
  if (canMeld(nat, w)) return { ok: true, pairs: false };
  return { ok: false };
}

function handPoints(cards, okey) {
  let sum = 0;
  for (const c of cards) {
    if (c.joker) sum += cardValue(okey.r);
    else if (isWild(c, okey)) sum += CONFIG.heldOkeyPoints ?? cardValue(c.r);
    else sum += cardValue(c.r);
  }
  return sum;
}

// Botun (ve dizilişi bilinmeyen oyuncunun) eli: renk grupları, sayı sırası, okeyler sonda
function autoSort(hand, okey) {
  const order = { S: 0, H: 1, C: 2, D: 3 };
  const special = (c) => c.joker || isWild(c, okey);
  return hand.slice().sort((a, b) => {
    const sa = special(a);
    const sb = special(b);
    if (sa !== sb) return sa ? 1 : -1;
    if (sa) return 0;
    return order[a.s] - order[b.s] || a.r - b.r;
  });
}

class Game {
  constructor({ mode, totalHands, names }) {
    this.mode = mode; // 'solo' | 'team' (0&2 vs 1&3)
    this.totalHands = totalHands;
    this.names = names;
    this.handNo = 0;
    this.dealer = crypto.randomInt(4);
    this.scores = [];
    this.active = [0, 1, 2, 3]; // bu elde oynayanlar (finalde 2 kişi)
    this.final = null;          // { first, second, players: [a, b] }
    this.standings = null;      // oyun sonu sıralama
    this.startHand();
  }

  nextSeat(seat) { const a = this.active; return a[(a.indexOf(seat) + 1) % a.length]; }
  prevSeat(seat) { const a = this.active; return a[(a.indexOf(seat) + a.length - 1) % a.length]; }
  totals() { return [0, 1, 2, 3].map((i) => this.scores.reduce((a, h) => a + h[i], 0)); }

  startHand() {
    this.handNo++;
    this.dealer = this.active.includes(this.dealer) ? this.nextSeat(this.dealer) : this.active[0];
    const deck = shuffle(makeDeck());
    const gi = deck.findIndex((c) => !c.joker);
    this.indicator = deck.splice(gi, 1)[0];
    this.okey = { s: this.indicator.s, r: nextRank(this.indicator.r) };
    const first = this.nextSeat(this.dealer);
    this.hands = [0, 1, 2, 3].map((i) => (this.active.includes(i) ? deck.splice(0, i === first ? CONFIG.handSize + 1 : CONFIG.handSize) : []));
    this.deck = deck;
    this.pile = []; // ortaya atılan kağıtlar: {...kart, by: atan koltuk}
    this.acted = [false, false, false, false]; // bu elde kağıt çekti/attı mı (gösterge ancak önce gösterilir)
    this.arr = [null, null, null, null];         // oyuncunun elini dizdiği sıra (kağıt kimlikleri)
    this.decl = [null, null, null, null];        // dizilişin katları: { front, r1, r2 } (ceza bundan hesaplanır)
    this.settle = null;                          // biri bitince 30 sn el açma süresi
    this.pending = null;
    this.lastDraw = [null, null, null, null];    // son çekilen kağıt (rakip elinde nereye koydu)
    this.lastDiscardIdx = [-1, -1, -1, -1];      // son atılan kağıt elinin neresindeydi
    this.shown = null; // gösterge gösteren: { seat, id, card, seq }
    this.showTried = [false, false, false, false]; // el başına bir deneme
    this.showPts = [0, 0, 0, 0];                   // gösterge ödülü / yanlış gösterme cezası
    this.showEvent = null;                         // herkese gösterilecek duyuru (gösterge / okey atma)
    this.okeyPts = [0, 0, 0, 0];                   // yere okey atma cezası
    this.freezeUntil = 0;                          // duyuru sırasında oyun 1 sn durur
    this.turn = first;
    this.phase = 'discard'; // 15 kartlı oyuncu önce atar
    this.status = 'playing';
    this.result = null;
    this.log = [`${this.handNo}. el başladı. ${this.names[first]} 15 kartla başlıyor.`];
  }

  // Elin dizilişi: oyuncunun gönderdiği sıra; yoksa (bot) insan gibi renk + sıraya göre dizer
  setArrangement(seat, ids, rows) {
    if (!Array.isArray(ids)) return;
    const have = new Set(this.hands[seat].map((c) => c.id));
    this.arr[seat] = ids.filter((id) => typeof id === 'string' && have.has(id)).slice(0, 20);
    if (rows && typeof rows === 'object') {
      const clean = (a) => (Array.isArray(a) ? a.filter((id) => id === null || (typeof id === 'string' && have.has(id))).slice(0, 40) : []);
      this.decl[seat] = { front: clean(rows.front), r1: clean(rows.r1), r2: clean(rows.r2) };
    }
  }

  // Biri bitti: gerçek oyuncular 30 sn içinde ellerini açar (düzenler), sonra ceza yazılır.
  // Bekleyecek gerçek oyuncu yoksa (botlar, testler) hemen yazılır.
  beginSettle(winner, pairs, okeyDiscard) {
    this.pending = { winner, pairs, okeyDiscard };
    const need = this.active.filter((i) => i !== winner && this.humans && this.humans[i] && !(this.mode === 'team' && i % 2 === winner % 2));
    if (!need.length) { this.endHand(winner, pairs, okeyDiscard); return; }
    this.status = 'settle';
    this.settle = { deadline: Date.now() + CONFIG.settleMs, need, confirmed: [], winner, pairs, okeyDiscard };
  }
  confirmHand(seat) {
    if (this.status !== 'settle') throw new Error('Şu an el açılmıyor.');
    if (!this.settle.need.includes(seat)) return;
    if (!this.settle.confirmed.includes(seat)) this.settle.confirmed.push(seat);
    if (this.settle.need.every((i) => this.settle.confirmed.includes(i))) this.finishSettle();
  }
  finishSettle() {
    if (this.status !== 'settle') return;
    const p = this.pending;
    this.settle = null;
    this.endHand(p.winner, p.pairs, p.okeyDiscard);
  }
  arranged(seat) {
    const h = this.hands[seat];
    if (!this.arr[seat]) return autoSort(h, this.okey);
    const byId = new Map(h.map((c) => [c.id, c]));
    const out = this.arr[seat].filter((id) => byId.has(id)).map((id) => byId.get(id));
    for (const c of h) if (!out.includes(c)) out.push(c); // henüz yerleştirilmemiş yeni kağıt sonda
    return out;
  }

  shownFor(seat) { return this.shown && this.shown.seat === seat ? this.shown.id : null; }

  // Gösterge: yerdeki göstergenin eşi elindeyse, sırası gelip kağıt çekmeden önce gösterebilir
  canShow(seat) {
    if (this.status !== 'playing' || this.turn !== seat || this.acted[seat] || this.shown) return false;
    const ind = this.indicator;
    return this.hands[seat].some((c) => !c.joker && c.s === ind.s && c.r === ind.r);
  }
  // Düğme herkese hep açık (kimde gösterge olduğu belli olmasın). Göstergesi yokken gösteren +50 ceza yer.
  showIndicator(seat) {
    if (this.status !== 'playing') throw new Error('El bitti.');
    if (this.frozen()) throw new Error('Bir saniye bekle…');
    if (this.shown) throw new Error('Gösterge zaten gösterildi.');
    if (this.turn !== seat || this.acted[seat]) throw new Error('Gösterge ancak sıran gelince, kağıt çekmeden önce gösterilir.');
    if (this.showTried[seat]) throw new Error('Bu elde göstergeyi zaten denedin.');
    this.showTried[seat] = true;
    this.showSeq = (this.showSeq || 0) + 1;
    const ind = this.indicator;
    const card = this.hands[seat].find((c) => !c.joker && c.s === ind.s && c.r === ind.r);
    if (card) {
      const pts = -CONFIG.showBonus * CONFIG.suitMultiplier[this.okey.s];
      this.showPts[seat] += pts;
      this.shown = { seat, id: card.id, card, seq: this.showSeq };
      this.showEvent = { type: 'show', seat, ok: true, card, pts, seq: this.showSeq };
      this.addLog(` göstergeyi gösterdi! (${pts})`);
    } else {
      this.showPts[seat] += CONFIG.falseShowPenalty;
      this.showEvent = { type: 'falseShow', seat, ok: false, pts: CONFIG.falseShowPenalty, seq: this.showSeq };
      this.addLog(` göstergesi yokken gösterdi: +${CONFIG.falseShowPenalty} ceza!`);
    }
    this.freeze();
  }

  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 8) this.log.shift();
  }

  frozen() { return Date.now() < this.freezeUntil; }
  freeze() { this.freezeUntil = Date.now() + CONFIG.freezeMs; }

  check(seat, phase) {
    if (this.status !== 'playing') throw new Error('El bitti.');
    if (this.frozen()) throw new Error('Bir saniye bekle…');
    if (seat !== this.turn) throw new Error('Sıra sizde değil.');
    if (this.phase !== phase) throw new Error(phase === 'draw' ? 'Önce kart atmalısınız.' : 'Önce kart çekmelisiniz.');
  }

  draw(seat, src) {
    this.check(seat, 'draw');
    this.taken = null;
    this.acted[seat] = true;
    let card;
    if (src === 'deck') {
      card = this.deck.pop();
      if (!card) throw new Error('Deste bitti.');
      this.addLog(`${this.names[seat]} desteden çekti.`);
      this.lastDraw[seat] = card.id;
    } else {
      const top = this.pile[this.pile.length - 1];
      if (!top || top.by !== this.prevSeat(seat)) throw new Error('Yerde alınacak kağıt yok.');
      if (isWild(top, this.okey)) throw new Error('Yerdeki okey alınamaz.');
      this.pile.pop();
      const { by, ...rest } = top;
      card = rest;
      this.taken = { seat, id: card.id, by }; // geri bırakılabilir
      this.lastDraw[seat] = card.id;
      this.addLog(`${this.names[seat]} yerden ${label(card)} aldı.`);
    }
    this.hands[seat].push(card);
    this.phase = 'discard';
    return card;
  }

  // Yerden alınan kağıdı (kağıt atmadan önce) yere geri bırak; oyuncu yeniden çeker
  undoTake(seat) {
    this.check(seat, 'discard');
    const t = this.taken;
    if (!t || t.seat !== seat) throw new Error('Geri bırakılacak kağıt yok.');
    const hand = this.hands[seat];
    const i = hand.findIndex((c) => c.id === t.id);
    if (i < 0) throw new Error('Kağıt elinizde yok.');
    const [card] = hand.splice(i, 1);
    this.pile.push({ ...card, by: t.by });
    this.taken = null;
    this.phase = 'draw';
    this.addLog(`${this.names[seat]} ${label(card)} kağıdını geri bıraktı.`);
  }

  discard(seat, cardId, finish) {
    this.check(seat, 'discard');
    this.taken = null;
    this.acted[seat] = true;
    const hand = this.hands[seat];
    const i = hand.findIndex((c) => c.id === cardId);
    if (i < 0) throw new Error('Kart elinizde yok.');
    const card = hand[i];
    this.lastDiscardIdx[seat] = this.arranged(seat).findIndex((c) => c.id === cardId);
    if (finish) {
      const ev = evaluateFinish(hand.filter((_, j) => j !== i), this.okey, this.shownFor(seat));
      if (!ev.ok) throw new Error('Eliniz bitmeye uygun değil.');
      hand.splice(i, 1);
      this.pile.push({ ...card, by: seat });
      this.addLog(`${this.names[seat]} ${label(card)} atarak bitti!`);
      this.beginSettle(seat, ev.pairs, isWild(card, this.okey));
      return;
    }
    hand.splice(i, 1);
    this.pile.push({ ...card, by: seat });
    this.addLog(`${this.names[seat]} ${label(card)} attı.`);
    if (isWild(card, this.okey)) { // bitmeden yere okey atmak cezalı (her zaman 100)
      const pen = CONFIG.okeyThrowPenalty;
      this.okeyPts[seat] += pen;
      this.showSeq = (this.showSeq || 0) + 1;
      this.showEvent = { type: 'okey', seat, ok: false, card, pts: pen, seq: this.showSeq };
      this.addLog(`${this.names[seat]} yere okey attı: +${pen} ceza!`);
      this.freeze();
    }
    if (!this.deck.length) {
      this.addLog('Deste bitti, el berabere.');
      this.endHand(null);
      return;
    }
    this.turn = this.nextSeat(seat);
    this.phase = 'draw';
  }

  endHand(winner, pairs = false, okeyDiscard = false) {
    const sm = CONFIG.suitMultiplier[this.okey.s];
    const special = pairs || okeyDiscard; // çiftten bitti ya da okey attı
    const pts = [0, 0, 0, 0];
    const detail = [null, null, null, null];
    if (winner !== null) {
      pts[winner] = -CONFIG.finishPoints * (special ? sm : 1);
      detail[winner] = { kind: 'winner', explain: explainHand(this.hands[winner], this.okey, pairs ? 'pairsWin' : 'ready', this.shownFor(winner)) };
      for (const i of this.active) {
        if (i === winner) continue;
        if (this.mode === 'team' && i % 2 === winner % 2) { detail[i] = { kind: 'partner' }; continue; } // eş ceza yazmaz
        // Okeye dönmüş: eli bitmeye hazırdı ama bitmedi -> sabit ceza
        const sid = this.shownFor(i);
        // Okeye dönmüş el her zaman sabit ceza; gerçek oyuncu kendi dizilişine göre, bot en iyi dizilişe göre yazılır
        let a;
        if (evaluateFinish(this.hands[i], this.okey, sid).ok) a = { kind: 'ready' };
        else if (this.humans && this.humans[i] && this.decl[i]) a = assessDeclared(this.hands[i], this.okey, this.decl[i], sid);
        else a = assessHand(this.hands[i], this.okey, sid);
        let pen;
        if (a.kind === 'ready') pen = CONFIG.readyPenalty * sm;
        // boştaki toplam okeyin rengine göre çarpılır (sinek 2, maça 3, karo 4, kupa 5)
        else if (a.kind === 'pairs') pen = a.base * sm * CONFIG.pairsLoserMultiplier;
        else if (a.kind === 'normal') pen = a.base * sm;
        else pen = CONFIG.noMeldPenalty * sm;
        if (special) pen *= CONFIG.specialLoserMultiplier;
        pts[i] = pen;
        detail[i] = a.explain ? a : { ...a, explain: explainHand(this.hands[i], this.okey, a.kind, sid) };
      }
    }
    const showPts = this.showPts.slice(); // gösterge ödülü / yanlış gösterme cezası
    const okeyPts = this.okeyPts.slice(); // yere okey atma cezası
    for (let i = 0; i < 4; i++) pts[i] += showPts[i] + okeyPts[i];
    this.scores.push(pts);
    this.result = { winner, pairs, okeyDiscard, special, suitMult: sm, okeySuit: this.okey.s, detail, showPts, okeyPts, pts, hands: this.hands.map((h) => h.slice()) };
    this.status = this.handNo >= this.totalHands ? 'gameOver' : 'handOver';
    const totals = this.totals();
    const rank = [0, 1, 2, 3].sort((a, b) => totals[a] - totals[b] || a - b);
    // Tekli oyunda son el final: en çok cezası olan 2 kişi oynar, diğer 2 kişi kazanmış sayılır
    if (this.status === 'handOver' && this.mode === 'solo' && this.handNo === this.totalHands - 1) {
      this.final = { first: rank[0], second: rank[1], players: [rank[2], rank[3]] };
    }
    if (this.status === 'gameOver') {
      if (this.mode === 'team') {
        const a = totals[0] + totals[2];
        const b = totals[1] + totals[3];
        this.standings = { team: true, winners: a === b ? [] : a < b ? [0, 2] : [1, 3], tie: a === b };
      } else if (this.final) {
        const [p, q] = this.final.players;
        // Finali kazanan: final eli de yazıldıktan sonra TOPLAM puanı düşük olan (eli bitirmek yetmeyebilir).
        // Eşitlikte final elini bitiren; o da yoksa final elinde daha az yazan.
        let fw;
        if (totals[p] !== totals[q]) fw = totals[p] < totals[q] ? p : q;
        else if (winner === p || winner === q) fw = winner;
        else fw = pts[p] <= pts[q] ? p : q;
        this.standings = { first: this.final.first, second: this.final.second, finalWinner: fw, finalLoser: fw === p ? q : p };
      } else {
        this.standings = { first: rank[0], second: rank[1], finalWinner: rank[2], finalLoser: rank[3] };
      }
    }
  }

  nextHand() {
    if (this.status !== 'handOver') throw new Error('El devam ediyor.');
    if (this.final && this.handNo + 1 === this.totalHands) this.active = this.final.players.slice().sort();
    this.startHand();
  }

  view(seat) {
    const over = this.status !== 'playing';
    return {
      mode: this.mode,
      totalHands: this.totalHands,
      handNo: this.handNo,
      dealer: this.dealer,
      status: this.status,
      turn: this.turn,
      phase: this.phase,
      indicator: this.indicator,
      okey: this.okey,
      deckCount: this.deck.length,
      deckTop: this.deck.length ? this.deck[this.deck.length - 1].b : null, // destenin üstündeki kağıdın arka rengi (gerçekte görünür)
      // rakiplerin kağıt arkaları, elini dizdiği sırayla (gerçek masadaki gibi)
      backs: this.hands.map((h, i) => {
        if (i === seat) return null;
        const a = this.arranged(i);
        return { colors: a.map((c) => c.b), lastIdx: a.findIndex((c) => c.id === this.lastDraw[i]), discIdx: this.lastDiscardIdx[i] };
      }),
      pile: this.pile,
      takenId: this.taken && this.taken.seat === seat ? this.taken.id : null,
      handCounts: this.hands.map((h) => h.length),
      myHand: seat == null ? [] : this.hands[seat],
      scores: this.scores,
      log: this.log,
      result: over ? this.result : null,
      active: this.active,
      shown: this.shown ? { seat: this.shown.seat, card: this.shown.card, seq: this.shown.seq } : null,
      showEvent: this.showEvent,
      // elim okeye dönmüş mü (bitmeye hazır): çekme sırasında ipucu göstermek için, sadece bana
      myReady: seat != null && this.status === 'playing' && this.hands[seat].length === CONFIG.handSize && evaluateFinish(this.hands[seat], this.okey, this.shownFor(seat)).ok,
      settle: this.settle ? { deadline: this.settle.deadline, need: this.settle.need, confirmed: this.settle.confirmed, winner: this.settle.winner, pairs: this.settle.pairs, okeyDiscard: this.settle.okeyDiscard, now: Date.now() } : null,
      freezeLeft: Math.max(0, this.freezeUntil - Date.now()),
      final: this.final,
      standings: this.standings,
    };
  }
}

module.exports = { Game, CONFIG, evaluateFinish, handPoints, assessHand, assessDeclared, makeDeck, nextRank, split, isWild, cardValue, removeOne };
