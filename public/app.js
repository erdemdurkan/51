'use strict';
const socket = io();
const $ = (id) => document.getElementById(id);
const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUIT_MULT = { C: 2, S: 3, D: 4, H: 5 }; // okeyin rengine göre çarpan
const rl = (r) => RL[r] || String(r);
const HAND_OPTIONS = [3, 5, 7, 9, 11];
const OPP = [null, 'opp-right', 'opp-top', 'opp-left'];

// Kart üzerindeki sembol yerleşimleri (yüz alanında % konum)
const PIPS = (() => {
  const c4 = [[0, 0], [100, 0], [0, 100], [100, 100]];
  const c6 = [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]];
  const c8 = [[0, 0], [100, 0], [0, 33], [100, 33], [0, 67], [100, 67], [0, 100], [100, 100]];
  return {
    2: [[50, 0], [50, 100]],
    3: [[50, 0], [50, 50], [50, 100]],
    4: c4,
    5: [...c4, [50, 50]],
    6: c6,
    7: [...c6, [50, 25]],
    8: [...c6, [50, 25], [50, 75]],
    9: [...c8, [50, 50]],
    10: [...c8, [50, 17], [50, 83]],
  };
})();

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let S = null;            // sunucudan son durum
let session = store.get('i51-session'); // {code, token}
let selected = null;
let hand = { key: null, order: [], back: [], back2: [] }; // elimdeki kartların sırası
let handEls = new Map();             // id -> DOM
let resultHidden = false;
let modalKind = null;
let modalArg = null;
let hw = 80;
let pw = 56;

// ---------- Ortak ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}
function emit(ev, data, cb) {
  socket.emit(ev, data, (res) => {
    if (!res || !res.ok) { toast((res && res.error) || 'Bağlantı hatası'); FX.play('error'); }
    else if (cb) cb(res);
  });
}
function show(id) {
  for (const s of ['home', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== id);
  if (id !== 'game') Stage3D.idle();
}
function fillHands(sel) {
  sel.innerHTML = HAND_OPTIONS.map((n) => `<option value="${n}">${n} el</option>`).join('');
  sel.value = '11';
}
const isWild = (c, okey) => !c.joker && okey && c.s === okey.s && c.r === okey.r;
const nameOf = (seat) => (S.seats[seat] ? S.seats[seat].name : '—');
const teamOf = (seat) => (seat % 2 === 0 ? 'A' : 'B');
const cardLabel = (c) => (c.joker ? 'Joker (sahte okey)' : SYM[c.s] + rl(c.r));

// Maça ve sinek: yazı tipi karakterleri küçükte birbirine benziyor, belirgin çizimler
const SUIT_SVG = {
  S: '<svg class="suit-svg" viewBox="0 0 100 100" aria-label="maça"><path d="M50 3 C38 22 4 40 4 64 C4 80 16 90 30 90 C38 90 44 87 47 82 L40 98 L60 98 L53 82 C56 87 62 90 70 90 C84 90 96 80 96 64 C96 40 62 22 50 3 Z"/></svg>',
  C: '<svg class="suit-svg" viewBox="0 0 100 100" aria-label="sinek"><circle cx="50" cy="26" r="22"/><circle cx="25" cy="60" r="22"/><circle cx="75" cy="60" r="22"/><circle cx="50" cy="56" r="14"/><path d="M50 52 L37 98 L63 98 Z"/></svg>',
  H: '<svg class="suit-svg" viewBox="0 0 100 100" aria-label="kupa"><path d="M50 95 C22 72 3 54 3 32 C3 15 15 5 29 5 C39 5 46 11 50 20 C54 11 61 5 71 5 C85 5 97 15 97 32 C97 54 78 72 50 95 Z"/></svg>',
  D: '<svg class="suit-svg" viewBox="0 0 100 100" aria-label="karo"><path d="M50 2 C60 20 74 36 90 50 C74 64 60 80 50 98 C40 80 26 64 10 50 C26 36 40 20 50 2 Z"/></svg>',
};
// Okey sembolü: ayna altın dolgu + üzerinden geçen parlama (game.html içindeki SVG gradyanları)
function goldSuit(su) {
  const m = /^(<svg[^>]*>)([\s\S]*)<\/svg>$/.exec(SUIT_SVG[su] || '');
  if (!m) return SYM[su];
  return m[1].replace('class="suit-svg"', 'class="suit-svg gold"') +
    `<g fill="url(#goldMirror)" stroke="#6b4304" stroke-width="1.5">${m[2]}</g><g fill="url(#goldShine)">${m[2]}</g></svg>`;
}
function cardEl(c, opts = {}) {
  const okey = S && S.game ? S.game.okey : null;
  const d = document.createElement('div');
  d.className = 'card ' + (c.b === 'red' ? 'from-red' : 'from-blue'); // hangi desteden (arka rengi)
  d.title = c.b === 'red' ? 'Kırmızı deste' : 'Mavi deste';
  if (opts.mini) d.classList.add('mini');
  d.dataset.id = c.id;
  if (c.joker) {
    d.classList.add('joker');
    const rep = okey ? SYM[okey.s] + rl(okey.r) : '';
    d.innerHTML = `<div class="corner tl"><b>★</b><i>${rep}</i></div>
      <div class="jc"><span class="big">★</span><small>JOKER</small><small>= ${rep}</small></div>
      <div class="corner br"><b>★</b><i>${rep}</i></div>`;
    return d;
  }
  if (c.s === 'H' || c.s === 'D') d.classList.add('red');
  const wild = isWild(c, okey);
  if (wild) d.classList.add('wild');
  const R = rl(c.r);
  const s = SUIT_SVG[c.s] || SYM[c.s];
  let face;
  if (c.r === 14) face = `<div class="ace mid">${s}</div>`; // As da sayılılarla aynı boyutta
  else if (c.r >= 11) face = courtSVG(c.r, c.s);
  else face = `<div class="ace mid">${s}</div>`; // sayılı kağıtlarda ortada tek büyük sembol
  d.innerHTML = `<div class="corner tl"><b>${R}</b><i>${s}</i>${wild ? '<span class="ok">★</span>' : ''}</div>
    <div class="face${c.r >= 11 && c.r <= 13 ? ' cface' : ''}">${face}</div>
    <div class="corner br"><b>${R}</b><i>${s}</i></div>`;
  return d;
}
// Papaz / Kız / Vale: iskambildeki gibi iki başlı resim (SVG)
function courtSVG(r, s) {
  const red = s === 'H' || s === 'D';
  const main = red ? '#c62828' : '#1f3f8f';
  const alt = red ? '#1f3f8f' : '#c62828';
  const gold = '#e9b526';
  const skin = '#f8dcb8';
  const ink = '#1d1d1d';
  const hairC = r === 12 ? '#e0a63a' : '#6b3f1d';
  const sw = `stroke="${ink}" stroke-width=".7"`;
  let hair = '';
  let hat = '';
  let item = '';
  let beard = '';
  if (r === 13) { // Papaz: taç, sakal, kılıç
    hair = `<path d="M21.5 19 Q20 30 23 34 L37 34 Q40 30 38.5 19 Z" fill="${hairC}" ${sw}/>`;
    beard = `<path d="M23.6 24.5 Q24 35 30 36 Q36 35 36.4 24.5 Q33.5 28.8 30 28.8 Q26.5 28.8 23.6 24.5 Z" fill="${hairC}" ${sw}/><path d="M26.5 27.4 Q30 25.6 33.5 27.4" stroke="${hairC}" stroke-width="1.6" fill="none"/>`;
    hat = `<path d="M21.5 16 L21 6.5 L25.3 10.5 L30 4 L34.7 10.5 L39 6.5 L38.5 16 Z" fill="${gold}" ${sw}/><circle cx="30" cy="9.8" r="1.3" fill="${alt}"/><rect x="21.3" y="14" width="17.4" height="2.6" fill="${alt}" ${sw}/>`;
    item = `<line x1="49" y1="49" x2="49" y2="16" stroke="#9aa3ad" stroke-width="2"/><line x1="45" y1="41" x2="53" y2="41" stroke="${gold}" stroke-width="2.2"/><circle cx="49" cy="44.5" r="1.4" fill="${gold}"/>`;
  } else if (r === 12) { // Kız: taç, uzun saç, çiçek
    hair = `<path d="M21 17 Q18 32 20.5 42 L25 40 Q23.5 30 24.5 19 Z M39 17 Q42 32 39.5 42 L35 40 Q36.5 30 35.5 19 Z" fill="${hairC}" ${sw}/>`;
    hat = `<path d="M23 15.5 L24.5 9.5 L27.3 12.5 L30 8 L32.7 12.5 L35.5 9.5 L37 15.5 Z" fill="${gold}" ${sw}/><circle cx="30" cy="11.8" r="1" fill="${alt}"/>`;
    item = `<path d="M12 49 Q11 40 14 33.5" stroke="#2e7d32" stroke-width="1.3" fill="none"/><path d="M12.5 42 Q9 40 9.5 37 Q12 38.5 12.5 42 Z" fill="#2e7d32"/><circle cx="14" cy="31" r="3.3" fill="${red ? '#e53935' : '#f4c430'}" ${sw}/><circle cx="14" cy="31" r="1.2" fill="${gold}"/>`;
  } else { // Vale: tüylü şapka, mızrak
    hair = `<path d="M22 17 Q20.5 25 23 30 L24.5 19 Z M38 17 Q39.5 25 37 30 L35.5 19 Z" fill="${hairC}" ${sw}/>`;
    hat = `<path d="M21 17.5 Q21 8.5 30 8.5 Q39 8.5 39 17.5 Z" fill="${alt}" ${sw}/><rect x="20.5" y="15.5" width="19" height="2.6" fill="${gold}" ${sw}/><path d="M37 11 Q45 2.5 49.5 9 Q43.5 7.5 38.5 13 Z" fill="${gold}" ${sw}/>`;
    item = `<path d="M10 49 L10 22" stroke="#7a5230" stroke-width="1.6"/><path d="M10 13.5 Q15 19 10 25 Q5 19 10 13.5 Z" fill="#9aa3ad" ${sw}/>`;
  }
  const body = `<path d="M5 50 Q6 37 20 33 L40 33 Q54 37 55 50 Z" fill="${main}" ${sw}/>
    <path d="M23 33 L30 47 L37 33 Z" fill="${gold}" ${sw}/>
    <path d="M8 50 Q9 41 17 37.5 M52 50 Q51 41 43 37.5" stroke="${gold}" stroke-width="1.8" fill="none"/>
    <circle cx="15" cy="45" r="1" fill="${gold}"/><circle cx="45" cy="45" r="1" fill="${gold}"/><circle cx="20" cy="40.5" r="1" fill="${gold}"/><circle cx="40" cy="40.5" r="1" fill="${gold}"/>`;
  const head = `<ellipse cx="30" cy="23" rx="7" ry="8.6" fill="${skin}" ${sw}/>
    <circle cx="27.4" cy="22" r=".85" fill="${ink}"/><circle cx="32.6" cy="22" r=".85" fill="${ink}"/>
    <path d="M28.2 27.6 Q30 28.8 31.8 27.6" stroke="#a0442c" stroke-width=".8" fill="none"/>`;
  const half = `${body}${item}${hair}${head}${beard}${hat}`;
  return `<svg viewBox="0 0 60 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="1" y="1" width="58" height="98" rx="2" fill="#fff8e6"/>
    <g>${half}<g transform="rotate(180 30 50)">${half}</g></g>
    <line x1="1" y1="50" x2="59" y2="50" stroke="${ink}" stroke-width=".6"/>
    <rect x="1" y="1" width="58" height="98" rx="2" fill="none" stroke="${main}" stroke-width="1.4"/>
  </svg>`;
}
function backEl(color, count) {
  const d = document.createElement('div');
  d.className = 'card back ' + (color === 'red' ? 'bk-red' : 'bk-blue');
  if (count != null) d.innerHTML = `<span class="cntin">${count}</span>`;
  return d;
}

// ---------- Giriş ----------
fillHands($('hands'));
fillHands($('lHands'));
$('name').value = store.get('i51-name') || '';
const params = new URLSearchParams(location.search);
if (params.get('oda')) $('joinCode').value = params.get('oda').toUpperCase();

function myName() {
  const n = $('name').value.trim();
  if (!n) { toast('Önce adını yaz'); $('name').focus(); return null; }
  store.set('i51-name', n);
  return n;
}
function setSession(res) {
  session = { code: res.code, token: res.token };
  store.set('i51-session', session);
  history.replaceState(null, '', '?oda=' + res.code);
}
$('btnBots').onclick = () => {
  const name = myName();
  if (!name) return;
  emit('create', { name, pid, mode: $('mode').value, totalHands: +$('hands').value, vsBots: true }, setSession);
};
$('btnCreate').onclick = () => {
  const name = myName();
  if (!name) return;
  const fee = Math.floor(+$('fee').value || 0);
  if (fee < 250) { toast('Masa ücreti en az 250 altın olmalı'); $('fee').focus(); return; }
  if (myGold != null && fee > myGold) { toast(`Yeterli altının yok (${fmt(myGold)} altın)`); return; }
  emit('create', { name, pid, mode: $('mode').value, totalHands: +$('hands').value, fee }, setSession);
};
$('fee').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnCreate').click());
$('btnJoin').onclick = () => {
  const name = myName();
  const code = $('joinCode').value.trim().toUpperCase();
  if (!name) return;
  if (!code) return toast('Oda kodunu yaz');
  const rj = store.get('i51-rejoin');
  const token = session && session.code === code ? session.token : rj && rj.code === code ? rj.token : undefined;
  emit('join', { code, name, token, pid }, setSession);
};
$('joinCode').addEventListener('keydown', (e) => e.key === 'Enter' && $('btnJoin').click());

// ---------- Sanal altın ----------
let pid = store.get('i51-pid');
let myGold = null;
const fmt = (n) => Number(n).toLocaleString('tr-TR');
function setGold(g) {
  if (g == null) return;
  myGold = g;
  $('myGold').textContent = fmt(g);
}
socket.on('connect', () => {
  socket.emit('hello', { pid, name: store.get('i51-name') || '' }, (res) => {
    if (res && res.ok) {
      pid = res.pid; store.set('i51-pid', pid); setGold(res.gold);
      myAvatar = Number.isInteger(res.avatar) ? res.avatar : null;
      daily = res.daily;
      if (daily && daily.available) showDailyWhenFree();
    }
  });
});

socket.on('connect', () => {
  const want = params.get('oda');
  if (session && (!want || want.toUpperCase() === session.code)) {
    socket.emit('join', { code: session.code, token: session.token }, (res) => {
      if (!res.ok) { session = null; store.set('i51-session', null); S = null; render(); }
    });
  } else if (!S) render();
});
socket.on('disconnect', () => toast('Bağlantı koptu, yeniden bağlanılıyor…'));
socket.on('state', (st) => {
  const prev = S;
  const rects = snapRects(); // render'dan önce: kağıtların eski yerleri
  // el bitince sonuç penceresi kutlamadan sonra açılsın
  if (prev && prev.game && st.game && prev.game.status === 'playing' && st.game.status !== 'playing') resultAt = Date.now() + 1700;
  S = st;
  setGold(st.myGold);
  render();
  try { animateDiff(prev, st, rects); } catch (e) { console.error('animasyon', e); }
});

// ---------- Lobi ----------
$('btnCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('shareLink').value); toast('Link kopyalandı'); }
  catch { $('shareLink').select(); document.execCommand('copy'); toast('Link kopyalandı'); }
};
$('lMode').onchange = () => emit('settings', { mode: $('lMode').value });
$('lHands').onchange = () => emit('settings', { totalHands: +$('lHands').value });
$('lFee').onchange = () => emit('settings', { fee: Math.floor(+$('lFee').value || 0) });
$('lFee').addEventListener('keydown', (e) => e.key === 'Enter' && $('lFee').blur());
$('btnStart').onclick = () => emit('start', {});
function leaveRoom() {
  const inGame = !!(S && S.game);
  const others = inGame && S.seats.some((p, i) => p && !p.bot && i !== S.mySeat);
  if (inGame && others && !confirm('Masadan ayrılıyorsun. Koltuğun korunur, aynı linkle geri dönebilirsin. Çıkılsın mı?')) return;
  if (inGame && !others && !confirm('Oyundan çıkılsın mı? Oyun kaybolur.')) return;
  emit('leave', {}, () => {
    store.set('i51-rejoin', others ? session : null); // oyun sürüyorsa aynı koltuğa dönebil
    session = null; store.set('i51-session', null); S = null;
    history.replaceState(null, '', location.pathname);
    render();
  });
}
$('btnLeave').onclick = leaveRoom;
$('btnBackTop').onclick = leaveRoom;
$('btnExit').onclick = leaveRoom;

function renderLobby() {
  show('lobby');
  $('lobbyCode').textContent = S.code;
  $('shareLink').value = `${location.origin}/?oda=${S.code}`;
  const team = S.settings.mode === 'team';
  $('seatList').innerHTML = '';
  S.seats.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'seat' + (i === S.mySeat ? ' me' : '');
    const tm = team ? `Takım ${teamOf(i)} · ` : '';
    const btn = (text, fn) => {
      const b = document.createElement('button');
      b.className = 'small';
      b.textContent = text;
      b.onclick = fn;
      d.appendChild(b);
    };
    if (p) {
      d.innerHTML = `<div class="tm">${tm}Koltuk ${i + 1}${p.host ? ' · Oda sahibi' : ''}</div>
        <div class="nm"><span class="dot ${p.connected ? '' : 'off'}"></span>${p.bot ? '🤖 ' : ''}${esc(p.name)}${i === S.mySeat ? ' (sen)' : ''}</div>
        ${p.gold != null ? `<div class="tm">🪙 ${fmt(p.gold)} altın</div>` : ''}`;
      if (p.bot && S.isHost) btn('Çıkar', () => emit('removeBot', { seat: i }));
    } else {
      d.innerHTML = `<div class="tm">${tm}Koltuk ${i + 1}</div><div class="muted">Boş</div>`;
      btn('Buraya geç', () => emit('sit', { seat: i }));
      if (S.isHost) btn('🤖 Bilgisayar ekle', () => emit('addBot', { seat: i }));
    }
    $('seatList').appendChild(d);
  });
  $('lMode').value = S.settings.mode;
  $('lHands').value = String(S.settings.totalHands);
  if (document.activeElement !== $('lFee')) $('lFee').value = S.settings.fee || '';
  $('lMode').disabled = $('lHands').disabled = $('lFee').disabled = !S.isHost;
  const full = S.seats.every(Boolean);
  const hasBot = S.seats.some((p) => p && p.bot);
  $('lobbyMoney').innerHTML = hasBot || !S.settings.fee
    ? '🤖 Masada bilgisayar var: <b>ücretsiz</b> oyun, altın kullanılmaz.'
    : `🪙 Masa ücreti <b>${fmt(S.settings.fee)}</b> altın · Yerde toplanacak: <b>${fmt(S.settings.fee * 4)}</b><br>
       1.: ${fmt(S.settings.fee * 2)} · 2.: ${fmt(S.settings.fee)} · Final kazananı: ${fmt(S.settings.fee)} · Final kaybedeni: 0`;
  $('btnStart').classList.toggle('hidden', !S.isHost);
  $('btnStart').disabled = !full;
  $('lobbyHint').textContent =
    (team ? 'Eşli oyunda karşılıklı oturanlar takımdır (1-3 ve 2-4). ' : '') +
    (full ? (S.isHost ? 'Herkes hazır, başlatabilirsin.' : 'Oda sahibinin başlatması bekleniyor.') : 'Linki arkadaşlarına gönder ya da boş koltuklara bilgisayar ekle.');
}

