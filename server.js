'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Game } = require('./game');
const { botAct } = require('./bot');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
const newCode = () => {
  let c;
  do c = Array.from({ length: 5 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
  while (rooms.has(c));
  return c;
};
const newToken = () => crypto.randomBytes(16).toString('hex');
const cleanName = (n) => String(n || '').trim().slice(0, 16) || 'Oyuncu';
const HAND_OPTIONS = [3, 5, 7, 9, 11];

// ---------- Sanal altın: oyuncu profilleri (data/players.json) ----------
const START_GOLD = 1000;
const MIN_FEE = 250;
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
let players = {};
try { players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')); } catch { players = {}; }
let saveTimer = null;
function savePlayers() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 1));
  }, 300);
}
// ---------- Günlük hediye (Türkiye saatine göre gün) ----------
// 1. gün 1.000 · 2-3. gün 1.250 · 4-5. gün 1.500 · 6. gün 1.750 · 7. günden itibaren her gün 2.000
// Bir gün girilmezse seri sıfırlanır, 1. günden başlar. İlk girişteki 1.000 altın 1. günün hediyesidir.
const DAILY = [1000, 1250, 1250, 1500, 1500, 1750, 2000];
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (offsetDays = 0) => dayFmt.format(new Date(Date.now() + offsetDays * 86400000));
function dailyInfo(p) {
  const today = dayKey();
  if (p.lastDaily === today) {
    const next = (p.streak || 1) + 1;
    return { available: false, streak: p.streak || 1, nextDay: next, nextAmount: DAILY[Math.min(next, 7) - 1], table: DAILY };
  }
  const day = p.lastDaily === dayKey(-1) ? (p.streak || 0) + 1 : 1;
  return { available: true, day, amount: DAILY[Math.min(day, 7) - 1], streak: p.streak || 0, table: DAILY };
}
function claimDaily(p) {
  const d = dailyInfo(p);
  if (!d.available) throw new Error('Bugünün hediyesini zaten aldın.');
  p.gold += d.amount;
  p.streak = d.day;
  p.lastDaily = dayKey();
  savePlayers();
  return d;
}

// Oyuncu kimliği yoksa yeni profil aç (ilk girişte 1. günün hediyesi: 1.000 altın)
function ensureProfile(pid, name) {
  if (typeof pid !== 'string' || !/^[a-f0-9]{32}$/.test(pid)) pid = newToken();
  if (!players[pid]) players[pid] = { name: cleanName(name), gold: 0, created: Date.now(), streak: 0, lastDaily: null };
  else if (name) players[pid].name = cleanName(name);
  const p = players[pid];
  // Günlük hediyeden önce açılmış eski profiller: bugün açıldıysa 1. günü almış say
  if (p.lastDaily === undefined) {
    const createdDay = dayFmt.format(new Date(p.created || Date.now()));
    p.lastDaily = createdDay;
    p.streak = 1;
  }
  savePlayers();
  return pid;
}
const goldOf = (pid) => (players[pid] ? players[pid].gold : 0);
const cleanFee = (f) => Math.floor(Number(f) || 0);

// Oyun bitince yerdeki parayı dağıt (sadece 4 gerçek oyunculu online masa)
//  1.: yarısı (2 x ücret) · 2.: ücreti geri · finali kazanan: ücreti geri · finali kaybeden: 0
function settle(room) {
  const m = room.money;
  const g = room.game;
  if (!m || m.settled || !g || g.status !== 'gameOver' || !g.standings) return;
  const st = g.standings;
  const pay = [0, 0, 0, 0];
  if (st.team) {
    if (st.tie) pay.fill(m.fee);
    else st.winners.forEach((i) => (pay[i] = 2 * m.fee));
  } else {
    pay[st.first] = 2 * m.fee;
    pay[st.second] = m.fee;
    pay[st.finalWinner] = m.fee;
  }
  room.seats.forEach((p, i) => { if (p && p.pid && players[p.pid]) players[p.pid].gold += pay[i]; });
  m.payouts = pay;
  m.settled = true;
  savePlayers();
}

