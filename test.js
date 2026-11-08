'use strict';
const assert = require('assert');
const { evaluateFinish, handPoints, makeDeck, nextRank, Game, assessHand, assessDeclared } = require('./game');

let n = 0;
const C = (str) => str.split(' ').map((t) => {
  if (t === 'X') return { id: 'X' + n++, joker: true };
  const s = t[0];
  const rr = t.slice(1);
  const r = { J: 11, Q: 12, K: 13, A: 14 }[rr] || +rr;
  return { id: t + n++, s, r };
});
const okey = { s: 'C', r: 12 }; // gösterge ♣J -> okey ♣Q
const ev = (h) => evaluateFinish(C(h), okey);

assert.strictEqual(makeDeck().length, 106);
assert.strictEqual(nextRank(11), 12);
assert.strictEqual(nextRank(14), 2);

// Seriler + perler
assert.deepStrictEqual(ev('H2 H3 H4 H5 S7 H7 D7 SQ SK SA D9 D10 DJ DQ'), { ok: true, pairs: false });
// A-2-3 geçersiz
assert.strictEqual(ev('HA H2 H3 S7 H7 D7 SQ SK SA D9 D10 DJ DQ H5').ok, false);
// K-A-2 geçersiz
assert.strictEqual(ev('HK HA H2 S7 H7 D7 S3 S4 S5 D9 D10 DJ DQ H5').ok, false);
// Okey (♣Q) joker olarak boşluk doldurur
assert.deepStrictEqual(ev('H2 CQ H4 H5 S7 H7 D7 SQ SK SA D9 D10 DJ DQ'), { ok: true, pairs: false });
// Sahte okey ♣Q yerine geçer: ♣J ♣Q ♣K
assert.deepStrictEqual(ev('CJ X CK H4 H5 H6 S7 H7 D7 D9 D10 DJ DQ DK'), { ok: true, pairs: false });
// Sahte okey joker değil: ♠5 X ♠7 olmaz
assert.strictEqual(ev('S5 X S7 H5 H6 H4 S9 H9 D9 SQ SK SA D2 D3').ok, false);
// Aynı renkten iki kart per olmaz
assert.strictEqual(ev('S7 S7 D7 H2 H3 H4 SQ SK SA D9 D10 DJ DQ H5').ok, false);
// 7 çift
assert.deepStrictEqual(ev('S2 S2 H5 H5 D9 D9 SK SK CA CA H10 H10 D3 D3'), { ok: true, pairs: true });
// 7 çift, okeyle
assert.deepStrictEqual(ev('S2 S2 H5 H5 D9 D9 SK SK CA CA H10 H10 D3 CQ'), { ok: true, pairs: true });
// 5 çift + dörtlü per
assert.deepStrictEqual(ev('S2 S2 H5 H5 D9 D9 SK SK CA CA S8 H8 D8 C8'), { ok: true, pairs: true });
// 4 çift + dörtlü per + tek: olmaz
assert.strictEqual(ev('S2 S2 H5 H5 D9 D9 SK SK CA C3 S8 H8 D8 C8').ok, false);
// Uzun seri ve iki okey
assert.deepStrictEqual(ev('S2 S3 CQ S5 S6 S7 S8 S9 S10 SJ CQ SK SA HA').ok, false);
assert.deepStrictEqual(ev('S2 S3 CQ S5 S6 S7 S8 S9 S10 SJ CQ SK SA H4').ok, false);
assert.deepStrictEqual(ev('S2 S3 CQ S5 S6 S7 S8 S9 S10 SJ SQ SK SA CQ').ok, true);

// Puanlar: A=11, 10-K=10, diğerleri kendi
assert.strictEqual(handPoints(C('SA SK H10 D2 C9'), okey), 11 + 10 + 10 + 2 + 9);