// ---------- El: ön sıra (order) + arkaya taşınan perler (back, gruplar null ile ayrılır) ----------
const TOP0 = 0.2;  // arka sıranın üst boşluğu (kart genişliği oranı)
const BACK = 0.64; // arka sıranın görünen yüksekliği
function saveHand() { store.set('i51-hand', hand); sendArrangement(); }
// Elimin dizilişini sunucuya gönder: rakipler kağıt arkalarını bu sırayla görür
let arrTimer = null;
let arrLast = '';
function sendArrangement() {
  clearTimeout(arrTimer);
  arrTimer = setTimeout(() => {
    flushArrangement();
  }, 120);
}
// Dizilişi (katlarıyla) hemen gönder: rakip bitince ceza bu dizilişe göre yazılır
function flushArrangement() {
  clearTimeout(arrTimer);
  if (!S || !S.game) return;
  const ids = [...hand.order, ...backIds()];
  const rows = { front: hand.order, r1: hand.back, r2: hand.back2 };
  const key = JSON.stringify(rows);
  if (key === arrLast) return;
  arrLast = key;
  socket.emit('arrange', { ids, rows }, () => {});
}
function cleanBack(arr) {
  const out = [];
  for (const id of arr) {
    if (id === null) { if (out.length && out[out.length - 1] !== null) out.push(null); }
    else out.push(id);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function backGroups(arr = hand.back) {
  const gs = [[]];
  for (const id of arr) { if (id === null) gs.push([]); else gs[gs.length - 1].push(id); }
  return gs.filter((g) => g.length);
}
// Arka katlar: 1 = ön sıranın hemen arkası, 2 = en arka (en fazla 3 kat)
const rowArr = (r) => (r === 1 ? hand.back : hand.back2);
const setRowArr = (r, a) => { if (r === 1) hand.back = cleanBack(a); else hand.back2 = cleanBack(a); };
const backIds = () => [...hand.back, ...hand.back2].filter((id) => id !== null);
function sortHand(kind) {
  const g = S.game;
  const inBack = new Set(backIds());
  const cards = g.myHand.filter((c) => !inBack.has(c.id));
  const special = (c) => c.joker || isWild(c, g.okey);
  const normal = cards.filter((c) => !special(c));
  const specials = cards.filter(special);
  let out;
  if (kind === 'series') {
    out = ['S', 'H', 'C', 'D'].flatMap((s) => normal.filter((c) => c.s === s).sort((a, b) => a.r - b.r));
  } else {
    const by = {};
    for (const c of normal) (by[c.s + c.r] = by[c.s + c.r] || []).push(c);
    const keys = Object.keys(by).sort((a, b) => by[a][0].r - by[b][0].r || a.localeCompare(b));
    out = [...keys.filter((k) => by[k].length > 1).flatMap((k) => by[k]), ...keys.filter((k) => by[k].length === 1).map((k) => by[k][0])];
  }
  hand.order = [...out, ...specials].map((c) => c.id);
  saveHand();
}
function syncHand() {
  const g = S.game;
  const key = `${S.code}-${g.handNo}-${S.mySeat}`;
  if (hand.key !== key) {
    handEls.clear();
    $('hand').innerHTML = '';
    const saved = store.get('i51-hand');
    if (saved && saved.key === key && Array.isArray(saved.order)) hand = { back: [], back2: [], ...saved };
    else { hand = { key, order: [], back: [], back2: [] }; sortHand('series'); }
  }
  if (!hand.back2) hand.back2 = [];
  // en fazla 2 kat (ön sıra + 1 arka kat): eski 3. kattakiler arka kata katılır
  if (hand.back2.length) { hand.back = [...hand.back, null, ...hand.back2]; hand.back2 = []; }
  const ids = new Set(g.myHand.map((c) => c.id));
  hand.order = hand.order.filter((id) => ids.has(id));
  hand.back = cleanBack(hand.back.filter((id) => id === null || ids.has(id)));
  hand.back2 = cleanBack(hand.back2.filter((id) => id === null || ids.has(id)));
  const placed = new Set([...hand.order, ...backIds()]);
  for (const c of g.myHand) if (!placed.has(c.id)) hand.order.push(c.id);
  saveHand();
}
// arka sırada "idx. kağıdın önüne" karşılık gelen dizi konumu
function backPos(arr, idx) {
  let cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === null) continue;
    if (cnt === idx) return i;
    cnt++;
  }
  return arr.length;
}
function removeEverywhere(ids) {
  const set = new Set(ids);
  hand.order = hand.order.filter((x) => !set.has(x));
  hand.back = cleanBack(hand.back.filter((x) => !set.has(x)));
  hand.back2 = cleanBack(hand.back2.filter((x) => !set.has(x)));
}
function moveTo(id, gap) {
  removeEverywhere([id]);
  if (gap.row === 1 || gap.row === 2) {
    const arr = rowArr(gap.row).slice();
    arr.splice(backPos(arr, gap.idx), 0, id);
    setRowArr(gap.row, arr);
  } else {
    hand.order.splice(Math.max(0, Math.min(gap.idx, hand.order.length)), 0, id);
  }
  saveHand();
  layoutHand();
}
// Grubu bir kat yukarı taşı: ön sıra -> arka kat (en fazla 2 kat)
function liftGroup(ids, from = 0) {
  const to = from + 1;
  if (to > 1) return;
  removeEverywhere(ids);
  setRowArr(to, [...rowArr(to), null, ...ids]);
  saveHand();
  layoutHand();
}
// Grubu bir kat aşağı indir: 2. kat -> 1. kat -> ön sıra
function dropGroup(ids, from = 1) {
  removeEverywhere(ids);
  if (from === 2) setRowArr(1, [...hand.back, null, ...ids]);
  else hand.order.push(...ids);
  saveHand();
  layoutHand();
}