function seatOf(room, token) {
  return room.seats.findIndex((p) => p && p.token === token);
}

// Her el sonunu kayda al (itiraz olursa el kağıt kağıt incelenebilsin): data/hands.jsonl
const HANDS_FILE = path.join(DATA_DIR, 'hands.jsonl');
function logHand(room) {
  const g = room.game;
  if (!g || g.status === 'playing' || !g.result) return;
  const key = `${room.code}-${g.handNo}`;
  if (room.loggedHand === key) return;
  room.loggedHand = key;
  const lbl = (c) => (c.joker ? 'SAHTE' : `${c.s}${c.r}`) + (c.b === 'red' ? 'k' : 'm');
  const r = g.result;
  const rec = {
    t: new Date().toISOString(), room: room.code, hand: g.handNo, names: g.names,
    indicator: lbl(g.indicator), okey: `${g.okey.s}${g.okey.r}`,
    winner: r.winner, pairs: r.pairs, okeyDiscard: r.okeyDiscard,
    hands: r.hands.map((h) => h.map(lbl)),
    detail: r.detail.map((d) => d && { kind: d.kind, base: d.base, pairs: d.pairs }),
    showPts: r.showPts, okeyPts: r.okeyPts, pts: r.pts,
  };
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(HANDS_FILE, JSON.stringify(rec) + '\n'); } catch (e) { console.error('el kaydı', e); }
}

// El açma süresi (30 sn) dolunca ceza yazılır
function scheduleSettle(room) {
  const g = room.game;
  if (!g || g.status !== 'settle') { clearTimeout(room.settleTimer); room.settleTimer = null; return; }
  if (room.settleTimer) return;
  room.settleTimer = setTimeout(() => {
    room.settleTimer = null;
    if (room.game === g && g.status === 'settle') { g.finishSettle(); broadcast(room); }
  }, Math.max(0, g.settle.deadline - Date.now()) + 300);
}
// Oyunu kurarken kim gerçek oyuncu (bitince elini açmak için beklenir)
const newGame = (room) => {
  const g = new Game({ ...room.settings, names: room.seats.map((p) => p.name) });
  g.humans = room.seats.map((p) => !!p && !p.bot);
  return g;
};

function broadcast(room) {
  settle(room);
  scheduleSettle(room);
  logHand(room);
  room.seats.forEach((p, seat) => {
    if (!p || !p.socketId) return;
    io.to(p.socketId).emit('state', {
      code: room.code,
      mySeat: seat,
      isHost: p.token === room.hostToken,
      settings: room.settings,
      seats: room.seats.map((s) => s && { name: s.name, bot: !!s.bot, connected: !!(s.socketId || s.bot), host: s.token === room.hostToken, gold: s.pid ? goldOf(s.pid) : null }),
      myGold: p.pid ? goldOf(p.pid) : null,
      money: room.money ? { fee: room.money.fee, pot: room.money.pot, payouts: room.money.payouts || null } : null,
      game: room.game ? room.game.view(seat) : null,
      next: room.game && room.game.status === 'handOver' && room.next
        ? { deadline: room.next.deadline, ready: [...room.next.ready], now: Date.now() }
        : null,
    });
  });
  scheduleBot(room);
  scheduleNext(room);
}

