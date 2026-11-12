'use strict';
// Aksesuarlar: satın alınınca ya da hediye gelince figürün üstünde belirir (o masa boyunca).
// Her figür kendi yüz noktalarını (göz, ağız, kulak, baş) verir; aksesuar oraya oturur.
// Fiyatlar ve yuvalar sunucudaki ACC listesiyle aynı olmalı (server.js).
const Acc = (() => {
  const ITEMS = [
    { id: 'sigara', name: 'Sigara', slot: 'mouth', price: 50, icon: '🚬' },
    { id: 'puro', name: 'Puro', slot: 'mouth', price: 120, icon: '🟤' },
    { id: 'kupe', name: 'Altın küpe', slot: 'ear', price: 100, icon: '💛' },
    { id: 'inci', name: 'İnci küpe', slot: 'ear', price: 150, icon: '⚪' },
    { id: 'gozluk', name: 'Gözlük', slot: 'eyes', price: 150, icon: '👓' },
    { id: 'gunes', name: 'Güneş gözlüğü', slot: 'eyes', price: 200, icon: '🕶️' },
    { id: 'kolye', name: 'Altın kolye', slot: 'neck', price: 250, icon: '📿' },
    { id: 'sapka', name: 'Fötr şapka', slot: 'head', price: 250, icon: '🎩' },
    { id: 'tac', name: 'Taç', slot: 'head', price: 300, icon: '👑' },
    // takılma hediyeleri: figürün hemen yanında hareketli durur (slot 'gag')
    { id: 'pecete', name: 'Peçete', slot: 'gag', price: 40, icon: '🧻', tease: 'Ağlamasın diye' },
    { id: 'biberon', name: 'Biberon', slot: 'gag', price: 40, icon: '🍼', tease: 'Bebek gibi oynuyor' },
    { id: 'kaplumbaga', name: 'Kaplumbağa', slot: 'gag', price: 50, icon: '🐢', tease: 'Çok yavaş oynuyor' },
    { id: 'salyangoz', name: 'Salyangoz', slot: 'gag', price: 50, icon: '🐌', tease: 'Salyangoz hızında' },
    { id: 'limon', name: 'Limon', slot: 'gag', price: 30, icon: '🍋', tease: 'Ekşi surat' },
    { id: 'domates', name: 'Domates', slot: 'gag', price: 30, icon: '🍅', tease: 'Yuh!' },
    { id: 'kumsaati', name: 'Kum saati', slot: 'gag', price: 40, icon: '⏳', tease: 'Seni bekliyoruz…' },
    { id: 'bayrak', name: 'Beyaz bayrak', slot: 'gag', price: 60, icon: '🏳️', tease: 'Pes et artık' },
    { id: 'bulut', name: 'Yağmur bulutu', slot: 'gag', price: 60, icon: '🌧️', tease: 'Şanssız günündesin' },
    { id: 'buyutec', name: 'Büyüteç', slot: 'gag', price: 50, icon: '🔍', tease: 'Kağıtları göremiyor mu?' },
    { id: 'palyaco', name: 'Palyaço', slot: 'gag', price: 80, icon: '🤡', tease: 'Masanın palyaçosu' },
    { id: 'uyku', name: 'Uyku', slot: 'gag', price: 40, icon: '💤', tease: 'Uyuma, sıra sende!' },
  ];
  const byId = Object.fromEntries(ITEMS.map((x) => [x.id, x]));
  // insan yüzü (avatar.js) varsayılan noktalar
  const BASE = { ex: 9, ey: 45, er: 5.2, mx: 54, my: 60, earX: 18.5, earY: 54, top: 24, hw: 20, neckY: 74 };
  const f = (n) => Number(n).toFixed(1);

  // 4 köşeli ışıltı: 2 saniyede bir çakar
  const sparkle = (x, y, s, delay = 0) => `<g transform="translate(${f(x)} ${f(y)})"><g opacity="0">
      <path d="M0 ${-s} L${s * 0.25} ${-s * 0.25} L${s} 0 L${s * 0.25} ${s * 0.25} L0 ${s} L${-s * 0.25} ${s * 0.25} L${-s} 0 L${-s * 0.25} ${-s * 0.25}Z" fill="#fff"/>
      <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.72;.84;1" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="scale" values=".2;.2;1.2;.2" keyTimes="0;.72;.84;1" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
    </g></g>`;

  function glasses(A, uid, dark) {
    const L = 50 - A.ex;
    const R = 50 + A.ex;
    const r = A.er;
    const id = `${uid}-gl`;
    const lens = dark ? 'fill="#141414" fill-opacity=".92"' : 'fill="#cfe6ff" fill-opacity=".18"';
    const frame = dark ? '#111' : '#2a1a10';
    return `<defs><clipPath id="${id}"><circle cx="${f(L)}" cy="${f(A.ey)}" r="${f(r)}"/><circle cx="${f(R)}" cy="${f(A.ey)}" r="${f(r)}"/></clipPath></defs>
      <path d="M${f(L - r)} ${f(A.ey - 0.5)} L${f(50 - A.hw)} ${f(A.ey - 2)} M${f(R + r)} ${f(A.ey - 0.5)} L${f(50 + A.hw)} ${f(A.ey - 2)}" stroke="${frame}" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="${f(L)}" cy="${f(A.ey)}" r="${f(r)}" ${lens} stroke="${frame}" stroke-width="1.4"/>
      <circle cx="${f(R)}" cy="${f(A.ey)}" r="${f(r)}" ${lens} stroke="${frame}" stroke-width="1.4"/>
      <path d="M${f(L + r)} ${f(A.ey - 0.6)} Q50 ${f(A.ey - 2.6)} ${f(R - r)} ${f(A.ey - 0.6)}" stroke="${frame}" stroke-width="1.3" fill="none"/>
      <g clip-path="url(#${id})"><g><rect x="${f(L - r - 6)}" y="${f(A.ey - r - 4)}" width="3.2" height="${f(r * 2 + 8)}" fill="#fff" opacity=".85" transform="rotate(25 ${f(L)} ${f(A.ey)})"/>
        <rect x="${f(L - r - 1)}" y="${f(A.ey - r - 4)}" width="1.4" height="${f(r * 2 + 8)}" fill="#fff" opacity=".6" transform="rotate(25 ${f(L)} ${f(A.ey)})"/>
        <animateTransform attributeName="transform" type="translate" values="-6 0; ${f(A.ex * 2 + r * 2 + 10)} 0; ${f(A.ex * 2 + r * 2 + 10)} 0" keyTimes="0;.45;1" dur="2.6s" repeatCount="indefinite"/></g></g>`;
  }
  function earrings(A, pearl) {
    const out = [];
    for (const [x, d] of [[50 - A.earX, 0], [50 + A.earX, 1]]) {
      out.push(pearl
        ? `<path d="M${f(x)} ${f(A.earY - 2)} L${f(x)} ${f(A.earY + 1)}" stroke="#d9a52b" stroke-width=".8"/><circle cx="${f(x)}" cy="${f(A.earY + 3)}" r="2.4" fill="#fbf7ee" stroke="#d8d0c0" stroke-width=".5"/><circle cx="${f(x - 0.7)}" cy="${f(A.earY + 2.2)}" r=".8" fill="#fff"/>`
        : `<circle cx="${f(x)}" cy="${f(A.earY + 1.5)}" r="2.6" fill="none" stroke="#e8b923" stroke-width="1.3"/><circle cx="${f(x)}" cy="${f(A.earY + 4.1)}" r="1" fill="#fff3b0"/>`);
      out.push(sparkle(x + 1, A.earY + 1, 3.2, d));
    }
    return out.join('');
  }
  function smoke(x, y) {
    return [0, 1, 2].map((i) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="#d8d8d8" opacity="0">
      <animate attributeName="cy" values="${f(y)};${f(y - 28)}" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      <animate attributeName="cx" values="${f(x)};${f(x + 3)};${f(x - 2)};${f(x + 4)}" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      <animate attributeName="r" values="1.5;6" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;.65;0" dur="3s" begin="${i}s" repeatCount="indefinite"/></circle>`).join('');
  }
  function cig(A, cigar) {
    const x0 = A.mx - 1;
    const y0 = A.my;
    const len = cigar ? 15 : 16;
    const th = cigar ? 3.6 : 2.2;
    const x1 = x0 + len;
    const y1 = y0 + 3.5;
    const body = cigar
      ? `<path d="M${f(x0)} ${f(y0 - th / 2)} L${f(x1)} ${f(y1 - th / 2)} L${f(x1)} ${f(y1 + th / 2)} L${f(x0)} ${f(y0 + th / 2)}Z" fill="#6b3d1e"/><path d="M${f(x0 + 3)} ${f(y0 - th / 2 + 0.3)} L${f(x0 + 5)} ${f(y0 - th / 2 + 0.5)} L${f(x0 + 5)} ${f(y0 + th / 2 + 0.5)} L${f(x0 + 3)} ${f(y0 + th / 2 + 0.3)}Z" fill="#d9a52b"/>`
      : `<path d="M${f(x0)} ${f(y0 - th / 2)} L${f(x1)} ${f(y1 - th / 2)} L${f(x1)} ${f(y1 + th / 2)} L${f(x0)} ${f(y0 + th / 2)}Z" fill="#f6f4ee"/><path d="M${f(x0)} ${f(y0 - th / 2)} L${f(x0 + 4)} ${f(y0 - th / 2 + 0.9)} L${f(x0 + 4)} ${f(y0 + th / 2 + 0.9)} L${f(x0)} ${f(y0 + th / 2)}Z" fill="#e0913a"/>`;
    return `${body}<circle cx="${f(x1)}" cy="${f(y1)}" r="${f(th / 2 + 0.2)}" fill="#ff5a1f"><animate attributeName="fill" values="#ff5a1f;#ffb03a;#ff5a1f" dur="1.6s" repeatCount="indefinite"/></circle>${smoke(x1 + 0.5, y1 - 2)}`;
  }
  function hat(A, crown) {
    const t = A.top;
    const w = A.hw;
    if (crown) {
      return `<path d="M${f(50 - w * 0.75)} ${f(t + 2)} L${f(50 - w * 0.8)} ${f(t - 12)} L${f(50 - w * 0.4)} ${f(t - 5)} L50 ${f(t - 15)} L${f(50 + w * 0.4)} ${f(t - 5)} L${f(50 + w * 0.8)} ${f(t - 12)} L${f(50 + w * 0.75)} ${f(t + 2)}Z" fill="#f2c94c" stroke="#a87a12" stroke-width="1"/>
        <rect x="${f(50 - w * 0.75)}" y="${f(t - 1)}" width="${f(w * 1.5)}" height="3.5" fill="#d9a52b"/>
        <circle cx="50" cy="${f(t - 4)}" r="2.2" fill="#d0021b"/><circle cx="${f(50 - w * 0.42)}" cy="${f(t)}" r="1.4" fill="#2d6fd6"/><circle cx="${f(50 + w * 0.42)}" cy="${f(t)}" r="1.4" fill="#2e9e5b"/>
        ${sparkle(50, t - 15, 3.6, 0.5)}`;
    }
    return `<path d="M${f(50 - w * 1.35)} ${f(t + 3)} Q50 ${f(t - 3)} ${f(50 + w * 1.35)} ${f(t + 3)} Q50 ${f(t + 8)} ${f(50 - w * 1.35)} ${f(t + 3)}Z" fill="#2b2b2b"/>
      <path d="M${f(50 - w * 0.85)} ${f(t + 2)} Q${f(50 - w * 0.9)} ${f(t - 14)} 50 ${f(t - 13)} Q${f(50 + w * 0.9)} ${f(t - 14)} ${f(50 + w * 0.85)} ${f(t + 2)}Z" fill="#333"/>
      <path d="M50 ${f(t - 13)} Q46 ${f(t - 8)} 50 ${f(t - 6)}" stroke="#222" stroke-width="1.2" fill="none"/>
      <path d="M${f(50 - w * 0.86)} ${f(t - 2)} Q50 ${f(t)} ${f(50 + w * 0.86)} ${f(t - 2)} L${f(50 + w * 0.86)} ${f(t + 1.5)} Q50 ${f(t + 3.5)} ${f(50 - w * 0.86)} ${f(t + 1.5)}Z" fill="#a8182b"/>`;
  }
  function necklace(A) {
    const y = A.neckY;
    return `<path d="M37 ${f(y - 1)} Q50 ${f(y + 14)} 63 ${f(y - 1)}" stroke="#e8b923" stroke-width="1.6" fill="none" stroke-dasharray="2 1"/>
      <path d="M50 ${f(y + 6)} L53 ${f(y + 10)} L50 ${f(y + 14)} L47 ${f(y + 10)}Z" fill="#f2c94c" stroke="#a87a12" stroke-width=".6"/><circle cx="50" cy="${f(y + 10)}" r="1.4" fill="#2d6fd6"/>
      ${sparkle(51, y + 9, 3.4, 1)}`;
  }
  // acc: { eyes: 'gozluk', ear: 'kupe', ... } -> figürün üstüne çizilecek SVG
  function render(acc, anchors, uid = 'a') {
    if (!acc) return '';
    const A = { ...BASE, ...(anchors || {}) };
    const out = [];
    // çizim sırası: kolye, kulak, gözler, ağız, baş
    if (acc.neck === 'kolye') out.push(necklace(A));
    if (acc.ear) out.push(earrings(A, acc.ear === 'inci'));
    if (acc.eyes) out.push(glasses(A, uid, acc.eyes === 'gunes'));
    if (acc.mouth) out.push(cig(A, acc.mouth === 'puro'));
    if (acc.head) out.push(hat(A, acc.head === 'tac'));
    return out.join('');
  }
  return { ITEMS, byId, render, BASE };
})();