// Per (aynı sayı farklı renk / aynı renk sıralı, okey joker) ya da birebir çift mi?
function meldOk(cards) {
  const okey = S.game.okey;
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
function pairOk([a, b]) {
  const okey = S.game.okey;
  if (a.joker && b.joker) return true;                      // iki sahte okey
  if (isWild(a, okey) || isWild(b, okey)) return true;      // okey istenen herhangi bir kağıtla çift olur
  const sh = myShownId();
  if (sh && (a.id === sh || b.id === sh)) return true;      // gösterilen gösterge istenen kağıtla çift olur
  if (a.joker || b.joker || isWild(a, okey) || isWild(b, okey)) return false;
  return a.s === b.s && a.r === b.r;
}
// Ön sırada yan yana duran per/çift grupları
// Soldan ilk bulunanı almak yerine en iyi bölmeyi seçer (dinamik programlama):
// per > gerçek çift > okey/göstergeyle çift. Böylece okey solundaki kağıtla "çift" olup
// 8-9-10 gibi bir peri bozmaz. Her grup { ids, kind: 'per' | 'çift' } döner.
function findGroups(ids, byId) {
  const n = ids.length;
  const okey = S.game.okey;
  const sh = myShownId();
  const score = (cs) => {
    if (cs.length >= 3) return meldOk(cs) ? cs.length * 10 + 4 : -1;
    if (cs.length === 2 && pairOk(cs)) {
      const loose = cs.some((c) => c.joker || isWild(c, okey) || c.id === sh);
      return loose ? 12 : 17; // okeyle çift, perden (3 kağıt = 34) her zaman az değerli
    }
    return -1;
  };
  const best = new Array(n + 1).fill(0);
  const pick = new Array(n + 1).fill(-1);
  for (let i = n - 1; i >= 0; i--) {
    best[i] = best[i + 1];
    pick[i] = -1;
    for (let j = i + 1; j < Math.min(n, i + 13); j++) {
      const s = score(ids.slice(i, j + 1).map((id) => byId[id]));
      if (s > 0 && s + best[j + 1] > best[i]) { best[i] = s + best[j + 1]; pick[i] = j; }
    }
  }
  const out = [];
  for (let i = 0; i < n;) {
    if (pick[i] < 0) { i++; continue; }
    const g = ids.slice(i, pick[i] + 1);
    g.kind = g.length >= 3 ? 'per' : 'çift';
    out.push(g);
    i = pick[i] + 1;
  }
  return out;
}

// ---------- Yelpaze yerleşimi ----------
function sizeHand() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const base = Math.round(Math.max(40, Math.min(100, W / 5.6, (H * 0.25) / 2.36)));
  hw = Math.round(Math.max(40, Math.min(base * 1.7, (H * 0.45) / 2.36))); // eldeki kağıtlar %70 büyük
  pw = Math.round(base * 1.2); // masadaki kağıtlar bir tık büyük
  document.documentElement.style.setProperty('--hw', hw + 'px');
  document.documentElement.style.setProperty('--pw', pw + 'px');
}
function rowGeo(units, W, maxSp) {
  const sp = units > 0 ? Math.min(maxSp, (W - 28 - hw) / units) : 0;
  return { sp, x0: (W - (hw + sp * units)) / 2 };
}
function backLayout(back, W) {
  const u = [];
  let x = 0;
  let first = true;
  for (const id of back) {
    if (id === null) { x += 0.6; continue; }
    if (!first) x += 1;
    first = false;
    u.push(x);
  }
  const G = rowGeo(u.length ? u[u.length - 1] : 0, W, hw * 0.5);
  return { xs: u.map((v) => G.x0 + v * G.sp), sp: G.sp };
}
// Sıraların yükseklikleri: en üstte 2. kat (varsa), sonra 1. kat, en önde ön sıra
function rowTops() {
  const top = hw * TOP0;
  // en fazla 2 kat: arka kat + ön sıra
  return { r2: null, r1: top, front: top + hw * BACK };
}
// Elde tutulur gibi kavis: ortadaki kağıt yukarıda, kenarlar aşağı ve dışa eğik
function fanArc(n, narrow, back) {
  const mid = (n - 1) / 2;
  const step = n > 1 ? Math.min(back ? 2.6 : 3, ((narrow ? 12 : 24) * (back ? 0.85 : 1)) / (n - 1)) : 0;
  const k = mid > 0 ? (hw * (narrow ? 0.08 : 0.12) * (back ? 0.8 : 1)) / (mid * mid) : 0;
  return { mid, step, k };
}
function layoutHand(dragId = null, gap = null) {
  const box = $('hand');
  const W = box.clientWidth || window.innerWidth;
  const narrow = window.innerWidth < 600;
  const T = rowTops();
  box.style.height = T.front + hw * 1.56 + 6 + 'px';

  let zone = $('backZone');
  if (!zone) { zone = document.createElement('div'); zone.id = 'backZone'; box.prepend(zone); }
  zone.style.height = T.front + hw * 0.3 + 'px';
  zone.textContent = hand.back.length || hand.back2.length ? '' : 'Perleri buraya taşı';
  zone.classList.toggle('hover', !!gap && gap.row !== 'front');

  // ön sıra
  const front = hand.order.filter((id) => id !== dragId);
  if (gap && gap.row === 'front') front.splice(gap.idx, 0, null);
  const n = front.length;
  const Gf = rowGeo(n - 1, W, hw * 0.6);
  const A = fanArc(n, narrow, false);
  const fx = {};
  front.forEach((id, i) => {
    const el = id && handEls.get(id);
    if (!el) return;
    const d = i - A.mid;
    const lift = id === selected ? hw * 0.24 : 0;
    fx[id] = Gf.x0 + i * Gf.sp;
    el.style.left = fx[id] + 'px';
    el.style.top = T.front + 'px';
    el.style.transform = `translateY(${A.k * d * d - lift}px) rotate(${d * A.step}deg)`;
    el.style.zIndex = 100 + i;
    el.classList.remove('back-row');
    el.classList.toggle('sel', id === selected);
  });

  // arka sıralar (1. ve 2. kat): önün arkasında, sadece üst kısımları görünür; onlar da kavisli
  const pos = { 1: {}, 2: {} };
  const spOf = {};
  for (const r of [1, 2]) {
    const top = r === 1 ? T.r1 : T.r2;
    if (top == null) continue;
    let arr = cleanBack(rowArr(r).filter((id) => id !== dragId));
    if (gap && gap.row === r) arr.splice(backPos(arr, gap.idx), 0, 'GAP');
    const B = backLayout(arr, W);
    spOf[r] = B.sp;
    const ids = arr.filter((id) => id !== null);
    const R = fanArc(ids.length, narrow, true);
    ids.forEach((id, i) => {
      const el = id !== 'GAP' && handEls.get(id);
      if (!el) return;
      const d = i - R.mid;
      const lift = id === selected ? hw * 0.24 : 0;
      pos[r][id] = B.xs[i];
      el.style.left = B.xs[i] + 'px';
      el.style.top = top + 'px';
      el.style.transform = `translateY(${R.k * d * d - lift}px) rotate(${d * R.step}deg)`;
      el.style.zIndex = (r === 1 ? 50 : 10) + i;
      el.classList.add('back-row');
      el.classList.toggle('sel', id === selected);
    });
  }

  // Taşı / İndir düğmeleri
  box.querySelectorAll('.mbtn').forEach((b) => b.remove());
  if (dragId || gap || !S.game) return;
  const byId = Object.fromEntries(S.game.myHand.map((c) => [c.id, c]));
  // Düğmeler yalnızca fare o perin üstündeyken görünür: kağıtlara ve düğmelere grup anahtarı yazılır
  for (const el of handEls.values()) delete el.dataset.g;
  let gk = '';
  const tag = (g) => { gk = g.join(','); g.forEach((id) => { const el = handEls.get(id); if (el) el.dataset.g = gk; }); };
  if (!box.dataset.hoverInit) {
    box.dataset.hoverInit = '1';
    // Her perin düğmesi kendi süresini tutar: fare o perden ayrılınca (başka bir perin
    // kağıdının üstünden geçse bile) düğme 600 ms daha görünür kalır, düğmeye uzanılabilir.
    const vis = (box._mbVis = new Map()); // grup -> görünürlük bitişi (üstündeyken Infinity)
    const HOLD = 600;
    const refresh = () => {
      const now = performance.now();
      for (const [k, t] of vis) if (t <= now) vis.delete(k);
      box.querySelectorAll('.mbtn').forEach((b) => b.classList.toggle('show', vis.has(b.dataset.g)));
    };
    const release = () => { const now = performance.now(); for (const [k, t] of vis) if (t === Infinity) vis.set(k, now + HOLD); setTimeout(refresh, HOLD + 30); };
    box.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-g]');
      const k = t ? t.dataset.g : null;
      for (const [key, tm] of vis) if (key !== k && tm === Infinity) vis.set(key, performance.now() + HOLD);
      if (k) vis.set(k, Infinity);
      refresh();
      setTimeout(refresh, HOLD + 30);
    });
    box.addEventListener('pointerleave', release);
  }
  const mk = (text, cls, left, top, fn, title) => {
    const b = document.createElement('button');
    b.className = 'mbtn ' + cls;
    b.dataset.g = gk;
    if (gk && box._mbVis && (box._mbVis.get(gk) || 0) > performance.now()) b.classList.add('show'); // fare bu perin üstünde ya da az önce oradaydı
    b.textContent = text;
    if (title) b.title = title;
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.onclick = (e) => { e.stopPropagation(); fn(); };
    box.appendChild(b);
  };
  findGroups(hand.order, byId).forEach((g) => {
    const last = g[g.length - 1];
    const isLastCard = hand.order[hand.order.length - 1] === last;
    const right = fx[last] + (isLastCard ? hw : Math.min(Gf.sp, hw));
    tag(g);
    mk(g.kind === 'per' ? '⬆ Per taşı' : '⬆ Çift taşı', g.kind === 'per' ? 'per' : 'pair', right - 62, T.front - 24, () => liftGroup(g, 0), g.kind === 'per' ? 'Bu peri arka kata taşı' : 'Bu çifti arka kata taşı');
  });
  for (const r of [1, 2]) {
    const top = r === 1 ? T.r1 : T.r2;
    if (top == null) continue;
    backGroups(rowArr(r)).forEach((g) => {
      const last = g[g.length - 1];
      const x = pos[r][last] + Math.min(spOf[r], hw) - 2;
      const y = Math.max(0, top - 18);
      tag(g);
      mk('⬇', 'down', x, y, () => dropGroup(g, r), 'Bir kat aşağı');
    });
  }
}
// Sürüklenen kağıt elin neresine düşer: hangi kat, kaçıncı sıra
function gapAt(px, py, dragId) {
  const box = $('hand');
  const r = box.getBoundingClientRect();
  const W = box.clientWidth;
  const x = px - r.left;
  const y = py - r.top;
  const T = rowTops();
  const backRow = T.r2 != null && y < T.r1 ? 2 : y < T.front ? 1 : 0;
  if (backRow) {
    const back = cleanBack(rowArr(backRow).filter((id) => id !== dragId));
    const B = backLayout(back, W);
    const idx = B.xs.filter((bxv) => bxv + Math.max(B.sp, hw * 0.3) / 2 < x).length;
    return { row: backRow, idx };
  }
  const n = hand.order.filter((id) => id !== dragId).length + 1;
  const G = rowGeo(n - 1, W, hw * 0.6);
  const idx = n <= 1 || G.sp <= 0 ? 0 : Math.max(0, Math.min(n - 1, Math.floor((x - G.x0) / G.sp)));
  return { row: 'front', idx };
}
function renderHand() {
  const g = S.game;
  const byId = Object.fromEntries(g.myHand.map((c) => [c.id, c]));
  const box = $('hand');
  const fresh = handEls.size > 0;
  for (const [id, el] of handEls) if (!byId[id]) { el.remove(); handEls.delete(id); }
  for (const id of [...hand.order, ...backIds()]) {
    if (handEls.has(id)) continue;
    const el = cardEl(byId[id]);
    if (fresh) { // yeni çekilen kağıt yukarıdan gelsin
      el.style.left = box.clientWidth / 2 - hw / 2 + 'px';
      el.style.top = rowTops().front + 'px';
      el.style.transform = `translateY(${-hw * 1.6}px) rotate(-10deg)`;
    }
    box.appendChild(el);
    handEls.set(id, el);
  }
  if (fresh) box.offsetWidth; // geçiş animasyonu için
  layoutHand();
}

// ---------- Oyun eylemleri ----------
const myTurn = () => S.game && S.game.status === 'playing' && S.game.turn === S.mySeat;
function doDraw(src, idx) {
  if (!myTurn() || S.game.phase !== 'draw') return toast(myTurn() ? 'Önce kağıt at' : 'Sıra sende değil');
  emit('draw', { src }, (res) => {
    if (idx != null && res.card) moveTo(res.card.id, idx);
  });
}
// ---------- Oyun içi onay penceresi (tarayıcı kutusu yerine, animasyonlu) ----------
function ask({ title, card = null, cardSpin = false, body = '', okText = 'Evet', cancelText = 'Vazgeç', tone = 'gold' }) {
  return new Promise((resolve) => {
    document.querySelectorAll('.ask-wrap').forEach((x) => x.remove());
    const wrap = document.createElement('div');
    wrap.className = 'ask-wrap';
    wrap.innerHTML = `<div class="ask ${tone}">
        <div class="ask-glow"></div>
        <div class="ask-title">${title}</div>
        <div class="ask-card"></div>
        <div class="ask-body">${body}</div>
        <div class="ask-btns"><button class="ask-no">${cancelText}</button><button class="ask-yes primary">${okText}</button></div>
      </div>`;
    if (card) {
      const el = cardEl(card);
      if (cardSpin) el.classList.add('spin');
      wrap.querySelector('.ask-card').appendChild(el);
    } else wrap.querySelector('.ask-card').remove();
    document.body.appendChild(wrap);
    FX.play('flip');
    const done = (v) => {
      document.removeEventListener('keydown', key, true);
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 220);
      resolve(v);
    };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
      if (e.key === 'Enter') { e.preventDefault(); done(true); }
    };
    document.addEventListener('keydown', key, true);
    wrap.querySelector('.ask-yes').onclick = () => done(true);
    wrap.querySelector('.ask-no').onclick = () => done(false);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) done(false); });
    setTimeout(() => wrap.querySelector('.ask-yes').focus(), 50);
  });
}

async function discardCard(id, finish) {
  if (!myTurn() || S.game.phase !== 'discard') return toast(myTurn() ? 'Önce kağıt çek' : 'Sıra sende değil');
  const c = S.game.myHand.find((x) => x.id === id);
  if (!c) return;
  if (finish) {
    const ok = await ask({
      title: 'Elini bitiriyor musun?',
      card: c,
      body: `<b>${cardLabel(c)}</b> kağıdını atıp elini bitireceksin.<br><span class="ask-note">Elin bitmeye uygun değilse kağıt atılmaz, oyun devam eder.</span>`,
      okText: '🏁 Bitir',
      cancelText: 'Vazgeç',
    });
    if (!ok) return;
  }
  emit('discard', { cardId: id, finish }, () => { selected = null; });
}
$('btnDiscard').onclick = () => selected && discardCard(selected, false);
$('btnUndo').onclick = () => emit('undoTake', {}, () => { selected = null; });
$('btnShow').onclick = async () => {
  const g = S.game;
  if (g.turn !== S.mySeat) return toast('Gösterge ancak sıran gelince, kağıt çekmeden önce gösterilir.');
  const bonus = 10 * SUIT_MULT[g.okey.s];
  const ok = await ask({
    title: '🃏 Göstergeyi göstermek istiyor musun?',
    card: g.indicator,
    cardSpin: true,
    tone: 'purple',
    body: `<div class="ask-opts">
        <div class="ask-opt good"><span>✔</span><div><b>Göstergen varsa</b><br>−${bonus} puan ödül<br><small>+ çifte gidersen bu kağıt istediğin kağıtla çift sayılır</small></div></div>
        <div class="ask-opt bad"><span>✖</span><div><b>Göstergen yoksa</b><br>+50 puan ceza<br><small>herkes görür</small></div></div>
      </div>`,
    okText: '🃏 Göster',
    cancelText: 'Vazgeç',
  });
  if (ok) emit('showIndicator', {});
};
const myShownId = () => (S && S.game && S.game.shown && S.game.shown.seat === S.mySeat ? S.game.shown.card.id : null);

// Gösterge gösterildi: herkese 1 sn'lik pencere, kağıt 360° dönerek belirir
let lastShowKey = null;
let lastShowHand = null;
function checkShowFx() {
  const g = S.game;
  const key = g.showEvent ? `${S.code}-${g.handNo}-${g.showEvent.seq}` : null;
  const sawHandBefore = lastShowHand === `${S.code}-${g.handNo}`;
  if (key && key !== lastShowKey && sawHandBefore) playShowFx(g.showEvent);
  lastShowKey = key;
  lastShowHand = `${S.code}-${g.handNo}`;
}
function playShowFx(ev) {
  const fx = $('showFx');
  const me = ev.seat === S.mySeat;
  const box = fx.querySelector('.fx-card');
  box.innerHTML = '';
  fx.classList.toggle('bad', !ev.ok);
  fx.classList.add('block'); // 1 sn boyunca masaya dokunulamaz
  if (ev.ok) FX.play('chime');
  else { FX.play('penalty'); FX.shake($('game')); }
  if (ev.type === 'okey') {
    fx.querySelector('.fx-title').textContent = me ? `Yere okey attın, ${ev.pts} puan ceza yedin!` : `${nameOf(ev.seat)} yere okey attı, ${ev.pts} puan ceza yedi!`;
    const c = cardEl(ev.card);
    c.classList.add('spin');
    box.appendChild(c);
    fx.querySelector('.fx-sub').textContent = `+${ev.pts} ceza`;
  } else if (ev.ok) {
    fx.querySelector('.fx-title').textContent = me ? 'Göstergeyi gösterdin!' : `${nameOf(ev.seat)} göstergeyi gösterdi!`;
    const c = cardEl(ev.card);
    c.classList.add('spin');
    box.appendChild(c);
    fx.querySelector('.fx-sub').textContent = `${ev.card.b === 'red' ? 'Kırmızı' : 'Mavi'} desteden · ${ev.pts} puan`;
  } else {
    fx.querySelector('.fx-title').textContent = me ? 'Göstergen yok!' : `${nameOf(ev.seat)} göstergesi yokken gösterdi!`;
    box.innerHTML = '<div class="fx-x">✖</div>';
    fx.querySelector('.fx-sub').textContent = `+${ev.pts} ceza`;
  }
  fx.classList.remove('hidden', 'fade');
  clearTimeout(playShowFx.t1);
  clearTimeout(playShowFx.t2);
  playShowFx.t1 = setTimeout(() => fx.classList.add('fade'), 3000); // 3 sn görünür
  playShowFx.t2 = setTimeout(() => fx.classList.add('hidden'), 3350);
}
$('btnFinish').onclick = () => (selected ? discardCard(selected, true) : toast('Atacağın kağıdı seç'));
$('btnScore').onclick = () => openModal('score');
$('btnResult').onclick = () => { resultHidden = false; openModal('result'); };

