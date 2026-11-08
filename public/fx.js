'use strict';
// İskambil 51 - efektler: sentezlenmiş sesler, uçan kağıtlar (3D), konfeti, altın yağmuru, sarsıntı
const FX = (() => {
  // ================= SES (Web Audio, dosya yok) =================
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('i51-mute') === '1'; } catch {}

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    if (!noiseBuf) {
      const c = ac();
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  // filtrelenmiş gürültü patlaması: kağıt sesi
  function burst({ dur = 0.08, freq = 2000, q = 1, type = 'bandpass', vol = 0.4, attack = 0.003, t = 0, sweep = 0 }) {
    const c = ac(); if (!c) return;
    const src = c.createBufferSource();
    src.buffer = noise();
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = q;
    const t0 = c.currentTime + t;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }
  // ton: zil, melodi, uğultu
  function tone({ freq = 440, dur = 0.2, type = 'sine', vol = 0.2, t = 0, slide = 0, attack = 0.005 }) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const t0 = c.currentTime + t;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  const bell = (f, t, vol = 0.1, dur = 1.2) => {
    tone({ freq: f, dur, vol, t });
    tone({ freq: f * 2.01, dur: dur * 0.6, vol: vol * 0.4, t });
    tone({ freq: f * 3.02, dur: dur * 0.3, vol: vol * 0.2, t });
  };
  const SOUNDS = {
    slide() { burst({ dur: 0.18, freq: 1600, q: 0.6, vol: 0.28, attack: 0.04, sweep: 1.8 }); },
    place() { burst({ dur: 0.06, freq: 3200, q: 1.1, vol: 0.45 }); tone({ freq: 120, dur: 0.09, vol: 0.16 }); },
    flip() { burst({ dur: 0.035, freq: 4200, q: 2, vol: 0.35 }); burst({ dur: 0.04, freq: 3000, q: 2, vol: 0.3, t: 0.07 }); },
    pick() { burst({ dur: 0.09, freq: 2400, q: 0.9, vol: 0.3, sweep: 0.6 }); },
    deal() { burst({ dur: 0.045, freq: 2700 + Math.random() * 600, q: 1.4, vol: 0.22 }); },
    shuffle() {
      for (let i = 0; i < 22; i++) burst({ dur: 0.05, freq: 1800 + Math.random() * 1800, q: 1.2, vol: 0.18 + Math.random() * 0.1, t: i * 0.032 });
      burst({ dur: 0.12, freq: 900, q: 0.8, vol: 0.3, t: 0.75 });
    },
    turn() { bell(988, 0, 0.09, 0.6); bell(1319, 0.11, 0.08, 0.8); },
    chime() { [1047, 1319, 1568, 2093].forEach((f, i) => bell(f, i * 0.08, 0.08, 1.3)); },
    penalty() {
      tone({ freq: 220, dur: 0.45, type: 'sawtooth', vol: 0.09, slide: 0.45 });
      tone({ freq: 110, dur: 0.5, type: 'square', vol: 0.05, t: 0.04, slide: 0.6 });
      burst({ dur: 0.25, freq: 300, q: 0.7, vol: 0.2, type: 'lowpass' });
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.32, type: 'triangle', vol: 0.15, t: i * 0.11 }));
      [1047, 1319, 1568].forEach((f) => tone({ freq: f, dur: 1.4, type: 'triangle', vol: 0.09, t: 0.48 }));
      [1047, 1319, 1568, 2093].forEach((f, i) => bell(f, 0.5 + i * 0.05, 0.05, 1.6));
    },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.11, t: i * 0.16 })); },
    coin() { [1568, 2093, 2637, 3136].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'square', vol: 0.035, t: i * 0.055 })); },
    tick() { tone({ freq: 1250, dur: 0.035, type: 'square', vol: 0.04 }); },
    click() { tone({ freq: 700, dur: 0.035, type: 'triangle', vol: 0.06 }); burst({ dur: 0.02, freq: 5000, vol: 0.08 }); },
    error() { tone({ freq: 196, dur: 0.15, type: 'square', vol: 0.05 }); tone({ freq: 185, dur: 0.18, type: 'square', vol: 0.05, t: 0.12 }); },
  };
  function play(name, ...a) {
    if (muted) return;
    try { SOUNDS[name] && SOUNDS[name](...a); } catch {}
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('i51-mute', m ? '1' : '0'); } catch {}
    if (!m) ac();
  }
  // tarayıcı ses iznini ilk dokunuşta aç
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (!muted) ac(); }, { once: true, capture: true }));

  // ================= UÇAN KAĞITLAR (3D) =================
  let layer = null;
  function getLayer() {
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'fxLayer';
      document.body.appendChild(layer);
    }
    return layer;
  }
  // İki yüzlü kağıt: ön yüz (açık kağıt) + arka yüz (desen); 3D döndürmek için
  function flipCard(front, back) {
    const w = document.createElement('div');
    w.className = 'flip3d';
    const f = document.createElement('div');
    f.className = 'f-face f-front';
    const b = document.createElement('div');
    b.className = 'f-face f-back';
    if (front) f.appendChild(front);
    if (back) b.appendChild(back);
    w.append(f, b);
    return w;
  }
  const centerOf = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  /**
   * Bir kağıdı from -> to arasında kavisli, 3D dönüşlü uçur.
   * front: açık kağıt elemanı (yoksa sadece arka), back: arka yüz elemanı
   * startFace: 'front' | 'back', endFace: 'front' | 'back'
   */
  function fly({ from, to, front, back, startFace = 'front', endFace = 'front', duration = 520, delay = 0, arc = 70, spin = 0, endRotate = 0, sound = null, onLand = null }) {
    if (!from || !to || (!from.width && !to.width)) { onLand && onLand(); return; }
    // gecikmeli uçuşlar sırası gelince oluşturulur (beklerken üst üste yığılmasın)
    if (delay > 0) { setTimeout(() => fly({ from, to, front, back, startFace, endFace, duration, delay: 0, arc, spin, endRotate, sound, onLand }), delay); return; }
    const L = getLayer();
    const w = to.width || from.width;
    const h = to.height || from.height;
    const el = flipCard(front, back);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.setProperty('--cw', w + 'px');
    const c0 = centerOf(from);
    const c1 = centerOf(to);
    el.style.left = c1.x - w / 2 + 'px';
    el.style.top = c1.y - h / 2 + 'px';
    L.appendChild(el);
    const s0 = from.width ? from.width / w : 0.4;
    const dx = c0.x - c1.x;
    const dy = c0.y - c1.y;
    const r0 = startFace === 'back' ? 180 : 0;
    const rotY0 = r0;
    const rotY1 = startFace === endFace ? r0 + spin : (startFace === 'back' ? 360 : 180) + spin;
    const tilt = (Math.random() - 0.5) * 30;
    const anim = el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s0}) rotateY(${rotY0}deg) rotateZ(0deg)`, offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${(s0 + 1) / 2 + 0.18}) rotateY(${(rotY0 + rotY1) / 2}deg) rotateZ(${tilt}deg)`, offset: 0.5 },
      { transform: `translate(0px, 0px) scale(1) rotateY(${rotY1}deg) rotateZ(${endRotate}deg)`, offset: 1 },
    ], { duration, delay, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'both' });
    if (sound) setTimeout(() => play(sound), delay);
    anim.onfinish = () => { el.remove(); onLand && onLand(); };
    return anim;
  }

  // ================= KONFETİ / ALTIN YAĞMURU =================
  let canvas = null;
  let parts = [];
  let raf = null;
  function getCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fxCanvas';
      document.body.appendChild(canvas);
      const fit = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
      fit();
      addEventListener('resize', fit);
    }
    return canvas;
  }
  function loop() {
    const cv = getCanvas();
    const g = cv.getContext('2d');
    const dpr = devicePixelRatio;
    g.clearRect(0, 0, cv.width, cv.height);
    const now = performance.now();
    parts = parts.filter((p) => now - p.t0 < p.life);
    for (const p of parts) {
      p.vy += p.g; p.vx *= 0.992; p.vy *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const age = (now - p.t0) / p.life;
      g.save();
      g.globalAlpha = Math.min(1, (1 - age) * 2);
      g.translate(p.x * dpr, p.y * dpr);
      g.rotate(p.rot);
      if (p.coin) {
        const sx = Math.abs(Math.cos(p.rot * 2));
        g.scale(Math.max(0.15, sx), 1);
        const r = p.size * dpr;
        const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        grd.addColorStop(0, '#fff3b0'); grd.addColorStop(0.5, '#f5c542'); grd.addColorStop(1, '#a86f08');
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#8a5a05'; g.lineWidth = dpr; g.stroke();
      } else {
        g.fillStyle = p.color;
        g.fillRect(-p.size * dpr / 2, -p.size * dpr / 4, p.size * dpr, p.size * dpr / 2);
      }
      g.restore();
    }
    raf = parts.length ? requestAnimationFrame(loop) : null;
    if (!parts.length) g.clearRect(0, 0, cv.width, cv.height);
  }
  function start() { if (!raf) raf = requestAnimationFrame(loop); }
  const COLORS = ['#f5c542', '#ffe08a', '#e53935', '#1e88e5', '#43a047', '#ffffff', '#ab47bc'];
  function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 160, power = 14) {
    getCanvas();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.35 + Math.random() * 0.75);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.55, g: 0.32, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, size: 6 + Math.random() * 7, color: COLORS[i % COLORS.length], life: 2200 + Math.random() * 1400, t0 });
    }
    start();
  }
  function coinRain(n = 60) {
    getCanvas();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      parts.push({ coin: true, x: Math.random() * innerWidth, y: -30 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4, g: 0.18, rot: Math.random() * 6, vr: 0.05 + Math.random() * 0.12, size: 9 + Math.random() * 7, life: 3200, t0 });
    }
    start();
    for (let i = 0; i < 6; i++) setTimeout(() => play('coin'), i * 230);
  }
  function shake(el = document.body) {
    el.classList.remove('fx-shake');
    void el.offsetWidth;
    el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), 600);
  }
  // Büyük yazı (BİTTİN!, FİNAL!)
  function banner(text, cls = '') {
    const b = document.createElement('div');
    b.className = 'fx-banner ' + cls;
    b.textContent = text;
    getLayer().appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }

  return {
    play, setMuted, isMuted: () => muted,
    fly, flipCard, confetti, coinRain, shake, banner,
  };
})();