// Simülasyon: rastgele oyunlar çökmeden biter
for (let g = 0; g < 50; g++) {
  const game = new Game({ mode: g % 2 ? 'team' : 'solo', totalHands: 1, names: ['a', 'b', 'c', 'd'] });
  game.freeze = () => {}; // simülasyonda 1 sn'lik duyuru beklemesi yok
  while (game.status === 'playing') {
    const s = game.turn;
    const top = game.pile[game.pile.length - 1];
    const canPile = top && !(top.s === game.okey.s && top.r === game.okey.r && !top.joker); // yerdeki okey alınamaz
    if (game.phase === 'draw') game.draw(s, Math.random() < 0.3 && canPile ? 'pile' : 'deck');
    const hand = game.hands[s];
    game.discard(s, hand[Math.floor(Math.random() * hand.length)].id, false);
  }
  assert.strictEqual(game.status, 'gameOver');
}

// 5 çift + 4'lü seri ile çiftten bitiş (ekrandaki el: ♠3-4-5-6)
assert.deepStrictEqual(evaluateFinish(C('D7 D7 D5 D5 HJ HJ HQ HQ C7 C7 S3 S4 S5 S6'), { s: 'S', r: 13 }), { ok: true, pairs: true });
// 4'lü seride boşluğu okey doldurur (okey ♠K): ♠3 ♠4 [okey] ♠6
assert.deepStrictEqual(evaluateFinish(C('D7 D7 D5 D5 HJ HJ HQ HQ C7 C7 S3 S4 SK S6'), { s: 'S', r: 13 }), { ok: true, pairs: true });
// Q-K-A 4'lü: J-Q-K-A geçerli
assert.strictEqual(evaluateFinish(C('D7 D7 D5 D5 HJ HJ C2 C2 C7 C7 SJ SQ SK SA'), { s: 'H', r: 3 }).ok, true);
// 5 çift + 3'lü seri + tek: olmaz
assert.strictEqual(evaluateFinish(C('D7 D7 D5 D5 HJ HJ HQ HQ C7 C7 S3 S4 S5 D9'), { s: 'H', r: 3 }).ok, false);

// ================= PUANLAMA KURALLARI (beklenenler elle hesaplandı) =================
// Okey ♠8 => renk çarpanı maça = 3
function finishScenario(winHand, others, { mode = 'solo', setup } = {}) {
  const g = new Game({ mode, totalHands: 3, names: ['A', 'B', 'C', 'D'] });
  g.freeze = () => {};
  g.okey = { s: 'S', r: 8 };
  g.turn = 0; g.phase = 'discard'; g.acted = [true, true, true, true];
  g.hands = [C(winHand), C(others[0]), C(others[1]), C(others[2])];
  if (setup) setup(g);
  g.discard(0, g.hands[0][g.hands[0].length - 1].id, true);
  return g.result;
}
const WIN_NORMAL = 'H2 H3 H4 S7 H7 D7 C9 C10 CJ D9 D10 DJ DQ DK S5';
const WIN_PAIRS = 'S2 S2 H5 H5 D9 D9 SK SK CA CA H10 H10 D3 D3 H7';
// B: tek per (♥5-6-7), boşta: 2+4+6+10+10+3+2+11+11+3+10 = 72, x3 (maça) = 216
const B_MELD = 'H5 H6 H7 S2 D4 C6 HJ SK D3 C2 HA DA C3 S10';
// C: hiç per yok, 4 çift yok => sabit 100 x 3 = 300
const C_NOMELD = 'S2 H4 D6 C8 SJ HQ DK CA S9 H3 D5 C7 SQ HK';
// D: 4 çift + dörtlü per (4'ler, düşülür) + 2♠ 6♥ => çiftten: boşta 2+6 = 8, x3 (maça) x2 = 48
const D_PAIRS = 'C3 C3 C10 C10 DJ DJ H5 H5 S4 H4 D4 C4 S2 H6';
// Okeye dönmüş (bitmeye hazır) el => 100 x 3 = 300
const E_READY = 'H2 H3 H4 S7 H7 D7 C9 C10 CJ D9 D10 DJ DQ DK';

let r = finishScenario(WIN_NORMAL, [B_MELD, C_NOMELD, D_PAIRS]);
assert.deepStrictEqual(r.pts, [-100, 216, 300, 48], 'normal bitiş: boştakiler okey çarpanıyla');
assert.deepStrictEqual(r.detail.map((d) => d.kind), ['winner', 'normal', 'noMeld', 'pairs']);