// ---------- Sürükle-bırak (fare + dokunmatik) ----------
let drag = null;
function startDrag(e, kind, id, el) {
  if (e.button > 0) return;
  drag = { kind, id, el, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, gap: null, gk: null };
}
function overHand(x, y) {
  const r = $('hand').getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 40;
}
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    drag.moved = true;
    FX.play('pick');
    const r = drag.el.getBoundingClientRect();
    drag.ghost = drag.el.cloneNode(true);
    drag.ghost.classList.add('ghost');
    drag.ghost.classList.remove('sel', 'dragging');
    drag.ghost.style.cssText = `width:${drag.el.offsetWidth}px;height:${drag.el.offsetHeight}px;--cw:${drag.el.offsetWidth}px`;
    drag.dx = drag.el.offsetWidth / 2;
    drag.dy = drag.el.offsetHeight * 0.4;
    document.body.appendChild(drag.ghost);
    if (drag.kind === 'card') drag.el.classList.add('dragging');
  }
  drag.ghost.style.left = e.clientX - drag.dx + 'px';
  drag.ghost.style.top = e.clientY - drag.dy + 'px';
  const inHand = overHand(e.clientX, e.clientY);
  const dragId = drag.kind === 'card' ? drag.id : null;
  const gap = inHand ? gapAt(e.clientX, e.clientY, dragId) : null;
  $('hand').classList.toggle('hover', inHand && drag.kind !== 'card');
  const gk = gap ? `${gap.row}:${gap.idx}` : null;
  if (gk !== drag.gk) {
    drag.gk = gk;
    drag.gap = gap;
    layoutHand(dragId, gap);
  }
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const dz = $('discard');
  dz.classList.toggle('hover', drag.kind === 'card' && !inHand && overFelt(t));
});
// Kağıt, çuhanın herhangi bir yerine bırakılınca yığına atılır (defter hariç)
function overFelt(t) { return !!t && $('felt').contains(t) && !$('notebook').contains(t); }
function endDrag(e, cancel) {
  if (!drag) return;
  const d = drag;
  drag = null;
  $('hand').classList.remove('hover');
  $('discard').classList.remove('hover');
  let dropRect = null;
  if (d.ghost) { dropRect = d.ghost.getBoundingClientRect(); d.ghost.remove(); }
  d.el.classList.remove('dragging');
  if (cancel) { layoutHand(); return; }
  if (!d.moved) return onTap(d);
  const t = document.elementFromPoint(e.clientX, e.clientY);
  if (d.kind === 'card') {
    if (d.gap != null) return moveTo(d.id, d.gap);
    layoutHand();
    if (overFelt(t)) { lastDrop = { id: d.id, rect: dropRect, t: Date.now() }; discardCard(d.id, false); }
  } else {
    layoutHand();
    if (d.gap != null) doDraw(d.kind, d.gap);
  }
}
document.addEventListener('pointerup', (e) => endDrag(e, false));
document.addEventListener('pointercancel', (e) => endDrag(e, true));
function onTap(d) {
  if (d.kind === 'card') { selected = selected === d.id ? null : d.id; layoutHand(); renderBar(); }
  else doDraw(d.kind, null);
}
$('hand').addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.card');
  if (c) { e.preventDefault(); startDrag(e, 'card', c.dataset.id, c); }
});
$('hand').addEventListener('dblclick', (e) => {
  const c = e.target.closest('.card');
  if (c) discardCard(c.dataset.id, false);
});
$('deck').addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.card');
  if (c && myTurn() && S.game.phase === 'draw') { e.preventDefault(); startDrag(e, 'deck', null, c); }
});
// Yerdeki son kağıt: dokun ya da ele sürükle
$('spread').addEventListener('pointerdown', (e) => {
  const c = e.target.closest('.card');
  if (!c) return;
  if (!c.classList.contains('last')) return toast('Sadece en son atılan kağıt alınabilir');
  if (!canTakePile()) {
    const top = S.game.pile[S.game.pile.length - 1];
    if (top && isWild(top, S.game.okey)) return toast('Yerdeki okey alınamaz.');
    return toast(myTurn() ? (S.game.phase === 'draw' ? 'Bu kağıt alınamaz' : 'Önce kağıt at') : 'Sıra sende değil');
  }
  e.preventDefault();
  startDrag(e, 'pile', null, c);
});
window.addEventListener('resize', relayout);
// Boyut değişince (döndürme, pencere) düzen tamamlandıktan sonra bir kez daha hizala
new ResizeObserver(() => { if (S && S.game && $('table').clientHeight > 0) relayout(); }).observe($('table'));
function relayout() {
  sizeHand();
  if (S && S.game) { renderOpps(); layoutTable(); renderNotebook(); renderSpread(); layoutHand(); }
}
sizeHand();

// ---------- Masa ----------
function renderBar() {
  const g = S.game;
  const st = $('status');
  let msg;
  const inFinal = g.final && g.active.length === 2;
  if (g.status === 'settle') msg = settleText(g);
  else if (g.status !== 'playing') msg = 'El bitti.';
  else if (inFinal && !g.active.includes(S.mySeat)) {
    msg = `🏆 ${g.final.first === S.mySeat ? '1.' : '2.'} oldun! Finali izliyorsun: ${nameOf(g.active[0])} - ${nameOf(g.active[1])} · Sıra: ${nameOf(g.turn)}`;
  } else if (inFinal && myTurn()) {
    const opp = g.active.find((x) => x !== S.mySeat);
    const t = totalsOf();
    const diff = t[S.mySeat] - t[opp];
    msg = (g.phase === 'draw' ? 'Sıra sende: çek ya da yerdekini al.' : 'Sıra sende: at ya da bitir.') +
      (diff > 0 ? ` · FİNAL: ${nameOf(opp)}'dan ${diff} puan gerisin` : diff < 0 ? ` · FİNAL: ${-diff} puan öndesin` : ' · FİNAL: puanlar eşit');
  } else if (myTurn() && g.phase === 'draw' && g.myReady) {
    msg = '🔥 Okeye döndün! Önce kağıt çek: çektiğin kağıt perlerine uyarsa okeyi seçip Bitir.';
  } else if (myTurn()) msg = g.phase === 'draw' ? 'Sıra sende: desteden çek ya da yerdeki son kağıdı al.' : 'Sıra sende: bir kağıt at ya da seçip bitir.';
  else msg = `Sıra: ${nameOf(g.turn)}`;
  st.textContent = msg;
  st.classList.toggle('me-turn', myTurn());
  const canDiscard = myTurn() && g.phase === 'discard' && !!selected;
  $('btnDiscard').disabled = !canDiscard;
  $('btnUndo').classList.toggle('hidden', !(myTurn() && g.phase === 'discard' && g.takenId));
  // Gösterge düğmesi hep açık: kimde gösterge olduğu belli olmasın
  $('btnShow').classList.toggle('hidden', g.status !== 'playing' || !(g.active || [0, 1, 2, 3]).includes(S.mySeat));
  $('btnFinish').disabled = !canDiscard;
}

function renderOpps() {
  const g = S.game;
  const me = S.mySeat;
  const team = g.mode === 'team';
  for (let r = 1; r <= 3; r++) {
    const seat = (me + r) % 4;
    const el = $(OPP[r]);
    const p = S.seats[seat];
    el.className = 'opp' + (r !== 2 ? ' side' : '') + (g.status === 'playing' && g.turn === seat ? ' turn' : '') + (p && !p.connected ? ' off' : '');
    const tag = team ? `<span class="tag ${seat % 2 === me % 2 ? 'partner' : ''}">${seat % 2 === me % 2 ? 'Eşin' : 'Rakip'}</span>` : '';
    const out = g.final && g.active.length === 2 && !g.active.includes(seat);
    const ct = out ? `🏆 ${g.final.first === seat ? '1.' : '2.'} oldu` : `${g.handCounts[seat]} kağıt`;
    const nm0 = nameOf(seat);
    const chair = document.querySelector('.chair.c' + r);
    if (chair) chair.classList.toggle('turn', g.status === 'playing' && g.turn === seat);
    el.innerHTML = `<div class="oinfo"><div class="nm">${p && p.bot ? '🤖 ' : ''}${esc(nm0)}</div><div class="ct">${ct}</div>${tag}</div><div class="ofan"></div>`;
    if (el.dataset.il) { const io = el.querySelector('.oinfo'); io.style.left = el.dataset.il; io.style.top = el.dataset.it; } // 3B rozet konumu korunur
    if (out) el.classList.add('out');
    if (g.shown && g.shown.seat === seat) el.querySelector('.ct').insertAdjacentHTML('beforeend', ' · <span class="shown-tag">🃏 gösterge</span>');
    // kapalı yelpaze
    // Kapalı yelpaze: elindeki kağıtların HEPSİ, dizdiği sırayla. Kağıtları kendine dönük
    // tuttuğu için bizden bakınca ayna görüntüsü (onun solu bizim sağımız).
    const fan = el.querySelector('.ofan');
    const info = (g.backs && g.backs[seat]) || { colors: [] };
    const cols = info.colors.slice().reverse();
    const n = cols.length || g.handCounts[seat];
    mountPlayer(r, seat, nm0, g.status === 'playing' && g.turn === seat, cols.length ? cols : Array(n).fill('blue'));
    const cw = window.innerWidth < 600 ? 18 : 24;
    const maxW = r === 2 ? Math.min(240, window.innerWidth * 0.5) : window.innerWidth < 600 ? 110 : 150;
    const sp = n > 1 ? Math.min(cw * 0.5, (maxW - cw) / (n - 1)) : 0;
    const fanW = cw + sp * (n - 1);
    fan.style.width = fanW + 'px';
    if (r !== 2) {
      // yandaki oyuncu: eli masanın yanından dikey görünür
      const box = document.createElement('div');
      box.className = 'ofan-box';
      box.style.height = fanW + 10 + 'px';
      fan.replaceWith(box);
      box.appendChild(fan);
      fan.style.transform = `translate(-50%, -50%) rotate(${r === 3 ? 90 : -90}deg)`;
    }
    fan.dataset.seat = seat;
    const mid = (n - 1) / 2;
    const step = n > 1 ? Math.min(5, 50 / n) : 0;
    for (let i = 0; i < n; i++) {
      const b = backEl(cols[i] || 'blue');
      b.style.left = i * sp + 'px';
      b.style.transform = `rotate(${(i - mid) * step}deg) translateY(${Math.abs(i - mid) * 0.6}px)`;
      b.style.zIndex = i;
      fan.appendChild(b);
    }
  }
  $('tableTop').classList.toggle('my-turn', g.status === 'playing' && g.turn === me);
  playerCard('me', me, nameOf(me), g.status === 'playing' && g.turn === me, g.myHand.length);
  // masa kenarındaki şerit LED'ler: sırası gelenin tarafı kırmızı, diğerleri beyaz
  ['b', 'r', 't', 'l'].forEach((k, r) => {
    const led = document.querySelector('.led-' + k);
    if (led) led.classList.toggle('on-turn', g.status === 'playing' && g.turn === (me + r) % 4);
  });
}

// ---------- Kamera yakınlaştırma ----------
// Yakınlaştırma sabit %125 (ayar kaldırıldı). Dar telefon ekranında yan oyuncular kesilmesin diye %100.
let zoom = window.innerWidth < 600 ? 1 : 1.25;
window.addEventListener('resize', () => { zoom = window.innerWidth < 600 ? 1 : 1.25; });

// ---------- Kamera açısı: farenin orta tuşu basılıyken yukarı/aşağı sürükle ----------
// tilt = masanın ekran düzleminden yatırılma açısı; büyüdükçe kamera alçalır, masaya karşıdan bakar
const TILT_MIN = 8;
const TILT_MAX = 66;
// kuş bakışı: masa tepeden görünür (varsayılan 18°; orta tuşla sürükleyerek değişir)
let camTilt = Math.min(TILT_MAX, Math.max(TILT_MIN, Number(store.get('i51-tilt2')) || 18));
let tiltDrag = null;
let tiltRaf = 0;
function setTilt(t) {
  camTilt = Math.min(TILT_MAX, Math.max(TILT_MIN, Math.round(t * 2) / 2));
  store.set('i51-tilt2', camTilt);
  if (tiltRaf) return;
  tiltRaf = requestAnimationFrame(() => {
    tiltRaf = 0;
    if (S && S.game) { layoutTable(); renderNotebook(); renderSpread(); renderOpps(); layoutHand(); }
  });
}
$('game').addEventListener('mousedown', (e) => {
  if (e.button !== 1) return;
  e.preventDefault(); // tarayıcının otomatik kaydırmasını engelle
  tiltDrag = { y: e.clientY, t: camTilt };
  document.body.classList.add('tilting');
});
window.addEventListener('mousemove', (e) => { if (tiltDrag) setTilt(tiltDrag.t + (e.clientY - tiltDrag.y) * 0.12); });
window.addEventListener('mouseup', (e) => { if (e.button === 1 && tiltDrag) { tiltDrag = null; document.body.classList.remove('tilting'); } });
$('game').addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

// ---------- 3B masa: perspektifte yere oturan geniş masa, etrafında oturan oyuncular ----------
const PL = [null, 'right', 'top', 'left'];
const PL_AVATAR = 72; // 3B çalışmazsa 2B portre boyu
const plLast = {};
// 3B karakterler kaldırıldı: oyuncular yuvarlak portre + bilgi kartı (2B), 3B sahne yalnızca oda ve masa
document.body.classList.toggle('p3d', false);
function mountPlayer(r, seat, name, turn, cols) {
  playerCard(r === 0 ? 'me' : PL[r], seat, name, turn, cols.length);
}
// Oyuncu kartı: yuvarlak vesikalık portre + isim, altın, oyun puanı, kağıt sayısı
function playerCard(slot, seat, name, turn, nCards) {
  const host = $('pl-' + slot);
  if (!host) return;
  const g = S.game;
  const p = S.seats[seat];
  const seed = strHash(name || '?');
  // seçtiği avatar varsa kütüphaneden, yoksa isminden türetilen portre
  const av = p && Number.isInteger(p.avatar) ? p.avatar : null;
  const key = av != null ? 'a' + av : 's' + seed;
  if (host.dataset.seed !== key) {
    host.dataset.seed = key;
    const female = Stage3D.isFemaleName ? Stage3D.isFemaleName(name) : false;
    const pic = av != null ? Avatar.byId(av, 'av' + slot) : Avatar.svg(seed, { female, uid: 'av' + slot });
    host.innerHTML = `<div class="pcard"><div class="pav"${slot === 'me' ? ' title="Profil resmini değiştir"' : ''}>${pic}${slot === 'me' ? '<span class="pav-edit">✎</span>' : ''}</div>
      <div class="pinf"><div class="pn"></div><div class="pg"></div><div class="ps"></div><div class="pc"></div></div></div>`;
    if (slot === 'me') host.querySelector('.pcard').onclick = openAvatarPicker;
  }
  const tot = totalsOf()[seat];
  const team = g.mode === 'team' && slot !== 'me' ? (seat % 2 === S.mySeat % 2 ? ' <span class="ptag partner">Eşin</span>' : ' <span class="ptag">Rakip</span>') : '';
  host.querySelector('.pn').innerHTML = `${p && p.bot ? '🤖 ' : ''}${esc(name)}${slot === 'me' ? ' <small>(sen)</small>' : ''}${team}`;
  const gold = slot === 'me' ? myGold : p && p.gold;
  host.querySelector('.pg').innerHTML = p && p.bot ? 'Bilgisayar' : gold == null ? '🪙 —' : `🪙 ${fmt(gold)}`;
  host.querySelector('.ps').innerHTML = `Puan <b>${tot}</b>`;
  const out = g.final && g.active.length === 2 && !g.active.includes(seat);
  const shown = g.shown && g.shown.seat === seat ? ' · 🃏 gösterge' : '';
  host.querySelector('.pc').textContent = (out ? `🏆 ${g.final.first === seat ? '1.' : '2.'} oldu` : `${nCards} kağıt`) + shown;
  host.classList.toggle('turn', !!turn);
  host.classList.toggle('off', !!(p && !p.connected));
  host.classList.toggle('out', !!out);
}