// El bitince: herkes "Devam et"e basınca ya da 10 sn dolunca sonraki el başlar
const NEXT_SECONDS = 10;
function scheduleNext(room) {
  const g = room.game;
  if (!g || g.status !== 'handOver' || room.next) return;
  const ready = new Set(room.seats.map((p, i) => (p && p.bot ? i : -1)).filter((i) => i >= 0));
  room.next = { deadline: Date.now() + NEXT_SECONDS * 1000, ready, game: g, hand: g.handNo };
  room.next.timer = setTimeout(() => advanceHand(room), NEXT_SECONDS * 1000 + 1500); // istemci gelmezse yedek
  broadcast(room);
}
function advanceHand(room) {
  const n = room.next;
  if (!n) return;
  clearTimeout(n.timer);
  room.next = null;
  if (room.game !== n.game || room.game.status !== 'handOver' || room.game.handNo !== n.hand) return;
  room.game.nextHand();
  broadcast(room);
}

// Sıra bilgisayardaysa kısa bir beklemeden sonra hamlesini yap
function scheduleBot(room) {
  const g = room.game;
  if (!g || g.status !== 'playing' || room.botTimer) return;
  const p = room.seats[g.turn];
  if (!p || !p.bot) return;
  // duyuru penceresi açıksa (1 sn) bot da bekler
  const frozenFor = Math.max(0, g.freezeUntil - Date.now());
  const delay = frozenFor + (g.phase === 'draw' ? 700 + crypto.randomInt(500) : 900 + crypto.randomInt(700));
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.game !== g || g.status !== 'playing' || !room.seats[g.turn] || !room.seats[g.turn].bot) return;
    if (g.frozen()) { scheduleBot(room); return; }
    try { botAct(g, g.turn); } catch (e) { console.error('bot hatası', e); setTimeout(() => scheduleBot(room), 500); return; }
    broadcast(room);
  }, delay);
}

const BOT_NAMES = ['Ayşe', 'Mehmet', 'Zeynep', 'Kemal', 'Elif', 'Murat'];
function addBot(room, seat) {
  const used = new Set(room.seats.filter(Boolean).map((p) => p.name));
  room.seats[seat] = { token: newToken(), name: BOT_NAMES.find((n) => !used.has(n)) || 'Bilgisayar', bot: true };
}

function ensureHost(room) {
  if (room.seats.some((p) => p && !p.bot && p.token === room.hostToken)) return;
  const next = room.seats.find((p) => p && !p.bot && p.socketId) || room.seats.find((p) => p && !p.bot);
  if (next) room.hostToken = next.token;
}
const hasHumans = (room) => room.seats.some((p) => p && !p.bot);

function scheduleCleanup(room) {
  clearTimeout(room.cleanup);
  if (room.seats.some((p) => p && p.socketId)) return;
  room.cleanup = setTimeout(() => rooms.delete(room.code), 30 * 60 * 1000);
}

function attach(socket, room, seat) {
  const p = room.seats[seat];
  p.socketId = socket.id;
  clearTimeout(p.leaveTimer);
  clearTimeout(room.cleanup);
  socket.data.code = room.code;
  socket.data.token = p.token;
  socket.join(room.code);
}