r = finishScenario(WIN_PAIRS, [B_MELD, C_NOMELD, D_PAIRS]);
assert.deepStrictEqual(r.pts, [-300, 432, 600, 96], 'çiftten bitiş: biten -100x3, herkes x2');

r = finishScenario(WIN_NORMAL, [E_READY, C_NOMELD, D_PAIRS]);
assert.deepStrictEqual(r.pts, [-100, 300, 300, 48], 'okeye dönmüş el sabit ceza');

r = finishScenario(WIN_PAIRS, [E_READY, C_NOMELD, D_PAIRS]);
assert.strictEqual(r.pts[1], 600, 'okeye dönmüşken rakip çiftten biterse x2 (maçada 600)');

r = finishScenario(WIN_NORMAL, [B_MELD, C_NOMELD, D_PAIRS], { mode: 'team' });
assert.deepStrictEqual(r.pts, [-100, 216, 0, 48], 'eşli: biten oyuncunun eşi ceza yazmaz');

// Okey atarak bitiş (okey ♠8 elde, onu atarak biter) => -300, herkes x2
r = finishScenario('H2 H3 H4 S7 H7 D7 C9 C10 CJ D9 D10 DJ DQ DK S8', [B_MELD, C_NOMELD, D_PAIRS]);
assert.deepStrictEqual(r.pts, [-300, 432, 600, 96], 'okey atarak bitiş');

// Gösterge gösterme: göstergesi olan -10 x renk ödül, olmayan +50 ceza; okey atma +100 (renk önemsiz)
{
  const g = new Game({ mode: 'solo', totalHands: 3, names: ['A', 'B', 'C', 'D'] });
  g.freeze = () => {};
  g.okey = { s: 'S', r: 8 };
  g.indicator = { id: 'IND', s: 'S', r: 7, b: 'blue' };
  const t = g.turn;
  g.hands[t] = g.hands[t].filter((c) => !(c.s === 'S' && c.r === 7));
  g.hands[t].push({ id: 'S7copy', s: 'S', r: 7, b: 'red' });
  g.showIndicator(t);
  assert.strictEqual(g.showPts[t], -30, 'gösterge ödülü (maça) -30');
  const t2 = g.nextSeat(t);
  g.hands[t2] = g.hands[t2].filter((c) => !(c.s === 'S' && c.r === 7));
  g.discard(t, g.hands[t][0].id, false);
  assert.throws(() => g.showIndicator(t2), /zaten gösterildi/, 'gösterge zaten gösterildiyse ikinci gösterme olmaz');
  assert.strictEqual(g.showPts[t2], 0);
  g.draw(t2, 'deck');
  g.hands[t2].push({ id: 'OKEY1', s: 'S', r: 8, b: 'red' });
  g.discard(t2, 'OKEY1', false);
  assert.strictEqual(g.okeyPts[t2], 100, 'bitmeden okey atan 100 ceza');
}

// Final: kazanan, final eli yazıldıktan sonra toplamı düşük olan finalisttir (eli bitiren değil)
{
  const g = new Game({ mode: 'solo', totalHands: 2, names: ['A', 'B', 'C', 'D'] });
  g.freeze = () => {};
  // 1. el sonu: A ve B önde, C (600) ve D (100) finale kalır
  g.scores = [];
  g.status = 'playing';
  g.scores.push([0, 10, 600, 100]);
  g.handNo = 1;
  g.final = { first: 0, second: 1, players: [2, 3] };
  g.status = 'handOver';
  g.nextHand();
  assert.deepStrictEqual(g.active, [2, 3], 'finalde sadece 2 kişi');
  // C finali normal bitirir (-100) ama D'nin cezası 100'den az: C toplam 500, D toplam 100 + ceza
  g.okey = { s: 'S', r: 8 };
  g.turn = 2; g.phase = 'discard'; g.acted = [true, true, true, true];
  g.hands[2] = C('H2 H3 H4 S7 H7 D7 C9 C10 CJ D9 D10 DJ DQ DK S5');
  g.hands[3] = C('H5 H6 H7 S2 D4 C6 HJ SK D3 C2 HA DA C3 S10'); // perli, boşta 72
  g.discard(2, g.hands[2][14].id, true);
  assert.deepStrictEqual(g.totals(), [0, 10, 500, 316]); // D: 100 + 72 x3 (maça)
  assert.strictEqual(g.standings.finalWinner, 3, 'finali bitiren değil, toplamı düşük olan kazanır');
  assert.strictEqual(g.standings.finalLoser, 2);
}