function layoutTable() {
  const box = $('tableBox');
  const top = $('tableTop');
  const W = box.clientWidth;
  const H = box.clientHeight;
  if (W <= 0 || H <= 0) return;
  const narrow = window.innerWidth < 600;
  const short = window.innerHeight < 560;
  const p3 = Stage3D.available;
  // masaüstü 3B: gerçek ölçülü kare masa (~1.1 m); masa, eldeki kağıt boyuna göre büyür, kağıtlar küçülmez
  const sq = p3 && !narrow && !short;
  const TM = sq ? 1.1 : 2.6; // masanın derinliği (metre)
  const ks = sq ? 1 : narrow ? 0.62 : 0.85; // oyuncu ölçeği
  const tilt = narrow ? 36 : camTilt;
  const cosT = Math.cos((tilt * Math.PI) / 180);
  // üstteki oyuncunun masanın arkasında kalan boyu; yan oyuncuların masa kenarından dışarı taşan eni
  let headRoom, availH, sideRoom;
  if (sq) {
    const lift = 0.27; // üstte karşıdaki oyuncunun kartı için pay (masa boyuna oranla; kuş bakışında açıdan bağımsız)
    const fitTH = (H - 12) / (1.15 * cosT + lift);
    const cardTH = (5.4 * hw) / 0.89; // deste + gösterge + yerdeki yığın tam boy sığsın
    const TH0 = Math.min(fitTH, cardTH, W / (1 + 1.3 / TM));
    headRoom = Math.round(lift * TH0 + 12);
    availH = TH0 * cosT;
    sideRoom = Math.round((0.6 / TM) * TH0);
  } else {
    headRoom = short ? 14 : p3 ? Math.round(H * (narrow ? 0.2 : 0.23)) : PL_AVATAR + 4;
    availH = (H - headRoom) / 1.2; // kalan pay masanın kalınlığı ve ayakları
    sideRoom = short ? 34 : p3 ? Math.round(0.23 * (availH / cosT) * ks) + 4 : narrow ? 48 : 54;
  }
  const availW = W - 2 * sideRoom;
  const aspect = sq ? 1 : Math.max(0.8, Math.min(1.7, (availW / availH) * cosT));
  top.style.setProperty('--tilt', tilt + 'deg');
  box.style.setProperty('--u', ks);

  let TH = availH / cosT;
  let TW = Math.min(availW, TH * aspect);
  TH = Math.min(TH, TW / aspect);
  const apply = () => {
    const rim = Math.round(Math.max(10, TH * (narrow ? 0.05 : 0.055)));
    const m = p3 ? Stage3D.metrics(TH, TM) : { thick: Math.round(TH * 0.05), leg: Math.round(TH * 0.13) };
    top.style.width = TW + 'px';
    top.style.height = TH + 'px';
    top.style.left = (W - TW) / 2 + 'px';
    top.style.setProperty('--S', TH + 'px');
    top.style.setProperty('--rim', rim + 'px');
    top.style.setProperty('--T', m.thick + 'px');
    top.style.setProperty('--L', m.leg + 'px');
    return rim;
  };
  let rim = apply();
  top.style.top = '0px';
  for (let i = 0; i < 6; i++) {
    const rc = top.getBoundingClientRect();
    const k = Math.min(availW / rc.width, availH / rc.height);
    if (Math.abs(k - 1) < 0.004) break;
    TW *= k;
    TH *= k;
    rim = apply();
  }
  const br = box.getBoundingClientRect();
  const rc = top.getBoundingClientRect();
  top.style.top = headRoom - (rc.top - br.top) + 'px';
  if (zoom !== 1) {
    // yakınlaş/uzaklaş: masa aynı merkez etrafında büyür, oyuncular 3B'de masayla birlikte hareket eder
    TW *= zoom;
    TH *= zoom;
    rim = apply();
    top.style.top = '0px';
    const rc2 = top.getBoundingClientRect();
    top.style.top = headRoom + rc.height / 2 - rc2.height / 2 + (zoom > 1 ? (zoom - 1) * rc.height * 0.4 : 0) - (rc2.top - br.top) + 'px';
  }

  // masadaki kağıtlar çuhaya sığsın: orta sıra (deste + gösterge) ve altında yere atılanlar
  const feltH = TH - 2 * rim;
  pw = Math.round(Math.max(26, Math.min(sq ? hw * 1.15 : hw, (feltH - 96) / 2.85, (TW - 2 * rim) * (sq ? 0.23 : 0.16))));
  document.documentElement.style.setProperty('--pw', pw + 'px');

  const ot = $('opp-top');
  const ol = $('opp-left');
  const or = $('opp-right');
  const put = (el, x, y) => { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; };

  if (p3) {
    // 3B sahne, masanın CSS perspektifiyle aynı kamerayı kullanır; oyuncular masa koordinatlarında oturur
    const cx = br.left + parseFloat(top.style.left) + TW / 2;
    const cy = br.top + parseFloat(top.style.top) + TH / 2;
    Stage3D.layout({ vw: window.innerWidth, vh: window.innerHeight, ox: br.left + br.width / 2, oy: br.top + br.height * 0.28, cx, cy, TW, TH, tilt, ks, TM }, false);
  }

  // Oyuncu kartları (portre + bilgi) masanın kenarlarında; kapalı elleri kartın yanında
  const pt = (sel) => {
    const r = top.querySelector(sel).getBoundingClientRect();
    return { x: r.left - br.left, y: r.top - br.top };
  };
  const mt = pt('.mk-t');
  const ml = pt('.mk-l');
  const mr = pt('.mk-r');
  const mbl = pt('.mk-bl');
  const av = Math.round(Math.max(56, Math.min(92, TH * 0.17)));
  box.style.setProperty('--av', av + 'px');
  const hosts = { top: $('pl-top'), left: $('pl-left'), right: $('pl-right'), me: $('pl-me') };
  for (const k in hosts) { hosts[k].style.width = ''; hosts[k].style.height = ''; }
  const gap = narrow ? 10 : 18;
  // üst: kart masanın üst kenarının üstünde ortada, kapalı eli kartın sağında
  const ht = hosts.top;
  put(ht, mt.x - ht.offsetWidth / 2, mt.y - ht.offsetHeight - gap);
  put(ot, mt.x + ht.offsetWidth / 2 + 14 + ot.offsetWidth / 2, mt.y - ht.offsetHeight / 2 - gap - ot.offsetHeight / 2);
  // yanlar: kart masanın yan kenarının dışında, kapalı eli kartın altında
  [[ol, hosts.left, ml, -1], [or, hosts.right, mr, 1]].forEach(([el, host, m, dir]) => {
    const w = host.offsetWidth;
    const x = dir < 0 ? m.x - gap - w : m.x + gap;
    const y = m.y - host.offsetHeight / 2 - 30;
    put(host, x, y);
    put(el, x + w / 2 - el.offsetWidth / 2, y + host.offsetHeight + 8);
  });
  // ben: ekranın sol alt köşesinde (CSS ile sabit)
}

// Bu elde oynayanlar arasında benden önceki oyuncu (finalde 2 kişi)
function prevActive(seat) {
  const a = S.game.active || [0, 1, 2, 3];
  return a[(a.indexOf(seat) + a.length - 1) % a.length];
}
function canTakePile() {
  const g = S.game;
  const top = g.pile[g.pile.length - 1];
  return myTurn() && g.phase === 'draw' && !!top && top.by === prevActive(S.mySeat) && !isWild(top, g.okey); // yerdeki okey alınamaz
}

// Ortaya atılan kağıtlar: gerçek masadaki gibi tek yığın; her kağıt hafif kaymış ve çapraz durur
function pileJitter(c) {
  const r = seeded(strHash(String(c.id)) + 17);
  return { dx: (r() - 0.5) * 0.3, dy: (r() - 0.5) * 0.24, rot: (r() - 0.5) * 34 };
}
// Dönmüş kağıdın uçuş hedefi: sınırlayıcı kutu değil, kağıdın kendi boyutu
function upright(el) {
  if (!el) return null;
  return cardBox(centerOf(el.getBoundingClientRect()), el.offsetWidth);
}
function renderSpread() {
  const g = S.game;
  const box = $('spread');
  box.innerHTML = '';
  const pile = g.pile;
  const n = pile.length;
  const W = box.clientWidth;
  const H = box.clientHeight;
  const cw = Math.max(18, pw);
  const ch = cw * 1.4;
  box.style.setProperty('--cw', cw + 'px');
  const take = canTakePile();
  pile.slice(-14).forEach((c, k, arr) => {
    const j = pileJitter(c);
    const el = cardEl(c);
    el.style.left = W / 2 - cw / 2 + j.dx * cw + 'px';
    el.style.top = H / 2 - ch / 2 + j.dy * ch + 'px';
    el.style.transform = `rotate(${j.rot.toFixed(1)}deg)`;
    el.dataset.rot = j.rot.toFixed(1);
    el.style.zIndex = k + 1;
    if (k === arr.length - 1) {
      el.classList.add('last');
      if (take) el.classList.add('can-take');
    }
    box.appendChild(el);
  });
  const last = pile[n - 1];
  $('discardHint').textContent = !n
    ? 'Kağıtlar ortadaki yığına atılır'
    : take ? 'Son atılan kağıdı alabilirsin: dokun ya da eline sürükle'
    : `Son atan: ${last.by === S.mySeat ? 'sen' : nameOf(last.by)}`;
}