io.on('connection', (socket) => {
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    if (!room) throw new Error('Oda bulunamadı.');
    const seat = seatOf(room, socket.data.token);
    if (seat < 0) throw new Error('Bu odada değilsiniz.');
    return { room, seat };
  };
  const handle = (ev, fn) =>
    socket.on(ev, (data = {}, ack = () => {}) => {
      try {
        const res = fn(data || {});
        ack({ ok: true, ...(res || {}) });
      } catch (e) {
        ack({ ok: false, error: e.message });
      }
    });

  handle('hello', ({ pid, name }) => {
    pid = ensureProfile(pid, name);
    socket.data.pid = pid;
    return { pid, gold: goldOf(pid), daily: dailyInfo(players[pid]) };
  });

  handle('claimDaily', () => {
    const pid = socket.data.pid;
    if (!pid || !players[pid]) throw new Error('Önce giriş yapılmalı.');
    const d = claimDaily(players[pid]);
    return { gold: goldOf(pid), amount: d.amount, day: d.day, daily: dailyInfo(players[pid]) };
  });

  handle('create', ({ name, mode, totalHands, vsBots, fee, pid }) => {
    pid = ensureProfile(pid, name);
    socket.data.pid = pid;
    fee = vsBots ? 0 : cleanFee(fee);
    if (!vsBots) {
      if (fee < MIN_FEE) throw new Error(`Masa ücreti en az ${MIN_FEE} altın olmalı.`);
      if (goldOf(pid) < fee) throw new Error(`Yeterli altının yok (${goldOf(pid)} altın).`);
    }
    const code = newCode();
    const token = newToken();
    const room = {
      code,
      hostToken: token,
      settings: { mode: mode === 'team' ? 'team' : 'solo', totalHands: HAND_OPTIONS.includes(+totalHands) ? +totalHands : 11, fee },
      seats: [{ token, pid, name: cleanName(name) }, null, null, null],
      game: null,
    };
    rooms.set(code, room);
    attach(socket, room, 0);
    if (vsBots) {
      for (let i = 1; i < 4; i++) addBot(room, i);
      room.game = newGame(room);
    }
    broadcast(room);
    return { code, token };
  });

  handle('join', ({ code, name, token, pid }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new Error('Oda bulunamadı.');
    let seat = token ? seatOf(room, token) : -1;
    if (seat < 0) {
      if (room.game) throw new Error('Oyun başlamış, odaya giremezsiniz.');
      pid = ensureProfile(pid, name);
      socket.data.pid = pid;
      if (room.settings.fee && goldOf(pid) < room.settings.fee) throw new Error(`Bu masanın ücreti ${room.settings.fee} altın, senin ${goldOf(pid)} altının var.`);
      seat = room.seats.findIndex((p) => !p);
      if (seat < 0) throw new Error('Oda dolu.');
      token = newToken();
      room.seats[seat] = { token, pid, name: cleanName(name) };
    } else if (name && !room.game) {
      room.seats[seat].name = cleanName(name);
    }
    attach(socket, room, seat);
    ensureHost(room);
    broadcast(room);
    return { code: room.code, token };
  });

  handle('sit', ({ seat: to }) => {
    const { room, seat } = ctx();
    if (room.game) throw new Error('Oyun başladı.');
    if (![0, 1, 2, 3].includes(to) || room.seats[to]) throw new Error('Koltuk dolu.');
    room.seats[to] = room.seats[seat];
    room.seats[seat] = null;
    broadcast(room);
  });

  handle('addBot', ({ seat }) => {
    const { room } = ctx();
    if (socket.data.token !== room.hostToken) throw new Error('Sadece oda sahibi bilgisayar ekleyebilir.');
    if (room.game) throw new Error('Oyun başladı.');
    if (![0, 1, 2, 3].includes(seat) || room.seats[seat]) throw new Error('Koltuk dolu.');
    addBot(room, seat);
    broadcast(room);
  });

  handle('removeBot', ({ seat }) => {
    const { room } = ctx();
    if (socket.data.token !== room.hostToken) throw new Error('Sadece oda sahibi çıkarabilir.');
    if (room.game) throw new Error('Oyun başladı.');
    if (!room.seats[seat] || !room.seats[seat].bot) throw new Error('Bu koltukta bilgisayar yok.');
    room.seats[seat] = null;
    broadcast(room);
  });

  handle('settings', ({ mode, totalHands, fee }) => {
    const { room } = ctx();
    if (socket.data.token !== room.hostToken) throw new Error('Sadece oda sahibi değiştirebilir.');
    if (room.game) throw new Error('Oyun başladı.');
    if (fee != null) {
      fee = cleanFee(fee);
      if (fee < MIN_FEE) throw new Error(`Masa ücreti en az ${MIN_FEE} altın olmalı.`);
      room.settings.fee = fee;
    }
    if (mode) room.settings.mode = mode === 'team' ? 'team' : 'solo';
    if (HAND_OPTIONS.includes(+totalHands)) room.settings.totalHands = +totalHands;
    broadcast(room);
  });

  handle('start', () => {
    const { room } = ctx();
    if (socket.data.token !== room.hostToken) throw new Error('Sadece oda sahibi başlatabilir.');
    if (room.game) throw new Error('Oyun zaten başladı.');
    if (room.seats.some((p) => !p)) throw new Error('4 oyuncu gerekli.');
    // Altın sadece 4 gerçek oyunculu online masada kullanılır; bilgisayarlı oyun ücretsiz
    const online = room.seats.every((p) => !p.bot) && room.settings.fee > 0;
    room.money = null;
    if (online) {
      const fee = room.settings.fee;
      const poor = room.seats.filter((p) => goldOf(p.pid) < fee);
      if (poor.length) throw new Error(`Yeterli altını olmayan: ${poor.map((p) => p.name).join(', ')} (ücret ${fee}).`);
      room.seats.forEach((p) => (players[p.pid].gold -= fee));
      savePlayers();
      room.money = { fee, pot: fee * 4, settled: false };
    }
    room.game = newGame(room);
    broadcast(room);
  });

  handle('draw', ({ src }) => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    const card = room.game.draw(seat, src === 'pile' ? 'pile' : 'deck');
    broadcast(room);
    return { card };
  });

  handle('discard', ({ cardId, finish }) => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    room.game.discard(seat, cardId, !!finish);
    broadcast(room);
  });

  // Oyuncu elini dizince sıra sunucuya gelir; rakipler kağıt arkalarını bu sırayla görür
  handle('arrange', ({ ids, rows }) => {
    const { room, seat } = ctx();
    if (!room.game) return;
    const before = JSON.stringify(room.game.arr[seat]);
    room.game.setArrangement(seat, ids, rows);
    if (JSON.stringify(room.game.arr[seat]) !== before) broadcast(room);
  });

  // Rakip bitince: elimi açtım (düzenledim), cezam yazılsın
  handle('confirmHand', () => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    room.game.confirmHand(seat);
    broadcast(room);
  });

  handle('showIndicator', () => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    room.game.showIndicator(seat);
    broadcast(room);
  });

  handle('undoTake', () => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    room.game.undoTake(seat);
    broadcast(room);
  });

  handle('next', () => {
    const { room, seat } = ctx();
    if (!room.game) throw new Error('Oyun başlamadı.');
    if (room.game.status === 'gameOver') { room.game = null; room.money = null; broadcast(room); return; } // lobiye dön
    if (room.game.status !== 'handOver' || !room.next) return;
    room.next.ready.add(seat);
    // bağlı tüm oyuncular onayladıysa hemen başla
    const waiting = room.seats.some((p, i) => p && !p.bot && p.socketId && !room.next.ready.has(i));
    if (!waiting) advanceHand(room);
    else broadcast(room);
  });

  handle('leave', () => {
    const { room, seat } = ctx();
    if (room.game) throw new Error('Oyun sürerken çıkılamaz.');
    room.seats[seat] = null;
    socket.leave(room.code);
    socket.data = {};
    ensureHost(room);
    if (!hasHumans(room)) rooms.delete(room.code);
    else broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const seat = seatOf(room, socket.data.token);
    if (seat < 0 || room.seats[seat].socketId !== socket.id) return;
    const p = room.seats[seat];
    p.socketId = null;
    // Lobide 60 sn içinde dönmeyenin koltuğu boşalır; oyunda koltuk korunur
    if (!room.game) {
      p.leaveTimer = setTimeout(() => {
        if (room.game || p.socketId || room.seats[seat] !== p) return;
        room.seats[seat] = null;
        ensureHost(room);
        if (!hasHumans(room)) rooms.delete(room.code);
        else broadcast(room);
      }, 60 * 1000);
    }
    scheduleCleanup(room);
    broadcast(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`İskambil 51 çalışıyor: http://localhost:${PORT}`));