// Gerçek oyuncu: rakip bitince 30 sn el açma süresi; ceza KENDİ dizilişine göre
{
  const mk = () => {
    const g = new Game({ mode: 'solo', totalHands: 3, names: ['A', 'B', 'C', 'D'] });
    g.freeze = () => {};
    g.humans = [true, true, false, false]; // A ve B gerçek, C ve D bot
    g.okey = { s: 'S', r: 8 };
    g.turn = 0; g.phase = 'discard'; g.acted = [true, true, true, true];
    g.hands = [C(WIN_NORMAL), C(B_MELD), C(C_NOMELD), C(D_PAIRS)];
    return g;
  };
  // 1) B perini (♥5-6-7) arka kata koydu => sadece boştakiler: 72
  let g = mk();
  g.discard(0, g.hands[0][14].id, true);
  assert.strictEqual(g.status, 'settle', 'gerçek oyuncu varsa el açma süresi başlar');
  assert.deepStrictEqual(g.settle.need, [1], 'sadece B (gerçek oyuncu) bekleniyor');
  const bIds = g.hands[1].map((c) => c.id);
  g.setArrangement(1, bIds, { front: bIds.slice(3), r1: bIds.slice(0, 3), r2: [] });
  g.confirmHand(1);
  assert.strictEqual(g.status, 'handOver');
  assert.strictEqual(g.result.pts[1], 216, 'dizdiği per sayıldı (72 x3)');
  // 2) B perini dağınık dizdi (hiçbir yerde yan yana değil) => peri yok sayılır: sabit 300
  g = mk();
  g.discard(0, g.hands[0][14].id, true);
  const b2 = g.hands[1].map((c) => c.id);
  const scattered = [b2[0], b2[3], b2[1], b2[4], b2[2], ...b2.slice(5)];
  g.setArrangement(1, scattered, { front: scattered, r1: [], r2: [] });
  g.finishSettle(); // 30 sn doldu
  assert.strictEqual(g.result.pts[1], 300, 'açmadığı per sayılmaz');
  // 3) Ön sırada yan yana duran per de sayılır
  g = mk();
  g.discard(0, g.hands[0][14].id, true);
  const b3 = g.hands[1].map((c) => c.id);
  g.setArrangement(1, b3, { front: b3, r1: [], r2: [] });
  g.finishSettle();
  assert.strictEqual(g.result.pts[1], 216, 'ön sırada yan yana per sayılır');
  // 4) Botlar en iyi dizilişle yazılır, beklenmez
  assert.strictEqual(g.result.pts[2], 300);
  assert.strictEqual(g.result.pts[3], 48);
}

// Ekrandaki el: çifte gidiyor, 5 çift + (♥7, sahte okey=♦7, ♣7) peri + ♠J => boşta sadece ♠J = 10, x2 = 20
{
  const okeyD = { s: 'D', r: 7 };
  const h = C('CA CA D5 D5 CK CK H3 H3 S6 S6 H7 X C7 SJ');
  const a = assessHand(h, okeyD);
  assert.strictEqual(a.kind, 'pairs');
  assert.strictEqual(a.base, 10, 'çifte giden oyuncunun peri (sahte okeyli 7ler) düşülür');
  // aynı el dizilişle: çiftler arka katta, 7'ler yan yana ön sırada
  const ids = h.map((c) => c.id);
  const decl = { front: [ids[10], ids[11], ids[12], ids[13]], r1: [ids[0], ids[1], null, ids[2], ids[3], null, ids[4], ids[5], null, ids[6], ids[7], null, ids[8], ids[9]], r2: [] };
  const d = assessDeclared(h, okeyD, decl, null);
  assert.strictEqual(d.kind, 'pairs');
  assert.strictEqual(d.base, 10, 'dizilişte de açılan per düşülür');
}