// ---------- Puan defteri: elle yazılmış, kalemle çizilmiş görünüm ----------
function seeded(seed) { // mulberry32: aynı oda için hep aynı titreme
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strHash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
// Elle çekilmiş çizgi: hafif titrek, uçları biraz taşan
function handLine(x1, y1, x2, y2, rnd) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.round(len / 16));
  const over = 2 + rnd() * 3;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ext = i === 0 ? -over * rnd() : i === n ? over * rnd() : 0;
    pts.push([x1 + (x2 - x1) * t + ux * ext + (rnd() - 0.5) * 1.6, y1 + (y2 - y1) * t + uy * ext + (rnd() - 0.5) * 1.6]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + x) / 2).toFixed(1)} ${((py + y) / 2).toFixed(1)}`;
  }
  d += ` L${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`;
  return `<path d="${d}" stroke-width="${(1.1 + rnd() * 0.6).toFixed(2)}"/>`;
}
function renderNotebook() {
  const nb = $('notebook');
  if (!S || !S.game) return;
  if (nb.parentElement !== $('felt')) $('felt').appendChild(nb);
  const g = S.game;
  Stage3D.setScores({ names: [0, 1, 2, 3].map(nameOf), rows: g.scores, totalHands: g.totalHands, final: g.final ? { first: g.final.first, second: g.final.second } : null, team: g.mode === 'team', solo: g.mode === 'solo' });
  const team = g.mode === 'team';
  const W = 250;
  const x0 = 22; // solda el numaraları için kenar boşluğu
  const colW = (W - x0 - 8) / 4;
  const headH = 36;
  const rowH = 22;
  const maxRows = Math.max(11, g.totalHands); // defter 11 ellik
  const start = Math.max(0, g.scores.length - maxRows);
  const rows = g.scores.slice(start);
  const totals = [0, 1, 2, 3].map((i) => g.scores.reduce((a, h) => a + h[i], 0));
  const bodyRows = maxRows;
  const totY = headH + bodyRows * rowH + 10;
  const H = totY + 32 + (team ? 24 : 0);
  const seed = strHash(S.code);
  const rnd = seeded(seed);

  // çizgiler
  let lines = handLine(6, headH, W - 6, headH + (rnd() - 0.5) * 3, rnd);
  for (let c = 1; c < 4; c++) {
    const x = x0 + c * colW + (rnd() - 0.5) * 4;
    lines += handLine(x, 6 + rnd() * 4, x + (rnd() - 0.5) * 5, totY + 26 + rnd() * 4, rnd);
  }
  lines += handLine(8, totY, W - 8, totY + (rnd() - 0.5) * 2, rnd);
  lines += handLine(10, totY + 3.5, W - 12, totY + 3 + (rnd() - 0.5) * 2, rnd);
  if (team) lines += handLine(W / 2 + (rnd() - 0.5) * 4, totY + 30, W / 2 + (rnd() - 0.5) * 6, H - 4, rnd);

  // yazılar
  const txt = [];
  const put = (text, cls, cx, y, key) => {
    const r = seeded(seed + key * 7919);
    const rot = (r() - 0.5) * 7;
    const dx = (r() - 0.5) * 5;
    const dy = (r() - 0.5) * 3;
    txt.push(`<span class="${cls}" style="left:${(cx + dx).toFixed(1)}px;top:${(y + dy).toFixed(1)}px;transform:translateX(-50%) rotate(${rot.toFixed(1)}deg)">${text}</span>`);
  };
  for (let c = 0; c < 4; c++) {
    const cx = x0 + c * colW + colW / 2;
    const nm = nameOf(c);
    put(esc(nm.length > 7 ? nm.slice(0, 6) + '.' : nm), 'nm', cx, 9, 1000 + c);
    rows.forEach((row, k) => {
      if (g.final && start + k === g.totalHands - 1 && (c === g.final.first || c === g.final.second)) return; // finalde oynamadı
      const v = row[c];
      put(String(v), 'v' + (v < 0 ? ' neg' : ''), cx, headH + 4 + k * rowH, (start + k) * 4 + c + 1);
    });
    put(String(totals[c]), 'tot' + (totals[c] < 0 ? ' neg' : ''), cx, totY + 6, 5000 + c);
  }
  if (start > 0) put('…', 'v', W / 2, headH - 4, 4999);
  // el numaraları (son el final: F)
  for (let k = 0; k < Math.min(maxRows, g.totalHands); k++) {
    const no = start + k + 1;
    const isFinal = g.mode === 'solo' && no === g.totalHands;
    put(isFinal ? 'F' : String(no), 'no' + (isFinal ? ' fin' : ''), 9, headH + 6 + k * rowH, 7000 + no);
  }
  // final oynamayan iki kişinin sütununa 'kazandı' işareti
  if (g.final) {
    const finalRow = g.totalHands - 1 - start;
    [g.final.first, g.final.second].forEach((c, j) => {
      if (finalRow >= 0 && finalRow < maxRows) put(j ? '2.' : '1.', 'v win', x0 + c * colW + colW / 2, headH + 4 + finalRow * rowH, 8000 + c);
    });
  }
  if (team) {
    put(`A: ${totals[0] + totals[2]}`, 'tm', W / 4 + 4, totY + 33, 6001);
    put(`B: ${totals[1] + totals[3]}`, 'tm', (3 * W) / 4, totY + 33, 6002);
  }

  const paper = nb.querySelector('.nb-paper');
  paper.style.width = W + 'px';
  paper.style.height = H + 'px';
  const svg = nb.querySelector('.nb-lines');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.innerHTML = lines;
  nb.querySelector('.nb-text').innerHTML = txt.join('');

  // masaya sığacak ölçek (dokununca büyür)
  const felt = $('felt');
  const fw = felt.clientWidth;
  const fh = felt.clientHeight;
  const small = Math.min(0.85, (fw * (fw < 500 ? 0.3 : 0.22)) / W, (fh * (fw < 500 ? 0.96 : 0.62)) / H);
  const big = Math.min(1.25, (fw * 0.9) / W, (fh * 0.92) / H);
  nb.style.setProperty('--nbs', Math.max(0.2, small).toFixed(3));
  nb.style.setProperty('--nbo', Math.max(small, big).toFixed(3));
}
$('notebook').addEventListener('click', () => $('notebook').classList.toggle('open'));

function renderGame() {
  show('game');
  const g = S.game;
  const me = S.mySeat;
  if (!g.myHand.some((c) => c.id === selected)) selected = null;

  const finalNow = g.final && g.active.length === 2;
  $('gInfo').innerHTML = `${finalNow ? '<b class="final-tag">FİNAL</b> ' : ''}El ${g.handNo}/${g.totalHands} · Oda ${S.code} · ${g.mode === 'team' ? 'Eşli' : 'Tekli'}${S.money ? ` · 🪙 Yerde ${fmt(S.money.pot)}` : ' · Ücretsiz'}`;
  renderOpps();
  layoutTable();

  // Ortaya atılanlar (deste + gösterge çizildikten sonra: yükseklik onlara göre değişir)
  $('discard').classList.toggle('drop', myTurn() && g.phase === 'discard');

  // Deste + gösterge
  const deck = $('deck');
  deck.className = myTurn() && g.phase === 'draw' && g.deckCount ? 'can-take' : '';
  deck.innerHTML = '<div class="slotc"></div><span>Deste</span>';
  // Destenin üstündeki kağıdın gerçek arka rengi görünür
  // gerçek kalınlıkta deste: kağıt sayısıyla incelir, biter (48 kağıt ≈ kart eninin beşte biri)
  if (g.deckCount > 0) {
    const top = backEl(g.deckTop, g.deckCount);
    const stk = Math.max(1, Math.round(g.deckCount * pw * 0.0042));
    const layers = [];
    for (let i = 1; i <= stk; i++) layers.push(`0 ${i}px 0 ${i % 2 ? '#d6cfbf' : '#f2ede1'}`);
    layers.push(`0 ${stk + 1}px 0 #8a8478`, `0 ${stk + 3}px 7px rgba(0,0,0,.55)`);
    if (deck.className) layers.push('0 0 0 3px var(--gold)', '0 0 18px var(--gold)');
    top.style.boxShadow = layers.join(',');
    top.style.transform = `translateY(${-stk}px) rotate(-1.2deg)`;
    deck.firstChild.style.paddingTop = stk + 'px';
    deck.firstChild.appendChild(top);
  }
  deck.lastChild.textContent = '';
  const ind = $('indicator');
  ind.innerHTML = '<div class="slotc"></div>';
  ind.firstChild.appendChild(cardEl(g.indicator));
  ind.insertAdjacentHTML('beforeend', `<span class="ind-lbl">Gösterge</span><span class="okey-lbl">Okey: ${SYM[g.okey.s]}${rl(g.okey.r)} · ×${SUIT_MULT[g.okey.s]}</span>`);
  renderNotebook();
  renderSpread();

  $('log').innerHTML = g.log.slice(-3).map((l) => `<div>${esc(l)}</div>`).join('');
  Stage3D.setLog(g.log.slice(-7));
  renderHud(g);

  syncHand();
  renderHand();
  renderBar();
  // gösterdiğim gösterge kağıdı elimde işaretli dursun
  const sid = myShownId();
  handEls.forEach((el, id) => el.classList.toggle('shown-card', id === sid));
  checkShowFx();

  // Sonuç
  $('btnResult').classList.toggle('hidden', g.status === 'playing' || g.status === 'settle');
  renderSettleBar();
  if (g.status === 'playing' || g.status === 'settle') {
    resultHidden = false;
    if (modalKind === 'result') closeModal();
  } else if (!resultHidden) {
    const wait = resultAt - Date.now();
    if (wait > 0) {
      clearTimeout(renderGame.rt);
      renderGame.rt = setTimeout(() => { if (S.game && S.game.status !== 'playing' && !resultHidden && !modalKind) openModal('result'); }, wait);
    } else openModal('result');
  }
  else if (modalKind) openModal(modalKind, modalArg);
}

// ---------- Modallar ----------
function closeModal() { $('modal').classList.add('hidden'); modalKind = null; }

// ---------- Profil resmi seçimi (kütüphanede Avatar.COUNT avatar) ----------
let myAvatar = null;
function openAvatarPicker() {
  const cur = S && S.seats && S.seats[S.mySeat] && Number.isInteger(S.seats[S.mySeat].avatar) ? S.seats[S.mySeat].avatar : myAvatar;
  let tiles = '';
  for (let i = 0; i < Avatar.COUNT; i++) {
    tiles += `<button class="avt${i === cur ? ' cur' : ''}" data-i="${i}" title="Avatar ${i + 1}">${Avatar.byId(i, 'pk')}</button>`;
  }
  modalKind = 'avatar';
  $('modalBody').innerHTML = `<div class="avpick"><h2>Profil resmini seç</h2>
    <p class="muted">Seçtiğin resim masadaki herkese görünür.</p>
    <div class="avgrid">${tiles}</div>
    <div class="mbtns"><button id="avClose">Kapat</button></div></div>`;
  $('modal').classList.remove('hidden');
  $('avClose').onclick = closeModal;
  $('modalBody').querySelector('.avgrid').onclick = (e) => {
    const b = e.target.closest('.avt');
    if (!b) return;
    const n = Number(b.dataset.i);
    emit('setAvatar', { avatar: n }, (res) => {
      myAvatar = res.avatar;
      closeModal();
      toast('Profil resmin değişti');
    });
  };
}
$('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' && modalKind !== 'result') closeModal();
});

// ---------- Sol üst: "Masada olanlar" satırı ve "Puan tablosu" toplamları ----------
let hudLogKey = '';
function renderHud(g) {
  const log = g.log || [];
  $('logLast').textContent = log.length ? log[log.length - 1] : 'Masada olanlar';
  const key = log.length + '|' + (log[log.length - 1] || '');
  if (key !== hudLogKey) {
    hudLogKey = key;
    const list = $('logList');
    list.innerHTML = log.slice(-40).map((l) => `<div>${esc(l)}</div>`).join('');
    list.scrollTop = list.scrollHeight; // en yenisi altta görünsün
  }
  const tot = totalsOf();
  $('scoreTotals').innerHTML = [0, 1, 2, 3].map((i) =>
    `<span class="st${i === S.mySeat ? ' me' : ''}"><i>${esc(nameOf(i))}</i> <b>${tot[i]}</b></span>`).join('');
}
function toggleLogDrop(open) {
  const d = $('logDrop');
  const on = open ?? d.classList.contains('hidden');
  d.classList.toggle('hidden', !on);
  $('logToggle').textContent = on ? '▴' : '▾';
  if (on) { const l = $('logList'); l.scrollTop = l.scrollHeight; }
}
$('logBar').onclick = () => toggleLogDrop();
$('scoreBar').onclick = () => openModal('score');
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#hud')) toggleLogDrop(false); });

function totalsOf() {
  return [0, 1, 2, 3].map((i) => S.game.scores.reduce((a, h) => a + h[i], 0));
}
function scoreTable() {
  const g = S.game;
  const totals = totalsOf();
  let h = '<table class="sc"><tr><th>El</th>' + [0, 1, 2, 3].map((i) => `<th>${esc(nameOf(i))}${g.mode === 'team' ? `<br><small>Takım ${teamOf(i)}</small>` : ''}</th>`).join('') + '</tr>';
  g.scores.forEach((row, k) => { h += `<tr><td>${k + 1}</td>${row.map((v) => `<td>${v}</td>`).join('')}</tr>`; });
  h += `<tr class="tot"><td>Toplam</td>${totals.map((v) => `<td>${v}</td>`).join('')}</tr></table>`;
  if (g.mode === 'team') {
    h += `<p><b>Takım A</b> (${esc(nameOf(0))} & ${esc(nameOf(2))}): <b>${totals[0] + totals[2]}</b> &nbsp;·&nbsp; <b>Takım B</b> (${esc(nameOf(1))} & ${esc(nameOf(3))}): <b>${totals[1] + totals[3]}</b></p>`;
  }
  h += '<p class="muted">Ceza puanıdır: en düşük puan kazanır.</p>';
  return h;
}
// Oyun sonu: sıralama ve altın dağılımı
function standingsHtml() {
  const g = S.game;
  const st = g.standings;
  if (!st) return `<h2>Oyun bitti! ${winnerText()}</h2>`;
  const pay = S.money && S.money.payouts;
  const fee = S.money ? S.money.fee : 0;
  const money = (i) => (S.money ? `<td class="gold">${pay ? (pay[i] ? '+' + fmt(pay[i]) : '0') : ''} 🪙</td>` : '');
  let rows;
  if (st.team) {
    rows = [0, 1, 2, 3].map((i) => [i, st.tie ? 'Berabere' : st.winners.includes(i) ? '🏆 Kazanan takım' : 'Kaybeden takım']);
  } else {
    rows = [
      [st.first, '🥇 1.'],
      [st.second, '🥈 2.'],
      [st.finalWinner, '🏅 Finali kazandı'],
      [st.finalLoser, 'Finali kaybetti'],
    ];
  }
  let h = '<div class="standings"><h2>Oyun bitti!</h2><table class="sc">';
  const tot = totalsOf();
  h += `<tr><th>Sıra</th><th>Oyuncu</th><th>Toplam</th>${S.money ? '<th>Altın</th>' : ''}</tr>`;
  for (const [i, label] of rows) h += `<tr${i === S.mySeat ? ' class="mine"' : ''}><td>${label}</td><td>${esc(nameOf(i))}${i === S.mySeat ? ' (sen)' : ''}</td><td>${tot[i]}</td>${money(i)}</tr>`;
  h += '</table>';
  if (!st.team) h += `<p class="muted">Finali, final eli de yazıldıktan sonra toplamı düşük olan kazanır: ${esc(nameOf(st.finalWinner))} ${tot[st.finalWinner]} · ${esc(nameOf(st.finalLoser))} ${tot[st.finalLoser]}</p>`;
  h += S.money
    ? `<p class="muted">Masa ücreti ${fmt(fee)} · Yerde ${fmt(S.money.pot)} altın vardı. Altının şimdi: <b>${fmt(myGold)}</b> 🪙</p>`
    : '<p class="muted">Bilgisayara karşı oyun: ücretsiz, altın değişmez.</p>';
  return h + '</div>';
}

function winnerText() {
  const g = S.game;
  const totals = totalsOf();
  if (g.mode === 'team') {
    const a = totals[0] + totals[2];
    const b = totals[1] + totals[3];
    if (a === b) return 'Berabere!';
    const t = a < b ? 0 : 1;
    return `Kazanan: Takım ${teamOf(t)} (${esc(nameOf(t))} & ${esc(nameOf(t + 2))})`;
  }
  const min = Math.min(...totals);
  return 'Kazanan: ' + [0, 1, 2, 3].filter((i) => totals[i] === min).map((i) => esc(nameOf(i))).join(', ');
}

