'use strict';
// Animasyonlu duvar kağıtları: kağıtların arkasında tek bir tuval (canvas) katmanı.
// Sakin ve az sayıda parçacık; saniyede en fazla 30 kare, sekme gizliyken durur.
const WpAnim = (() => {
  let cv = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let kind = null;
  let parts = [];
  let raf = 0;
  let last = 0;
  let t = 0;
  let extra = {};
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.id = 'wpAnim';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block';
    document.body.prepend(cv);
    ctx = cv.getContext('2d');
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && kind) loop(performance.now()); });
  }
  function size() {
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (kind) init();
  }
  const area = () => (W * H) / (1920 * 1080);

  // ---------- her türün parçacıkları ----------
  const KINDS = {
    kelebek: {
      init: () => Array.from({ length: Math.round(14 * area()) + 4 }, () => ({
        x: R(0, W), y: R(0, H), a: R(0, Math.PI * 2), s: R(30, 60), z: R(9, 17), f: R(9, 14), ph: R(0, 6),
        c: pick([['#ffb347', '#ff7a00'], ['#7ec8ff', '#2d6fd6'], ['#ff9ad5', '#d6457a'], ['#fff07a', '#f2b52b'], ['#b98aff', '#7d4cc2']]),
      })),
      step(p, dt) {
        p.a += Math.sin(t * 0.7 + p.ph) * dt * 1.4;
        p.x += Math.cos(p.a) * p.s * dt;
        p.y += Math.sin(p.a) * p.s * dt * 0.7 + Math.sin(t * 3 + p.ph) * 0.4;
        wrap(p, 30);
        const flap = Math.abs(Math.sin(t * p.f + p.ph)) * 0.85 + 0.15;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a + Math.PI / 2);
        ctx.globalAlpha = 0.85;
        for (const side of [-1, 1]) {
          ctx.fillStyle = p.c[0];
          ctx.beginPath();
          ctx.ellipse(side * p.z * 0.5 * flap, -p.z * 0.2, p.z * 0.55 * flap, p.z * 0.45, side * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = p.c[1];
          ctx.beginPath();
          ctx.ellipse(side * p.z * 0.4 * flap, p.z * 0.35, p.z * 0.38 * flap, p.z * 0.3, side * -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(-1, -p.z * 0.45, 2, p.z * 0.95);
        ctx.restore();
      },
    },
    kar: {
      init: () => Array.from({ length: Math.round(150 * area()) + 30 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.8, 3.2), v: R(18, 55), ph: R(0, 6) })),
      step(p, dt) {
        p.y += p.v * dt;
        p.x += Math.sin(t * 0.8 + p.ph) * 0.35;
        if (p.y > H + 5) { p.y = -5; p.x = R(0, W); }
        ctx.globalAlpha = 0.35 + p.r / 6;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    yildiz: {
      init() {
        extra.shoot = null;
        extra.next = t + R(2, 5);
        return Array.from({ length: Math.round(220 * area()) + 40 }, () => ({ x: R(0, W), y: R(0, H), r: R(0.4, 1.6), ph: R(0, 6), sp: R(0.6, 2) }));
      },
      step(p) {
        ctx.globalAlpha = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * p.sp + p.ph));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      },
      after(dt) {
        if (!extra.shoot && t > extra.next) extra.shoot = { x: R(W * 0.2, W), y: R(0, H * 0.4), life: 0 };
        const s = extra.shoot;
        if (!s) return;
        s.life += dt;
        s.x -= 700 * dt;
        s.y += 300 * dt;
        const g = ctx.createLinearGradient(s.x, s.y, s.x + 140, s.y - 60);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = Math.max(0, 1 - s.life / 0.9);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + 140, s.y - 60);
        ctx.stroke();
        if (s.life > 0.9) { extra.shoot = null; extra.next = t + R(3, 7); }
      },
    },
    atesbocegi: {
      init: () => Array.from({ length: Math.round(45 * area()) + 10 }, () => ({ x: R(0, W), y: R(0, H), a: R(0, 6.3), s: R(8, 22), ph: R(0, 6), sp: R(1, 2.5) })),
      step(p, dt) {
        p.a += R(-1, 1) * dt * 2;
        p.x += Math.cos(p.a) * p.s * dt;
        p.y += Math.sin(p.a) * p.s * dt;
        wrap(p, 10);
        const k = 0.5 + 0.5 * Math.sin(t * p.sp + p.ph);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        g.addColorStop(0, `rgba(240,255,150,${0.95 * k})`);
        g.addColorStop(0.35, `rgba(220,255,120,${0.45 * k})`);
        g.addColorStop(1, 'rgba(220,255,120,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35 + 0.65 * k; // parlak çekirdek
        ctx.fillStyle = '#fbffd8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    baloncuk: {
      init: () => Array.from({ length: Math.round(40 * area()) + 10 }, () => ({ x: R(0, W), y: R(0, H), r: R(4, 18), v: R(20, 55), ph: R(0, 6) })),
      step(p, dt) {
        p.y -= p.v * dt;
        p.x += Math.sin(t * 1.2 + p.ph) * 0.4;
        if (p.y < -p.r - 5) { p.y = H + p.r; p.x = R(0, W); }
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#cdeffd';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    yaprak: {
      init: () => Array.from({ length: Math.round(30 * area()) + 8 }, () => ({ x: R(0, W), y: R(0, H), z: R(7, 13), v: R(25, 55), rot: R(0, 6), vr: R(-1.5, 1.5), ph: R(0, 6), c: pick(['#e0662a', '#c94f1f', '#f2a516', '#a8401a', '#d98a2b']) })),
      step(p, dt) {
        p.y += p.v * dt;
        p.x += Math.sin(t * 0.9 + p.ph) * 0.8;
        p.rot += p.vr * dt;
        if (p.y > H + 20) { p.y = -20; p.x = R(0, W); }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(t * 1.6 + p.ph));
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(0, -p.z);
        ctx.quadraticCurveTo(p.z * 0.8, 0, 0, p.z);
        ctx.quadraticCurveTo(-p.z * 0.8, 0, 0, -p.z);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -p.z);
        ctx.lineTo(0, p.z);
        ctx.stroke();
        ctx.restore();
      },
    },
    aurora: {
      init: () => Array.from({ length: Math.round(90 * area()) + 20 }, () => ({ x: R(0, W), y: R(0, H * 0.7), r: R(0.4, 1.3), ph: R(0, 6) })),
      before() {
        ctx.globalCompositeOperation = 'lighter';
        const bands = [['rgba(60,255,170,', 0.32, 0.18], ['rgba(120,90,255,', 0.42, 0.13], ['rgba(40,200,255,', 0.26, 0.1]];
        bands.forEach(([c, yk, a], i) => {
          const y0 = H * yk;
          const g = ctx.createLinearGradient(0, y0 - 120, 0, y0 + 160);
          g.addColorStop(0, c + '0)');
          g.addColorStop(0.45, c + a + ')');
          g.addColorStop(1, c + '0)');
          ctx.fillStyle = g;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(0, H);
          for (let x = 0; x <= W + 40; x += 40) {
            const y = y0 + Math.sin(x / 260 + t * 0.35 + i * 2) * 50 + Math.sin(x / 120 - t * 0.5 + i) * 18;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H);
          ctx.closePath();
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      },
      step(p) {
        ctx.globalAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t + p.ph));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    yagmur: {
      init: () => Array.from({ length: Math.round(170 * area()) + 30 }, () => ({ x: R(0, W), y: R(0, H), l: R(10, 22), v: R(500, 800) })),
      step(p, dt) {
        p.y += p.v * dt;
        p.x -= p.v * dt * 0.18;
        if (p.y > H + 20) { p.y = R(-40, -10); p.x = R(0, W * 1.2); }
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#b8c8dc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.l * 0.18, p.y - p.l);
        ctx.stroke();
      },
    },
    sakura: {
      init: () => Array.from({ length: Math.round(36 * area()) + 10 }, () => ({ x: R(0, W), y: R(0, H), z: R(5, 9), v: R(22, 45), rot: R(0, 6), vr: R(-1.4, 1.4), ph: R(0, 6) })),
      step(p, dt) {
        p.y += p.v * dt;
        p.x += Math.sin(t * 0.8 + p.ph) * 0.7 + 0.25;
        p.rot += p.vr * dt;
        if (p.y > H + 15) { p.y = -15; p.x = R(-50, W); }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(t * 1.4 + p.ph)));
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#f7a8c4';
        ctx.beginPath();
        ctx.moveTo(0, -p.z);
        ctx.bezierCurveTo(p.z, -p.z * 0.6, p.z * 0.8, p.z * 0.7, 0, p.z);
        ctx.bezierCurveTo(-p.z * 0.8, p.z * 0.7, -p.z, -p.z * 0.6, 0, -p.z);
        ctx.fill();
        ctx.fillStyle = '#fbd3e2';
        ctx.beginPath();
        ctx.ellipse(0, -p.z * 0.2, p.z * 0.25, p.z * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    },
  };
  function wrap(p, m) {
    if (p.x < -m) p.x = W + m;
    if (p.x > W + m) p.x = -m;
    if (p.y < -m) p.y = H + m;
    if (p.y > H + m) p.y = -m;
  }
  function init() { extra = {}; parts = KINDS[kind].init(); }
  function frame(dt) {
    const K = KINDS[kind];
    ctx.clearRect(0, 0, W, H);
    if (K.before) K.before(dt);
    for (const p of parts) K.step(p, dt);
    if (K.after) K.after(dt);
    ctx.globalAlpha = 1;
  }
  function loop(now) {
    cancelAnimationFrame(raf);
    if (!kind || document.hidden) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    if (now - last >= 32) { // ~30 kare/sn
      last = now;
      t += dt;
      frame(dt);
    }
    if (!reduce) raf = requestAnimationFrame(loop);
  }
  function set(k) {
    if (!k || !KINDS[k]) {
      kind = null;
      cancelAnimationFrame(raf);
      if (cv) ctx.clearRect(0, 0, W, H);
      if (cv) cv.style.display = 'none';
      return;
    }
    ensure();
    cv.style.display = 'block';
    kind = k;
    size();
    last = 0;
    if (reduce) { t = 1; frame(0); return; }
    raf = requestAnimationFrame(loop);
  }
  return { set };
})();