// Ekrandaki el: ♥J ♥Q ♥K ♦9 ♦10 ♦J araya boşluk konmadan tek grup halinde arka katta (okey ♥)
{
  const okeyH = { s: 'H', r: 5 };
  const h = C('C3 C4 C5 S2 H2 C2 HJ HQ HK D9 D10 DJ D7 H9');
  const ids = h.map((c) => c.id);
  const decl = { front: [ids[12], ids[13]], r1: [ids[0], ids[1], ids[2], null, ids[3], ids[4], ids[5], null, ids[6], ids[7], ids[8], ids[9], ids[10], ids[11]], r2: [] };
  const d = assessDeclared(h, okeyH, decl, null);
  assert.strictEqual(d.kind, 'normal');
  assert.strictEqual(d.explain.melds.length, 4, '6 kağıtlık grup iki pere bölünür');
  assert.strictEqual(d.base, 7 + 9, 'boşta sadece ♦7 ve ♥9');
  // Aynı perler ön sırada yan yana da sayılır
  const d2 = assessDeclared(h, okeyH, { front: ids, r1: [], r2: [] }, null);
  assert.strictEqual(d2.base, 16);
  // Dağınık dizilen per sayılmaz (♥J ♦9 ♥Q ♦10 ♥K ♦J)
  const mixed = [ids[0], ids[1], ids[2], ids[3], ids[4], ids[5], ids[6], ids[9], ids[7], ids[10], ids[8], ids[11], ids[12], ids[13]];
  const d3 = assessDeclared(h, okeyH, { front: mixed, r1: [], r2: [] }, null);
  assert.strictEqual(d3.base, 10 + 10 + 10 + 9 + 10 + 10 + 7 + 9, 'yan yana olmayan kağıtlardan per kurulmaz');
}

// Çifte giderken sadece EN YÜKSEK tek per düşülür (ekrandaki el: ♠7-8-9 ve üç 3, 4 çift; okey ♥)
{
  const okeyH = { s: 'H', r: 5 };
  const h = C('S7 S8 S9 C3 D3 S3 DQ DQ H6 H6 SQ SQ H7 H7');
  const a = assessHand(h, okeyH);
  assert.strictEqual(a.kind, 'pairs');
  assert.strictEqual(a.base, 9, 'yalnız ♠7-8-9 (24) düşülür, üç 3 (9) boşta');
  const ids = h.map((c) => c.id);
  const decl = { front: [], r1: [ids[0], ids[1], ids[2], null, ids[3], ids[4], ids[5]], r2: [ids[6], ids[7], null, ids[8], ids[9], null, ids[10], ids[11], null, ids[12], ids[13]] };
  const d = assessDeclared(h, okeyH, decl, null);
  assert.strictEqual(d.base, 9, 'dizilişte de tek per (en yüksek) düşülür');
  assert.strictEqual(d.explain.melds.length, 1);
}

// Senin örneğin: boşta 24, okey sinek => 48; aynı el okey kupayken => 120
{
  const t = (okeyS) => {
    const g = new Game({ mode: 'solo', totalHands: 3, names: ['A', 'B', 'C', 'D'] });
    g.freeze = () => {};
    g.okey = { s: okeyS, r: 8 };
    g.turn = 0; g.phase = 'discard'; g.acted = [true, true, true, true];
    g.hands = [C(WIN_NORMAL), C('H2 H3 H4 S9 D7 C5 S3 S6 D9 C9 D3 C6 HJ HQ'), C(C_NOMELD), C(D_PAIRS)];
    g.discard(0, g.hands[0][14].id, true);
    return g.result;
  };
  // B: per ♥2-3-4, boşta... hesaplanan taban x çarpan
  const rc = t('C'); const rh = t('H');
  assert.strictEqual(rc.pts[1], rc.detail[1].base * 2, 'sinek x2');
  assert.strictEqual(rh.pts[1], rh.detail[1].base * 5, 'kupa x5');
}

console.log('Tüm testler geçti ✔');