// ---------- El sonu: ceza açıklaması ----------
const lblOf = (c) => (c.joker ? '★' : SYM[c.s] + rl(c.r));
// El sonu hesabı adım adım: her satır { başlık, açıklama, değer, tür }
const fmtPts = (v) => (v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0');
function handSteps(res, i) {
  const d = res.detail && res.detail[i];
  const sm = res.suitMult;
  const how = res.pairs ? 'çiftten bitirdi' : 'okey atarak bitirdi';
  const wName = res.winner != null ? esc(nameOf(res.winner)) : '';
  const st = [];
  let note = '';
  const add = (label, calc, val, cls = '') => st.push({ label, calc, val, cls });
  if (!d && res.hands[i].length === 0) {
    add('Finalde oynamadı', 'Kazanmış sayılır, puan yazılmaz', '–');
    return { steps: st, total: null, note };
  }
  if (!d) {
    add('Deste bitti', 'El berabere bitti, el cezası yok', '0');
  } else {
    const byId = Object.fromEntries(res.hands[i].map((c) => [c.id, c]));
    const left = d.explain ? d.explain.left.map((id) => byId[id]).filter(Boolean) : [];
    const sumTxt = left.length ? left.map((c) => `${lblOf(c)}<i>${isWild(c, S.game.okey) ? 0 : cardVal(c)}</i>`).join(' + ') : 'yok';
    if (d.kind === 'winner') {
      if (res.special) add('Elini bitirdi', `${res.pairs ? 'Çiftten' : 'Okey atarak'} bitirdi: 100 × ${sm} (okey kat sayısı) düşülür`, fmtPts(-100 * sm), 'good');
      else add('Elini bitirdi', 'Eli ilk bitiren 100 puan düşer', '−100', 'good');
    } else if (d.kind === 'partner') {
      add('Eşi bitirdi', 'Eşi biten oyuncuya ceza yazılmaz', '0', 'good');
    } else {
      let v;
      if (d.kind === 'ready') {
        add('Bitmeye hazırdı ama bitiremedi', `Okeye dönmüş sayılır: 100 × ${sm} (okey kat sayısı)`, fmtPts(100 * sm), 'bad');
        v = 100 * sm;
      } else if (d.kind === 'noMeld') {
        add('Elinde hiç per yok', `Per açamayan 100 yazar: 100 × ${sm} (okey kat sayısı)`, fmtPts(100 * sm), 'bad');
        v = 100 * sm;
      } else if (d.kind === 'pairs') {
        add(`${d.pairs} çift var, çiftten yazılır`, `Boşta kalanlar: ${sumTxt} = <b>${d.base}</b>`, String(d.base));
        add('Okey kat sayısıyla çarpılır', `${d.base} × ${sm}`, String(d.base * sm));
        add('Çifte gittiği için iki katı', `${d.base * sm} × 2`, fmtPts(d.base * sm * 2), 'bad');
        v = d.base * sm * 2;
      } else {
        add('Boşta kalan kağıtlar toplanır', `${sumTxt} = <b>${d.base}</b>`, String(d.base));
        add('Okey kat sayısıyla çarpılır', `${d.base} × ${sm}`, fmtPts(d.base * sm), 'bad');
        if (d.declared) note = 'Açtığı perler sayılmaz; yalnızca elinde boşta kalan kağıtlar yazılır.';
        v = d.base * sm;
      }
      if (res.special) add(`${wName} ${how}`, `Herkesin cezası ikiye katlanır: ${v} × 2`, fmtPts(v * 2), 'bad');
    }
  }
  const op = res.okeyPts && res.okeyPts[i];
  if (op > 0) add('Yere okey attı', 'Okeyi yere atmanın cezası', fmtPts(op), 'bad');
  const sp = res.showPts && res.showPts[i];
  if (sp < 0) add('Göstergeyi gösterdi', 'Gösterge ödülü düşülür', fmtPts(sp), 'good');
  else if (sp > 0) add('Göstergesi yokken gösterdi', 'Hatalı gösterge cezası', fmtPts(sp), 'bad');
  return { steps: st, total: res.pts[i] || 0, note };
}
function stepsHtml(res, i) {
  const { steps, total, note } = handSteps(res, i);
  let h = '<div class="res-steps">';
  steps.forEach((s, k) => {
    h += `<div class="rs-row"><span class="rs-n">${k + 1}</span><div class="rs-l"><div class="rs-t">${s.label}</div><div class="rs-c">${s.calc}</div></div><div class="rs-v ${s.cls}">${s.val}</div></div>`;
  });
  if (total != null) h += `<div class="rs-total ${total < 0 ? 'good' : total > 0 ? 'bad' : ''}"><span>Bu elin puanı</span><b>${fmtPts(total)}</b></div>`;
  if (note) h += `<div class="rs-note">ℹ️ ${note}</div>`;
  return h + '</div>';
}
function renderGroups(el, res, i) {
  const d = res.detail && res.detail[i];
  const byId = Object.fromEntries(res.hands[i].map((c) => [c.id, c]));
  const mk = (ids, cls, label) => {
    const g = document.createElement('div');
    g.className = 'grp ' + cls;
    const row = document.createElement('div');
    row.className = 'grp-cards';
    ids.forEach((id) => {
      const c = byId[id];
      if (!c) return;
      if (cls !== 'left') { row.appendChild(cardEl(c)); return; }
      // boştaki her kağıdın altında kaç puan yazdığı
      const w = document.createElement('div');
      w.className = 'cv';
      w.appendChild(cardEl(c));
      w.insertAdjacentHTML('beforeend', `<span class="cvv">${isWild(c, S.game.okey) ? 0 : cardVal(c)}</span>`);
      row.appendChild(w);
    });
    g.appendChild(row);
    g.insertAdjacentHTML('beforeend', `<span>${label}</span>`);
    el.appendChild(g);
  };
  if (!res.hands[i].length) { el.innerHTML = '<span class="muted">🏆 Finalde oynamadı</span>'; return; }
  if (!d || !d.explain) { mk(res.hands[i].map((c) => c.id), 'left', 'El'); return; }
  d.explain.melds.forEach((m) => mk(m, 'meld', 'Per ✓ sayılmaz'));
  const shId = S.game.shown && S.game.shown.seat === i ? S.game.shown.card.id : null;
  d.explain.pairs.forEach((p) => mk(p, 'pair', shId && p.includes(shId) ? 'Çift (gösterge)' : 'Çift'));
  if (d.explain.left.length) {
    const sum = d.explain.left.reduce((a, id) => { const c = byId[id]; return a + (isWild(c, S.game.okey) ? 0 : cardVal(c)); }, 0);
    mk(d.explain.left, 'left', d.kind === 'noMeld' || d.kind === 'ready' ? 'Boşta kalanlar' : `Boşta kalanlar · toplam ${sum}`);
  }
}
function cardVal(c) {
  const r = c.joker ? S.game.okey.r : c.r;
  return r === 14 ? 11 : r >= 10 ? 10 : r;
}
// "Oyuna devam et" geri sayımı (sunucu saatine göre)
let nextClicked = null;
let clockOffset = 0;
socket.on('state', (st) => { if (st.next) clockOffset = st.next.now - Date.now(); });
function updateCountdown() {
  const btn = $('mNext');
  if (!btn || !S || !S.game || S.game.status !== 'handOver' || !S.next) return;
  const left = Math.max(0, Math.ceil((S.next.deadline - (Date.now() + clockOffset)) / 1000));
  const iReady = nextClicked === S.game.handNo || S.next.ready.includes(S.mySeat);
  if (iReady) {
    const waiting = S.seats.map((p, i) => (p && !p.bot && p.connected && !S.next.ready.includes(i) ? nameOf(i) : null)).filter(Boolean);
    btn.disabled = true;
    btn.textContent = waiting.length ? `Bekleniyor: ${waiting.join(', ')} (${left})` : 'Başlıyor…';
  } else {
    btn.disabled = false;
    btn.textContent = `Oyuna devam et (${left})`;
    if (left !== updateCountdown.last && left <= 5 && left > 0) FX.play('tick');
    updateCountdown.last = left;
    if (left <= 0) { nextClicked = S.game.handNo; emit('next', {}); }
  }
}
setInterval(updateCountdown, 250);

function openModal(kind, arg) {
  modalKind = kind;
  modalArg = arg;
  const body = $('modalBody');
  const g = S.game;
  body.innerHTML = '';
  body.classList.remove('wide');
  if (kind === 'score') {
    body.innerHTML = `<h2>Puan tablosu</h2>${scoreTable()}<div class="mbtns"><button id="mClose">Kapat</button></div>`;
  } else if (kind === 'result') {
    const res = g.result;
    if (!res) return closeModal();
    const title = res.winner == null ? 'Deste bitti, el berabere' : `${esc(nameOf(res.winner))} bitti!`;
    const sm = res.suitMult;
    const over = g.status === 'gameOver';
    const me = S.mySeat;
    const totals = [0, 1, 2, 3].map((k) => g.scores.reduce((a, row) => a + (row[k] || 0), 0));
    const sub = res.winner == null ? 'Kimse bitiremeden deste bitti.' : res.special ? `${res.pairs ? 'Çiftten' : 'Okey atarak'} bitirdi — herkesin cezası iki katına çıkar.` : 'Elini bitirdi. Diğerleri ellerinde kalan kağıtlara göre ceza yazar.';
    // masadaki oturma düzeni: sen altta, karşındaki üstte, sağ ve sol yanlarda
    const POS = ['bottom', 'right', 'top', 'left'];
    const seatAt = {};
    for (let i = 0; i < 4; i++) seatAt[POS[(i - me + 4) % 4]] = i;
    const seatBox = (pos) => {
      const i = seatAt[pos];
      const p = res.pts[i] || 0;
      const won = i === res.winner;
      const verdict = won ? '🏆 Bitirdi' : p > 0 ? 'Ceza yedi' : p < 0 ? 'Puan düştü' : 'Ceza yok';
      return `<section class="rs-seat ${pos} ${p < 0 ? 'good' : p > 0 ? 'bad' : ''} ${i === me ? 'me' : ''}">
        <header class="rs-sh">
          <div class="rs-who"><span class="rs-name">${esc(nameOf(i))}${i === me ? ' <small>(sen)</small>' : ''}</span><span class="rs-ver">${verdict}</span></div>
          <div class="rs-big"><b>${fmtPts(p)}</b><small>Toplam ${totals[i]}</small></div>
        </header>
        <div class="rs-lbl">Elinde kalanlar</div>
        <div class="why-groups mid" data-i="${i}"></div>
        ${stepsHtml(res, i)}
      </section>`;
    };
    let h = '<div class="res-table">';
    h += seatBox('top') + seatBox('left') + seatBox('right');
    h += `<div class="rs-center"><h2>${title}</h2><div class="res-sub">${sub}</div>`;
    if (g.okey) h += `<div class="res-okey"><span class="ro-card" style="color:${g.okey.s === 'H' || g.okey.s === 'D' ? '#b3261e' : '#1d1d1d'}">${SYM[g.okey.s]}${rl(g.okey.r)}</span><span>Okey <b>${SYM[g.okey.s]}${rl(g.okey.r)}</b>. Okey rengi ${SYM[res.okeySuit]} olduğu için cezalar <b>×${sm}</b> yazılır.</span></div>`;
    h += `<div class="mbtns"><button id="mHide">Masaya bak</button><button id="mNext" class="primary">${over ? 'Lobiye dön' : 'Oyuna devam et'}</button></div></div>`;
    h += seatBox('bottom') + '</div>';
    if (over) h += standingsHtml();
    h += `<details><summary>Tüm ellerin puan tablosu</summary>${scoreTable()}</details>`;
    body.innerHTML = h;
    body.classList.add('wide');
    body.querySelectorAll('.why-groups').forEach((el) => renderGroups(el, res, +el.dataset.i));
    $('mNext').onclick = () => {
      if (over) return emit('next', {});
      emit('next', {});
      nextClicked = g.handNo;
      updateCountdown();
    };
    $('mHide').onclick = () => { resultHidden = true; closeModal(); };
    updateCountdown();
  }
  const close = $('mClose');
  if (close) close.onclick = closeModal;
  $('modal').classList.remove('hidden');
}

// ---------- Rakip bitti: 30 sn el açma süresi ----------
let settleClicked = null;
const settleLeft = (g) => Math.max(0, Math.ceil((g.settle.deadline - (Date.now() + (g.settle.now ? settleSkew : 0))) / 1000));
let settleSkew = 0;
socket.on('state', (st) => { if (st.game && st.game.settle) settleSkew = st.game.settle.now - Date.now(); });
function settleText(g) {
  const st = g.settle;
  const w = st.winner === S.mySeat ? 'Sen bitirdin' : `${nameOf(st.winner)} bitirdi`;
  const how = st.pairs ? ' (çiftten)' : st.okeyDiscard ? ' (okey atarak)' : '';
  if (st.need.includes(S.mySeat) && !st.confirmed.includes(S.mySeat)) return `${w}${how}! Elini son kez düzenle: perlerini ve çiftlerini yan yana diz ya da yukarı taşı.`;
  const waiting = st.need.filter((i) => !st.confirmed.includes(i)).map(nameOf);
  return `${w}${how}! ${waiting.length ? `Ellerini açıyorlar: ${waiting.join(', ')}` : 'Cezalar yazılıyor…'}`;
}
function renderSettleBar() {
  let bar = $('settleBar');
  const g = S && S.game;
  if (!g || g.status !== 'settle') { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'settleBar';
    $('game').appendChild(bar);
  }
  const st = g.settle;
  const mine = st.need.includes(S.mySeat);
  const done = st.confirmed.includes(S.mySeat) || settleClicked === g.handNo;
  const left = settleLeft(g);
  bar.className = mine && !done ? 'mine' : '';
  bar.innerHTML = `<div class="sb-text">${esc(settleText(g))}<small>${mine && !done ? 'Ceza, dizdiğin perlere ve çiftlere göre yazılır. Bir gruba koymadığın kağıt boşta sayılır.' : ''}</small></div>
    ${mine && !done ? `<button id="btnConfirmHand" class="primary">✔ Elimi açtım <b>${left}</b></button>` : `<div class="sb-wait">⏳ ${left}</div>`}`;
  const b = $('btnConfirmHand');
  if (b) b.onclick = () => {
    settleClicked = g.handNo;
    flushArrangement(); // son dizilişi önce gönder
    emit('confirmHand', {});
    renderSettleBar();
  };
}
setInterval(() => {
  const g = S && S.game;
  if (!g || g.status !== 'settle') return;
  const left = settleLeft(g);
  const b = $('btnConfirmHand');
  if (b) { const n = b.querySelector('b'); if (n && n.textContent !== String(left)) { n.textContent = left; if (left <= 5 && left > 0) FX.play('tick'); } }
  const w = document.querySelector('#settleBar .sb-wait');
  if (w) w.textContent = `⏳ ${left}`;
  if (left <= 0 && b) flushArrangement(); // süre doldu: son diziliş gitsin
}, 250);

// ---------- Animasyonlar: iki durum arasındaki farktan hareketleri çıkar ----------
let lastDrop = null;   // sürükleyip attığım kağıdın bırakıldığı yer
let resultAt = 0;      // sonuç penceresi ne zaman açılsın (kutlamadan sonra)
const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const cardBox = (c, w) => ({ left: c.x - w / 2, top: c.y - w * 0.7, width: w, height: w * 1.4 });
const relOf = (seat) => (seat - S.mySeat + 4) % 4;
function seatRect(seat) {
  // rakiplerin kapalı elleri gösterilmiyor: kağıtlar oyuncunun portresine gider / portresinden çıkar
  const av = document.querySelector('#pl-' + PL[relOf(seat)] + ' .pav');
  if (!av) return null;
  return cardBox(centerOf(av.getBoundingClientRect()), 34);
}
function snapRects() {
  if (!S || !S.game || $('game').classList.contains('hidden')) return null;
  const r = { my: new Map() };
  handEls.forEach((el, id) => r.my.set(id, el.getBoundingClientRect()));
  const dk = $('deck').querySelector('.card:last-child');
  r.deck = dk && dk.getBoundingClientRect();
  const last = $('spread').querySelector('.card.last');
  r.spreadLast = upright(last);
  r.fans = {};
  document.querySelectorAll('.ofan').forEach((f) => { r.fans[+f.dataset.seat] = [...f.children].map((c) => c.getBoundingClientRect()); });
  return r;
}
function flyToSeat(seat, fromRect, card, startFace, backColor) {
  if (seat < 0 || !fromRect) return;
  if (seat === S.mySeat && card) {
    const el = handEls.get(card.id);
    const to = el && el.getBoundingClientRect();
    if (el) el.style.visibility = 'hidden';
    FX.fly({
      from: fromRect, to, front: cardEl(card), back: backEl(card.b), startFace, endFace: 'front',
      duration: 600, arc: 110, sound: 'slide',
      onLand: () => { if (el) el.style.visibility = ''; FX.play(startFace === 'back' ? 'flip' : 'place'); },
    });
  } else {
    // 3B karakter varsa: eliyle uzanıp alır, kağıt elle birlikte gelir
    if (carry(seat, { mode: 'take', card, backColor, point: centerOf(fromRect), fromRect, faceUp: startFace === 'front' })) return;
    // kağıdı elinde koyduğu yere uçur (ayna sırası)
    const info = S.game.backs && S.game.backs[seat];
    const fan = document.querySelector(`.ofan[data-seat="${seat}"]`);
    let slot = null;
    void info; void fan; // kapalı el gösterilmiyor: hedef portre
    const to = slot ? slot.getBoundingClientRect() : seatRect(seat);
    if (slot) slot.style.visibility = 'hidden';
    FX.fly({
      from: fromRect, to, front: card ? cardEl(card) : null, back: backEl(card ? card.b : backColor),
      startFace, endFace: 'back', duration: 560, arc: 60, sound: 'slide',
      onLand: () => { if (slot) slot.style.visibility = ''; FX.play('place'); },
    });
  }
}
// Rakip kağıdı eliyle taşır: el masaya uzanır, kağıt elle birlikte gider, bırakılır, el geri çekilir.
// mode 'put': elden yere (kapalı gider, bırakırken açılır). mode 'take': desteden/yerden ele.
const CARRY_MS = 1250;
function carry(seat, { mode, card, backColor, point, fromRect, faceUp, endRotate = 0, onDone }) {
  const slot = PL[relOf(seat)];
  if (!Stage3D.available || !slot || !Stage3D.anchor(slot, 'hand') || !point) return false;
  Stage3D.act(slot, point, CARRY_MS);
  const w = pw;
  const el = document.createElement('div');
  el.className = 'carry-card';
  const back = backEl(backColor || (card && card.b) || 'blue');
  const front = card ? cardEl(card) : null;
  [back, front].forEach((c) => { if (c) { c.style.setProperty('--cw', w + 'px'); el.appendChild(c); } });
  const setFace = (up) => { back.style.display = up && front ? 'none' : ''; if (front) front.style.display = up ? '' : 'none'; };
  el.style.width = w + 'px';
  el.style.height = w * 1.4 + 'px';
  document.body.appendChild(el);
  const t0 = performance.now();
  const lerp = (a, b, u) => a + (b - a) * u;
  let held = null; // el ile kağıt arasındaki son nokta
  const place = (x, y, sc, rot, flipY) => {
    el.style.transform = `translate(${x - w / 2}px, ${y - w * 0.7}px) scale(${sc}) rotate(${rot}deg)` + (flipY != null ? ` scaleX(${flipY})` : '');
  };
  const SMALL = 0.5; // eldeyken kağıt küçük görünür (uzakta)
  const step = (now) => {
    const p = (now - t0) / CARRY_MS;
    const h = Stage3D.anchor(slot, 'hand');
    if (!h) { el.remove(); onDone && onDone(); return; }
    if (mode === 'put') {
      if (p < 0.42) { // elde, masaya taşınıyor
        setFace(false);
        place(h.x, h.y, lerp(SMALL, 0.85, p / 0.42), 0);
        held = h;
      } else if (p < 0.56) { // bırakılıyor: elden yığına süzülür, yarıda açılır
        const u = (p - 0.42) / 0.14;
        const e = u * u * (3 - 2 * u);
        setFace(u > 0.5 ? true : false);
        place(lerp(held.x, point.x, e), lerp(held.y, point.y, e), lerp(0.85, 1, e), endRotate * e, Math.abs(Math.cos(u * Math.PI)) * 0.9 + 0.1);
      } else { el.remove(); onDone && onDone(); return; }
    } else { // take
      if (p < 0.42) { // el uzanıyor; kağıt yerinde bekler (desteden çekişte görünmez)
        setFace(faceUp);
        el.style.visibility = fromRect && faceUp ? '' : 'hidden';
        place(point.x, point.y, 1, endRotate);
      } else if (p < 0.55) { // kavrandı: ele doğru kalkar
        const u = (p - 0.42) / 0.13;
        el.style.visibility = '';
        place(lerp(point.x, h.x, u), lerp(point.y, h.y, u), lerp(1, 0.85, u), endRotate * (1 - u));
      } else if (p < 0.97) { // elle birlikte geri gelir, küçülür
        const u = (p - 0.55) / 0.42;
        place(h.x, h.y, lerp(0.85, SMALL * 0.7, u), 0);
        el.style.opacity = u > 0.8 ? String(1 - (u - 0.8) / 0.2) : '';
      } else { el.remove(); onDone && onDone(); return; }
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return true;
}
function animateDiff(prev, cur, rects) {
  const g = cur.game;
  const pg = prev && prev.game;
  if (!g || $('game').classList.contains('hidden')) return;
  if (!pg || prev.code !== cur.code || pg.handNo !== g.handNo) {
    if (g.status === 'playing' && g.pile.length === 0) dealAnim();
    return;
  }
  if (!rects) return;
  const delta = g.handCounts.map((c, i) => c - pg.handCounts[i]);
  const dPile = g.pile.length - pg.pile.length;
  // Kağıt atıldı: atanın elinden ortaya uçar (rakibinki kapalı çıkar, havada açılır)
  if (dPile === 1) {
    const top = g.pile[g.pile.length - 1];
    const src = delta.findIndex((d) => d < 0);
    const seat = src >= 0 ? src : top.by;
    const dest = $('spread').querySelector('.card.last');
    const to = upright(dest);
    let from;
    let startFace = 'front';
    if (seat === S.mySeat) {
      from = lastDrop && lastDrop.id === top.id && Date.now() - lastDrop.t < 3000 && lastDrop.rect ? lastDrop.rect : rects.my.get(top.id);
    } else {
      // rakip kağıdı elinde durduğu yerden çeker (ayna sırası)
      const info = g.backs && g.backs[seat];
      const old = rects.fans && rects.fans[seat];
      void info; void old; // kapalı el gösterilmiyor: kağıt portreden çıkar
      if (!from) from = seatRect(seat);
      startFace = 'back';
    }
    if (dest) dest.style.visibility = 'hidden';
    const endRot = dest ? Number(dest.dataset.rot) || 0 : 0;
    const carried = seat !== S.mySeat && to && carry(seat, {
      mode: 'put', card: top, point: centerOf(to), endRotate: endRot,
      onDone: () => { if (dest) dest.style.visibility = ''; FX.play('place'); },
    });
    if (carried) FX.play('slide');
    else FX.fly({
      from, to, front: cardEl(top), back: backEl(top.b), startFace, endFace: 'front',
      duration: 560, arc: 80, endRotate: dest ? Number(dest.dataset.rot) || 0 : 0, sound: 'slide',
      onLand: () => { if (dest) dest.style.visibility = ''; FX.play('place'); },
    });
    lastDrop = null;
  }
  // Yerden alındı: ortadan alanın eline
  if (dPile === -1) {
    const taker = delta.findIndex((d) => d > 0);
    flyToSeat(taker, rects.spreadLast, pg.pile[pg.pile.length - 1], 'front');
    FX.play('pick');
  }
  // Desteden çekildi: kapalı çıkar, benimse havada açılır
  if (g.deckCount < pg.deckCount && dPile !== -1) {
    const drawer = delta.findIndex((d) => d > 0);
    const card = drawer === S.mySeat ? g.myHand.find((c) => !pg.myHand.some((x) => x.id === c.id)) : null;
    flyToSeat(drawer, rects.deck, card, 'back', pg.deckTop || 'blue');
  }
  // Sıra bana geldi
  if (g.status === 'playing' && g.turn === S.mySeat && pg.turn !== S.mySeat) setTimeout(() => FX.play('turn'), 450);
  // El bitti: kutlama
  // Biri bitti (el açma süresi başladı ya da direkt yazıldı): kutlama
  if (pg.status === 'playing' && g.status !== 'playing') finishAnim(g);
  // Cezalar yazıldı: ceza sarsıntısı, altın yağmuru
  if ((pg.status === 'playing' || pg.status === 'settle') && (g.status === 'handOver' || g.status === 'gameOver')) scoredAnim(g);
}
function dealAnim() {
  const g = S.game;
  const deck = $('deck').querySelector('.card:last-child');
  if (!deck) return;
  const from = deck.getBoundingClientRect();
  FX.play('shuffle');
  const ind = $('indicator').querySelector('.card');
  if (ind) ind.style.visibility = 'hidden';
  const mine = [...hand.order, ...backIds()];
  const myCards = Object.fromEntries(g.myHand.map((c) => [c.id, c]));
  mine.forEach((id) => { const el = handEls.get(id); if (el) el.style.visibility = 'hidden'; });
  const seats = g.active || [0, 1, 2, 3];
  const rounds = Math.max(...seats.map((s) => g.handCounts[s]));
  const base = 850;
  const step = 45;
  let k = 0;
  let myIdx = 0;
  for (let r = 0; r < rounds; r++) {
    for (const s of seats) {
      if (r >= g.handCounts[s]) continue;
      const delay = base + k * step;
      if (s === S.mySeat) {
        const id = mine[myIdx++];
        const el = handEls.get(id);
        const card = myCards[id];
        if (el && card) {
          FX.fly({
            from, to: el.getBoundingClientRect(), front: cardEl(card), back: backEl(card.b),
            startFace: 'back', endFace: 'front', duration: 460, delay, arc: 50, sound: 'deal',
            onLand: () => { el.style.visibility = ''; },
          });
        }
      } else if (r % 2 === 0) {
        FX.fly({ from, to: seatRect(s), back: backEl(r % 3 ? 'blue' : 'red'), startFace: 'back', endFace: 'back', duration: 400, delay, arc: 35, sound: 'deal' });
      }
      k++;
    }
  }
  const tEnd = base + k * step + 450;
  setTimeout(() => {
    if (ind) { ind.style.visibility = ''; ind.classList.remove('flip-in'); void ind.offsetWidth; ind.classList.add('flip-in'); FX.play('flip'); }
    handEls.forEach((el) => (el.style.visibility = '')); // güvenlik: hepsi görünsün
  }, tEnd);
}
function finishAnim(g) {
  const res = g.result || g.settle; // el açma süresindeyse sonuç henüz yazılmadı
  if (!res) return;
  if (res.winner == null) { FX.play('lose'); return; }
  const me = res.winner === S.mySeat;
  setTimeout(() => {
    FX.confetti(innerWidth / 2, innerHeight * 0.42, me ? 260 : 140, me ? 18 : 12);
    FX.play(me ? 'win' : 'chime');
    if (me) FX.banner(res.pairs ? 'ÇİFTTEN BİTTİN!' : res.okeyDiscard ? 'OKEY ATIP BİTTİN!' : 'BİTTİN!', 'gold');
    else FX.banner(`${nameOf(res.winner)} BİTTİ!`);
  }, 500);
}
function scoredAnim(g) {
  const res = g.result;
  if (!res) return;
  if (res.winner !== S.mySeat && res.pts[S.mySeat] >= 200) setTimeout(() => { FX.shake($('game')); FX.play('penalty'); }, 600);
  if (g.status === 'gameOver' && S.money && S.money.payouts && S.money.payouts[S.mySeat] > 0) setTimeout(() => FX.coinRain(90), 1200);
}

// Ses aç/kapat + her düğmede tık sesi
const muteBtn = $('btnMute');
const paintMute = () => { muteBtn.textContent = FX.isMuted() ? '🔇' : '🔊'; muteBtn.title = FX.isMuted() ? 'Sesi aç' : 'Sesi kapat'; };
muteBtn.onclick = (e) => { e.stopPropagation(); FX.setMuted(!FX.isMuted()); paintMute(); FX.play('click'); };
paintMute();
document.addEventListener('click', (e) => { if (e.target.closest('button') && e.target.closest('button') !== muteBtn) FX.play('click'); }, true);

// ---------- Ana çizim ----------
if (!session) show('home');

function render() {
  if (!S) { if (modalKind !== 'daily') closeModal(); show('home'); showDailyWhenFree(); return; }
  if (!S.game) { if (modalKind !== 'daily') closeModal(); hand.key = null; renderLobby(); showDailyWhenFree(); return; }
  renderGame();
}

// ---------- Günlük hediye ----------
let daily = null;
function showDailyWhenFree() {
  // Oyun sürerken araya girmesin; giriş ekranında ya da lobide gösterilir
  if (!daily || !daily.available || modalKind) return;
  if (S && S.game) return;
  openDaily();
}
function openDaily() {
  if (!daily) return toast('Bağlanılıyor…');
  modalKind = 'daily';
  const d = daily;
  const cur = d.available ? d.day : d.streak; // kaçıncı gündesin
  const pos = Math.min(cur, 7);
  let tiles = '';
  for (let i = 1; i <= 7; i++) {
    let cls = 'next';
    if (i < pos) cls = 'got';
    else if (i === pos) cls = d.available ? 'today' : 'got';
    const label = i === 7 ? '7+. gün' : `${i}. gün`;
    tiles += `<div class="dtile ${cls}"><div class="dday">${label}</div><div class="dcoin">🪙</div><div class="damt">${fmt(d.table[i - 1])}</div>${cls === 'got' ? '<div class="dcheck">✓</div>' : ''}</div>`;
  }
  const streakTxt = cur > 7 ? `<p class="dstreak">🔥 ${cur} gündür aralıksız giriyorsun!</p>` : '';
  const btn = d.available
    ? `<button id="dClaim" class="primary big">Topla +${fmt(d.amount)} 🪙</button>`
    : `<button id="dClose" class="big">Kapat</button>`;
  $('modalBody').innerHTML = `<div class="daily">
      <h2>🎁 Günlük hediye</h2>
      <p class="muted">Her gün gir, hediyen büyüsün. Bir gün girmezsen seri bozulur, 1. günden başlar.</p>
      <div class="dtiles">${tiles}</div>
      ${streakTxt}
      ${d.available ? `<p class="dtoday">Bugün <b>${cur}. gün</b>: <b>${fmt(d.amount)}</b> altın seni bekliyor!</p>`
        : `<p class="dtoday">Bugünün hediyesini aldın. Yarın gel: <b>+${fmt(d.nextAmount)}</b> altın.</p>`}
      <div class="mbtns dbtns">${btn}</div>
    </div>`;
  $('modal').classList.remove('hidden');
  const claim = $('dClaim');
  if (claim) claim.onclick = () => {
    claim.disabled = true;
    emit('claimDaily', {}, (res) => {
      setGold(res.gold);
      daily = res.daily;
      toast(`+${fmt(res.amount)} altın aldın! 🎉`);
      FX.coinRain(40);
      $('myGold').classList.add('pulse');
      setTimeout(() => $('myGold').classList.remove('pulse'), 1200);
      openDaily();
    });
  };
  const close = $('dClose');
  if (close) close.onclick = closeModal;
}
$('btnDaily').onclick = openDaily;
$('btnAvatar').onclick = openAvatarPicker;
