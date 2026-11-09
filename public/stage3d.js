// Tek parça 3B sahne: zemin, halı, masa gölgesi, sandalyeler ve kağıt tutan oyuncular (three.js).
// Kamera, masanın CSS perspektifiyle birebir eşlenir; böylece DOM'daki masa ve kağıtlar bu sahneyle hizalı kalır.
const Stage3D = (() => {
  // arka plan kapsayıcısı; 3B çalışmasa bile gradyan zemin görünür
  let host = document.getElementById('scene');
  if (!host) {
    host = document.createElement('div');
    host.id = 'scene';
    host.setAttribute('aria-hidden', 'true');
    document.body.prepend(host);
  }
  const T = window.THREE;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = 1800; // CSS perspective (style.css: #tableBox)
  const noop = () => {};

  function canWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }
  const available = !!T && canWebGL();
  if (!available) return { available: false, metrics: null, layout: noop, idle: noop, setPlayer: noop, setTurn: noop, act: noop, anchor: () => null };
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;

  // masa ölçüsüne göre dünya ölçeği: 1 metre = k piksel, masa yüksekliği 0.62 metre
  const metrics = (TH) => {
    const k = TH / 2.6;
    const thick = Math.round(TH * 0.05);
    const hfloor = 0.62 * k;
    return { k, thick, hfloor, leg: Math.round(hfloor - thick) };
  };

  // ---------- dokular ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  }
  function plankTex() {
    return canvasTex(512, 512, (g, w, h) => {
      const rows = 8;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        const b = 46 + ((r * 37) % 22);
        g.fillStyle = `rgb(${b + 18},${b - 2},${b - 20})`;
        g.fillRect(0, r * rh, w, rh);
        for (let i = 0; i < 26; i++) {
          g.strokeStyle = `rgba(${i % 2 ? '20,10,4' : '120,80,44'},${0.05 + (i % 5) * 0.015})`;
          g.lineWidth = 1;
          const y = r * rh + 3 + ((i * 53 + r * 17) % (rh - 6));
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(w, y + ((i % 3) - 1) * 2);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(0, r * rh, w, 2);
        const jx = (r * 173 + 60) % w;
        g.fillRect(jx, r * rh, 2, rh);
      }
    }, 14);
  }
  function rugTex() {
    return canvasTex(1024, 768, (g, w, h) => {
      g.fillStyle = '#4e1824';
      g.fillRect(0, 0, w, h);
      const band = (inset, bw, col) => { g.strokeStyle = col; g.lineWidth = bw; g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset); };
      band(10, 14, '#7a5a1e');
      band(30, 5, '#d8b25a');
      g.fillStyle = '#1d2a44';
      g.fillRect(44, 44, w - 88, 56);
      g.fillRect(44, h - 100, w - 88, 56);
      g.fillRect(44, 44, 56, h - 88);
      g.fillRect(w - 100, 44, 56, h - 88);
      g.fillStyle = 'rgba(216,178,90,.5)';
      for (let x = 70; x < w - 60; x += 46) {
        [72, h - 72].forEach((y) => { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); });
      }
      for (let y = 70; y < h - 60; y += 46) {
        [72, w - 72].forEach((x) => { g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); });
      }
      band(108, 4, '#d8b25a');
      g.save();
      g.beginPath();
      g.rect(112, 112, w - 224, h - 224);
      g.clip();
      g.strokeStyle = 'rgba(216,178,90,.28)';
      g.lineWidth = 2;
      for (let i = -h; i < w + h; i += 46) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
      }
      g.restore();
      g.strokeStyle = '#d8b25a';
      g.lineWidth = 5;
      g.beginPath(); g.ellipse(w / 2, h / 2, 250, 170, 0, 0, 7); g.stroke();
      g.fillStyle = '#7a1f30';
      g.beginPath(); g.ellipse(w / 2, h / 2, 238, 158, 0, 0, 7); g.fill();
      g.strokeStyle = '#e8d29a';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(w / 2 - 190, h / 2); g.lineTo(w / 2, h / 2 - 120); g.lineTo(w / 2 + 190, h / 2); g.lineTo(w / 2, h / 2 + 120); g.closePath(); g.stroke();
      g.fillStyle = '#d8b25a';
      g.beginPath(); g.ellipse(w / 2, h / 2, 46, 34, 0, 0, 7); g.fill();
    });
  }
  function glowTex() {
    return canvasTex(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,226,170,.9)');
      r.addColorStop(0.5, 'rgba(255,200,120,.3)');
      r.addColorStop(1, 'rgba(255,190,100,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    });
  }
  function backTex(col) {
    return canvasTex(64, 90, (g, w, h) => {
      g.fillStyle = '#f6f2e6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = col === 'red' ? '#9e1f1a' : '#1d4796';
      g.fillRect(5, 5, w - 10, h - 10);
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 1;
      for (let i = -h; i < w + h; i += 9) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
      }
    });
  }

  // ---------- sahne ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'scene3d';
  host.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setClearColor(0x1a110a, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera();
  const tableG = new T.Group();
  scene.add(tableG);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const floorTex = plankTex();
  floorTex.anisotropy = maxAniso;
  const floor = new T.Mesh(new T.PlaneGeometry(14000, 14000), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
  floor.receiveShadow = true;
  const rugT = rugTex();
  rugT.anisotropy = maxAniso;
  const rug = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ map: rugT, roughness: 0.95 }));
  rug.receiveShadow = true;
  const pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: glowTex(), transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
  tableG.add(floor, rug, pool);

  const hemi = new T.HemisphereLight(0xfff0dc, 0x3a2614, 1.15);
    const key = new T.DirectionalLight(0xffe2b8, 1.7);
    const fill = new T.DirectionalLight(0xfff4e6, 1.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.radius = 3;
    const keyTarget = new T.Object3D();
    tableG.add(hemi, key, fill, keyTarget);
  key.target = keyTarget;

  // masa ve ayaklar yalnızca gölge düşürür (görünür masa DOM'da)
  const ghost = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const caster = new T.Group();
  const slab = new T.Mesh(new T.BoxGeometry(1, 1, 1), ghost);
  slab.castShadow = true;
  caster.add(slab);
  const legs = [0, 1, 2, 3].map(() => { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), ghost); m.castShadow = true; caster.add(m); return m; });
  tableG.add(caster);

  // ---------- oyuncular ----------
  // Kadın ve erkek için ayrı görünüm havuzu; aynı tohum hep aynı kişiyi üretir
  function look(seed, female) {
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const skin = pick(female ? [['#f6d2b0', '#c48a62'], ['#efc29c', '#b97e52'], ['#e2ae80', '#a46a40'], ['#d29a6a', '#8e5630']] : [['#f0c49a', '#b97e52'], ['#e2ae80', '#a46a40'], ['#d29a6a', '#8e5630'], ['#c08458', '#7a4422']]);
    if (female) {
      return {
        female: true, skin: skin[0], skinDark: skin[1],
        jacket: pick(['#b04a6a', '#3f7a8a', '#7a5aa8', '#c0703a', '#4a8a5a']),
        capC: '#000000',
        hairC: pick(['#1a120c', '#3a2214', '#6a3a1c', '#9a5a2a', '#c8a064']),
        cap: false, stache: 0, style: pick(['bun', 'pony', 'long', 'bob']),
      };
    }
    const jacket = pick(['#4b6a8c', '#8a4a3a', '#3f7a5a', '#7a3f55', '#5c5f73']);
    const capC = pick(['#6a5a3c', '#4a5560', '#7a6048', '#3f3a35', '#8a8478']);
    const hairC = pick(['#1a120c', '#2a1c12', '#5a5048', '#8a8278']);
    const cap = r() < 0.7;
    const stache = Math.floor(r() * 3);
    return { female: false, skin: skin[0], skinDark: skin[1], jacket, capC, hairC, cap, stache, style: 'short' };
  }
  const FEMALE = new Set(['ayşe', 'ayse', 'fatma', 'zeynep', 'elif', 'emine', 'hatice', 'merve', 'esra', 'büşra', 'busra', 'özlem', 'ozlem', 'sevgi', 'seda', 'derya', 'gül', 'gul', 'gülsüm', 'selin', 'ebru', 'burcu', 'hülya', 'hulya', 'leyla', 'songül', 'songul', 'nur', 'sibel', 'nesrin', 'melek', 'havva', 'hacer', 'rabia', 'aylin', 'pınar', 'pinar', 'dilek', 'gizem', 'ceren', 'irem', 'sema', 'yasemin', 'meryem', 'sultan', 'ela', 'defne', 'ece', 'cansu', 'tuğba', 'tugba', 'nihal', 'neslihan', 'zehra', 'fadime', 'kübra', 'kubra', 'asli', 'aslı', 'sena', 'beyza', 'buse', 'nilay', 'nazlı', 'nazli', 'ayten', 'şule', 'sule', 'figen', 'gönül', 'gonul', 'bahar', 'deniz', 'sevil', 'sevda', 'canan', 'nermin', 'perihan', 'gamze', 'şeyma', 'seyma', 'hilal', 'rümeysa', 'rumeysa', 'betül', 'betul', 'özge', 'ozge', 'tülay', 'tulay', 'filiz', 'serap', 'mine', 'melis', 'naz', 'ilayda', 'ada', 'lale', 'ilknur', 'ayla', 'aysel', 'handan', 'neriman', 'saliha', 'sümeyye', 'sumeyye', 'emel', 'esma', 'ümmü', 'münevver']);
  const MALE_A = new Set(['mehmet', 'ali', 'veli', 'can', 'umut', 'tarık', 'tarik', 'barış', 'baris', 'kaan', 'cenk', 'koray', 'ata', 'rıza', 'riza', 'musa', 'yusuf', 'kemal', 'murat', 'emre', 'burak', 'cem', 'ahmet', 'hasan', 'hüseyin', 'huseyin', 'mustafa', 'ömer', 'omer', 'osman', 'ismail', 'ibrahim', 'erdem', 'serkan', 'onur', 'volkan', 'okan', 'orhan']);
  // İsimden cinsiyet: bilinen kadın adları, sonra Türkçe kadın adı takıları; erkek adları önceliklidir
  function isFemaleName(name) {
    const n = String(name || '').trim().toLocaleLowerCase('tr').split(/\s+/)[0].replace(/[^a-zçğıöşü]/g, '');
    if (!n) return false;
    if (MALE_A.has(n)) return false;
    if (FEMALE.has(n)) return true;
    return /(nur|gül|gul|sultan|hanım|hanim|su)$/.test(n) && n.length > 3;
  }
  const V = (x, y, z) => new T.Vector3(x, y, z);
  function limb(a, b, r, m) {
    const len = a.distanceTo(b);
    const mesh = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 14), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  }
  const CARD_W = 0.17;
  const CARD_H = 0.24;
  const cardGeo = new T.BoxGeometry(CARD_W, CARD_H, 0.004).translate(0, CARD_H / 2, 0);
  const cardWhite = new T.MeshStandardMaterial({ color: 0xf6f2e6, roughness: 0.7 });
  const backMats = { red: new T.MeshStandardMaterial({ map: backTex('red'), roughness: 0.6 }), blue: new T.MeshStandardMaterial({ map: backTex('blue'), roughness: 0.6 }) };

  function build(lk) {
    const std = (color, rough = 0.8) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    const lift = (hex, k) => new T.Color(hex).multiplyScalar(k);
    const skin = std(lk.skin, 0.7);
    const skinD = std(lk.skinDark, 0.8);
    const jacket = std(lift(lk.jacket, 1.0), 0.85);
    const trousers = std(lift(lk.jacket, 0.55), 0.9);
    const hair = std(lk.hairC, 0.9);
    const woodM = std('#6a3f1c', 0.55);
    const caneM = std('#cfa468', 0.9);
    const dark = std('#140b06', 0.6);
    const root = new T.Group();

    // sandalye: ayakları zemine kadar iniyor (y = -0.42)
    const seat = new T.Mesh(new T.CylinderGeometry(0.29, 0.29, 0.05, 32), caneM);
    seat.position.y = -0.03;
    const seatRim = new T.Mesh(new T.TorusGeometry(0.29, 0.024, 8, 32), woodM);
    seatRim.rotation.x = Math.PI / 2;
    seatRim.position.y = -0.03;
    root.add(seat, seatRim);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const leg = new T.Mesh(new T.CylinderGeometry(0.022, 0.016, 0.4, 8), woodM);
      leg.position.set(x * 0.21, -0.23, z * 0.21);
      leg.rotation.set(z * 0.06, 0, -x * 0.06);
      root.add(leg);
    });
    const back = new T.Mesh(new T.TorusGeometry(0.34, 0.026, 8, 40, Math.PI * 1.1), woodM);
    back.position.set(0, 0.3, -0.29);
    back.rotation.z = -0.05 * Math.PI;
    const back2 = new T.Mesh(new T.TorusGeometry(0.22, 0.018, 8, 32, Math.PI * 1.05), woodM);
    back2.position.set(0, 0.3, -0.29);
    back2.rotation.z = -0.03 * Math.PI;
    root.add(back, back2);

    // bacaklar: ayakları yere basıyor. Kadında etek (uyluk) + koyu çorap
    const F = lk.female;
    const tights = std('#2a1c22', 0.8);
    [-1, 1].forEach((s) => {
      root.add(limb(V(s * 0.11, 0.1, 0.02), V(s * 0.12, 0.1, 0.4), F ? 0.088 : 0.075, trousers));
      root.add(limb(V(s * 0.12, 0.1, 0.42), V(s * 0.12, -0.34, 0.46), F ? 0.05 : 0.062, F ? tights : trousers));
      const shoe = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), F ? std('#5a2418', 0.5) : dark);
      shoe.scale.set(F ? 0.85 : 1, 0.6, 1.5);
      shoe.position.set(s * 0.12, -0.385, 0.5);
      root.add(shoe);
    });
    if (F) {
      // etek: kucaktan dize kadar açılan kumaş
      const skirt = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 0.2, 28, 1, true), trousers);
      skirt.material.side = T.DoubleSide;
      skirt.position.set(0, 0.06, 0.06);
      const lap = new T.Mesh(new T.BoxGeometry(0.34, 0.07, 0.4), trousers);
      lap.position.set(0, 0.12, 0.2);
      root.add(skirt, lap);
    }

    const torso = new T.Group();
    torso.position.y = 0.06;
    const body = new T.Mesh(new T.CylinderGeometry(F ? 0.165 : 0.2, F ? 0.2 : 0.24, 0.56, 24), jacket);
    body.scale.z = 0.66;
    body.position.y = 0.28;
    const shoulders = new T.Mesh(new T.SphereGeometry(0.235, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), jacket);
    shoulders.scale.set(F ? 0.88 : 1.05, 0.45, 0.66);
    shoulders.position.y = 0.56;
    const neck = new T.Mesh(new T.CylinderGeometry(F ? 0.045 : 0.055, F ? 0.055 : 0.065, 0.12, 14), skinD);
    neck.position.y = 0.66;
    torso.add(body, shoulders, neck);
    if (F) {
      const bust = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), jacket);
      bust.scale.set(1.5, 0.8, 0.8);
      bust.position.set(0, 0.46, 0.1);
      const vneck = new T.Mesh(new T.ConeGeometry(0.06, 0.12, 3), skin);
      vneck.rotation.set(0.1, 0, Math.PI);
      vneck.position.set(0, 0.57, 0.148);
      const scarf = new T.Mesh(new T.TorusGeometry(0.085, 0.022, 8, 24), std('#f2e4c4', 0.8));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 0.62;
      const bead = new T.Mesh(new T.SphereGeometry(0.014, 8, 8), std('#e0b84a', 0.3));
      bead.position.set(0, 0.54, 0.158);
      torso.add(bust, vneck, scarf, bead);
    } else {
      const shirt = new T.Mesh(new T.BoxGeometry(0.1, 0.3, 0.02), std('#efe6d2', 0.8));
      shirt.position.set(0, 0.4, 0.158);
      shirt.rotation.x = -0.06;
      const tie = new T.Mesh(new T.BoxGeometry(0.028, 0.24, 0.012), std('#8a2a20', 0.7));
      tie.position.set(0, 0.37, 0.172);
      tie.rotation.x = -0.06;
      torso.add(shirt, tie);
      [-1, 1].forEach((s) => {
        const lapel = new T.Mesh(new T.BoxGeometry(0.05, 0.26, 0.012), jacket);
        lapel.position.set(s * 0.075, 0.43, 0.168);
        lapel.rotation.set(-0.06, 0, s * 0.18);
        torso.add(lapel);
        const bt = new T.Mesh(new T.SphereGeometry(0.011, 8, 8), std('#d8b25a', 0.3));
        bt.position.set(s * 0.05, 0.22 + (s > 0 ? 0 : 0.0), 0.17);
        torso.add(bt);
      });
    }
    root.add(torso);

    // kollar bükük; iki el kağıt yelpazesinin tabanını tutuyor
    const cards = new T.Group();
    cards.position.set(0, 0.5, 0.34);
    cards.rotation.x = -0.3;
    const hands = [];
    [-1, 1].forEach((s) => {
      const sh = V(s * (F ? 0.2 : 0.23), 0.62, 0);
      const el = V(s * (F ? 0.27 : 0.3), 0.4, 0.14);
      const hd = V(s * 0.07, 0.5, 0.36);
      const ball = new T.Mesh(new T.SphereGeometry(F ? 0.055 : 0.062, 14, 12), jacket);
      ball.position.copy(sh);
      root.add(ball, limb(sh, el, F ? 0.045 : 0.052, jacket), limb(el, hd, F ? 0.04 : 0.046, F ? skin : jacket));
      const hand = new T.Mesh(new T.SphereGeometry(F ? 0.046 : 0.052, 14, 12), skin);
      hand.scale.set(1, 1.15, 0.85);
      hand.position.copy(hd).add(V(0, 0.01, 0.02));
      const thumb = new T.Mesh(new T.CapsuleGeometry(0.014, 0.04, 4, 8), skin);
      thumb.position.set(-s * 0.03, 0.03, 0.025);
      thumb.rotation.z = s * 0.7;
      hand.add(thumb);
      root.add(hand);
      hands.push(hand);
    });
    root.add(cards);

    const head = new T.Group();
    head.position.y = 0.84;
    const skull = new T.Mesh(new T.SphereGeometry(0.135, 32, 24), skin);
    skull.scale.set(F ? 0.9 : 0.92, 1.1, 1);
    const jaw = new T.Mesh(new T.SphereGeometry(0.1, 24, 16), skin);
    jaw.scale.set(F ? 0.92 : 1.05, F ? 0.85 : 0.9, 0.98);
    jaw.position.set(0, -0.075, 0.015);
    const nose = new T.Mesh(new T.SphereGeometry(F ? 0.02 : 0.026, 14, 12), skinD);
    nose.scale.set(0.9, 1.15, 1.1);
    nose.position.set(0, -0.012, 0.135);
    head.add(skull, jaw, nose);
    [-1, 1].forEach((s) => {
      const ear = new T.Mesh(new T.SphereGeometry(0.03, 12, 10), skinD);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(s * 0.125, -0.005, -0.005);
      head.add(ear);
      const brow = new T.Mesh(new T.BoxGeometry(0.052, F ? 0.007 : 0.012, 0.014), hair);
      brow.position.set(s * 0.05, F ? 0.056 : 0.05, 0.122);
      brow.rotation.z = -s * (F ? 0.2 : 0.12);
      head.add(brow);
      const cheek = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), std(F ? '#e89080' : '#d08868', 0.9));
      cheek.scale.set(1, 0.7, 0.3);
      cheek.position.set(s * 0.07, -0.035, 0.115);
      cheek.material.transparent = true;
      cheek.material.opacity = 0.35;
      head.add(cheek);
      if (F) {
        const ring = new T.Mesh(new T.SphereGeometry(0.014, 8, 8), std('#e0b84a', 0.3));
        ring.position.set(s * 0.13, -0.04, -0.005);
        head.add(ring);
        const lash = new T.Mesh(new T.BoxGeometry(0.04, 0.005, 0.01), dark);
        lash.position.set(s * 0.05, 0.043, 0.125);
        lash.rotation.z = -s * 0.15;
        head.add(lash);
      }
    });
    const eyeWhite = std('#f4efe6', 0.4);
    const eyes = [-1, 1].map((s) => {
      const e = new T.Group();
      const w = new T.Mesh(new T.SphereGeometry(0.02, 12, 10), eyeWhite);
      w.scale.set(1.1, 0.85, 0.7);
      const pu = new T.Mesh(new T.SphereGeometry(0.0115, 10, 8), F ? std('#3a2a1a', 0.4) : dark);
      pu.position.set(0, 0, 0.011);
      e.add(w, pu);
      e.position.set(s * 0.05, 0.027, 0.119);
      head.add(e);
      return e;
    });
    if (!F) {
      const sw = [0.04, 0.058, 0.07][lk.stache];
      const sh = [0.017, 0.022, 0.026][lk.stache];
      [-1, 1].forEach((s) => {
        const m = new T.Mesh(new T.SphereGeometry(1, 14, 10), hair);
        m.scale.set(sw, sh, 0.02);
        m.position.set(s * sw * 0.8, -0.045, 0.133);
        m.rotation.z = -s * 0.28;
        head.add(m);
        const burn = new T.Mesh(new T.BoxGeometry(0.014, 0.06, 0.02), hair);
        burn.position.set(s * 0.122, 0.02, 0.04);
        head.add(burn);
      });
    }
    const mouth = new T.Mesh(F ? new T.SphereGeometry(0.02, 12, 8) : new T.BoxGeometry(0.04, 0.006, 0.008), std(F ? '#b8303c' : '#6a3020', 0.5));
    if (F) mouth.scale.set(1.2, 0.35, 0.4);
    mouth.position.set(0, -0.082, 0.128);
    head.add(mouth);
    if (F) {
      // saç: tepe + arka kütle, modele göre topuz / at kuyruğu / uzun / küt
      const capH = new T.Mesh(new T.SphereGeometry(0.146, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
      capH.scale.set(0.97, 1.1, 1.06);
      capH.position.set(0, 0.014, -0.012);
      const backH = new T.Mesh(new T.SphereGeometry(0.14, 24, 16), hair);
      backH.scale.set(0.98, lk.style === 'long' ? 1.9 : lk.style === 'bob' ? 1.1 : 0.9, 0.7);
      backH.position.set(0, lk.style === 'long' ? -0.09 : lk.style === 'bob' ? -0.03 : 0.0, -0.075);
      head.add(capH, backH);
      if (lk.style === 'bun') {
        const bun = new T.Mesh(new T.SphereGeometry(0.06, 16, 12), hair);
        bun.position.set(0, 0.13, -0.08);
        head.add(bun);
      } else if (lk.style === 'pony') {
        const tail = new T.Mesh(new T.CapsuleGeometry(0.035, 0.18, 6, 10), hair);
        tail.position.set(0, -0.02, -0.17);
        tail.rotation.x = -0.35;
        head.add(tail);
      }
      // saç bandı / toka
      const clip = new T.Mesh(new T.SphereGeometry(0.014, 8, 8), std('#f2e4c4', 0.4));
      clip.position.set(0.1, 0.09, 0.07);
      head.add(clip);
    } else if (lk.cap) {
      const capM = std(lift(lk.capC, 1.0), 0.95);
      const dome = new T.Mesh(new T.SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capM);
      dome.scale.set(1.08, 0.62, 1.12);
      dome.position.set(0, 0.07, 0.005);
      dome.rotation.x = 0.1;
      const band = new T.Mesh(new T.CylinderGeometry(0.143, 0.143, 0.03, 32, 1, true), capM);
      band.scale.set(1.04, 1, 1.04);
      band.position.set(0, 0.07, 0.003);
      const peak = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.014, 24, 1, false, -Math.PI / 2, Math.PI), capM);
      peak.position.set(0, 0.062, 0.115);
      peak.rotation.x = 0.12;
      const knob = new T.Mesh(new T.SphereGeometry(0.014, 8, 8), capM);
      knob.position.set(0, 0.145, 0);
      head.add(dome, band, peak, knob);
    } else {
      const top = new T.Mesh(new T.SphereGeometry(0.14, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
      top.scale.set(0.95, 1.1, 1.03);
      top.position.set(0, 0.018, -0.012);
      head.add(top);
    }
    root.add(head);
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { root, head, torso, eyes, hands, cards };
  }

  const SEATS = {
    top: { yaw: 0 },
    left: { yaw: 0.85 },
    right: { yaw: -0.85 },
  };
  const seats = {};

  function setCards(s, cols) {
    const key = cols.join('');
    if (s.cardKey === key) return;
    s.cardKey = key;
    const g = s.fig.cards;
    while (g.children.length) g.remove(g.children[0]);
    const n = cols.length;
    const mid = (n - 1) / 2;
    const step = n > 1 ? Math.min(0.13, 1.25 / (n - 1)) : 0;
    cols.forEach((c, i) => {
      const m = new T.Mesh(cardGeo, [cardWhite, cardWhite, cardWhite, cardWhite, backMats[c] || backMats.blue, cardWhite]);
      m.rotation.z = -(i - mid) * step;
      m.position.z = i * 0.0035;
      m.castShadow = true;
      g.add(m);
    });
  }

  function setPlayer(slot, seed, cols, turn, female) {
    let s = seats[slot];
    if (!s || s.seed !== seed || s.female !== !!female) {
      if (s) tableG.remove(s.g);
      const fig = build(look(seed, !!female));
      const g = new T.Group(); // masa düzleminde konum
      const body = new T.Group(); // metre -> piksel, boy ekseni masa normaline
      body.rotation.x = Math.PI / 2;
      const yaw = new T.Group();
      yaw.rotation.y = SEATS[slot].yaw;
      yaw.add(fig.root);
      const ring = new T.Mesh(new T.RingGeometry(0.4, 0.46, 48), new T.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.415;
      yaw.add(ring);
      body.add(yaw);
      g.add(body);
      tableG.add(g);
      s = { slot, seed, female: !!female, g, body, yaw, fig, ring, turn: false, actUntil: 0, nextBlink: 0, blinkUntil: 0, leanNow: 0, phase: (seed % 628) / 100, baseHeadYaw: -SEATS[slot].yaw * 0.45, cardKey: '' };
      seats[slot] = s;
      placeSeat(s);
    }
    s.turn = !!turn;
    setCards(s, cols);
    return s;
  }
  function setTurn(slot, on) { if (seats[slot]) seats[slot].turn = !!on; }
  function act(slot) { if (seats[slot]) seats[slot].actUntil = performance.now() + 650; }

  // ---------- yerleşim ----------
  let cur = null;
  let idleMode = true;
  function placeSeat(s) {
    if (!cur) return;
    const k = cur.kk;
    const zSeat = -cur.hfloor + 0.42 * k;
    const edge = 0.24 * k;
    const pos = s.slot === 'top' ? [0, cur.TH / 2 + edge, zSeat] : s.slot === 'left' ? [-cur.TW / 2 - edge, 0, zSeat] : [cur.TW / 2 + edge, 0, zSeat];
    s.g.position.set(pos[0], pos[1], pos[2]);
    s.body.scale.setScalar(k);
    s.g.visible = !idleMode;
  }

  function sizeRenderer(vw, vh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (renderer.domElement.width !== Math.round(vw * dpr) || renderer.domElement.height !== Math.round(vh * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(vw, vh, false);
    }
  }

  // p: { vw, vh, ox, oy (perspektif merkezi), cx, cy (masa merkezi), TW, TH, tilt (derece) } — hepsi ekran pikseli
  function layout(p, idle) {
    idleMode = !!idle;
    const m = metrics(p.TH);
    m.kk = m.k * (p.ks || 1); // oyuncu ölçeği
    cur = { ...p, ...m };
    sizeRenderer(p.vw, p.vh);
    // CSS perspective ile aynı kamera: göz (ox, -oy, D), ekran düzlemi z = 0
    const n = 10;
    const f = 9000;
    camera.position.set(p.ox, -p.oy, D);
    camera.projectionMatrix.makePerspective((-p.ox * n) / D, ((p.vw - p.ox) * n) / D, (p.oy * n) / D, ((-p.vh + p.oy) * n) / D, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
    tableG.position.set(p.cx, -p.cy, 0);
    tableG.rotation.x = -(p.tilt * Math.PI) / 180;
    const fz = -m.hfloor;
    floor.position.z = fz;
    rug.position.z = fz + 0.6;
    rug.scale.set(p.TW + 2.7 * m.kk, p.TH + 2.5 * m.kk, 1);
    pool.position.z = fz + 1.2;
    pool.scale.set(p.TW * 1.5, p.TH * 1.7, 1);
    key.position.set(-p.TW * 0.35, -p.TH * 0.55, m.k * 6);
    fill.position.set(0, -p.TH * 1.1, m.k * 3);
    fill.target = keyTarget;
    keyTarget.position.set(0, 0, fz);
    const sc = key.shadow.camera;
    sc.left = -p.TW; sc.right = p.TW; sc.top = p.TH * 1.2; sc.bottom = -p.TH * 1.2;
    sc.near = 10; sc.far = m.k * 14;
    sc.updateProjectionMatrix();
    caster.visible = !idleMode;
    slab.scale.set(p.TW, p.TH, m.thick);
    slab.position.z = -m.thick / 2;
    const lw = p.TH * 0.07;
    const lh = m.hfloor - m.thick;
    const lx = p.TW / 2 - p.TH * 0.1;
    const ly = p.TH / 2 - p.TH * 0.1;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => {
      legs[i].scale.set(lw, lw, lh);
      legs[i].position.set(sx * lx, sy * ly, -m.thick - lh / 2);
    });
    for (const k2 in seats) placeSeat(seats[k2]);
    tableG.updateMatrixWorld(true);
  }

  function idle() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TH = Math.min(vh * 0.55, vw * 0.45);
    layout({ vw, vh, ox: vw / 2, oy: vh * 0.3, cx: vw / 2, cy: vh * 0.5, TW: TH * 1.5, TH, tilt: 40 }, true);
  }

  // oyuncunun bir noktasının (metre, oyuncu çerçevesinde) ekrandaki yeri
  const ANCH = { fan: [0, 0.55, 0.4], pill: { top: [0.8, 0.9, 0], left: [-0.1, 1.5, 0], right: [0.1, 1.5, 0] } };
  function anchor(slot, what) {
    const s = seats[slot];
    if (!s || !cur) return null;
    const pt = what === 'fan' ? ANCH.fan : ANCH.pill[slot];
    const v = V(pt[0], pt[1], pt[2]);
    s.yaw.updateWorldMatrix(true, false);
    s.yaw.localToWorld(v);
    v.project(camera);
    return { x: ((v.x + 1) / 2) * cur.vw, y: ((1 - v.y) / 2) * cur.vh };
  }

  // ---------- çizim ----------
  function animate(s, now) {
    const t = now / 1000;
    const { fig } = s;
    const breathe = reduce ? 0 : Math.sin(t * 1.7 + s.phase);
    fig.torso.scale.set(1 + 0.008 * breathe, 1 + 0.014 * breathe, 1 + 0.008 * breathe);
    const act2 = Math.max(0, (s.actUntil - now) / 650);
    const nod = Math.sin(act2 * Math.PI);
    s.leanNow += ((s.turn ? 0.06 : 0) - s.leanNow) * 0.12;
    fig.torso.rotation.x = s.leanNow + nod * 0.04;
    fig.head.position.y = 0.84 + (reduce ? 0 : 0.003 * breathe) - s.leanNow * 0.04;
    const lk = reduce ? 0 : Math.sin(t * 0.55 + s.phase) * 0.2 + Math.sin(t * 1.3 + s.phase * 2) * 0.05;
    fig.head.rotation.y = s.baseHeadYaw + lk;
    fig.head.rotation.x = -0.14 + s.leanNow * 0.5 + nod * 0.14;
    fig.hands.forEach((h, i) => { h.position.y = 0.51 + (reduce ? 0 : Math.sin(t * 1.7 + s.phase + i) * 0.003) + nod * 0.02; });
    fig.cards.position.y = 0.5 + nod * 0.03;
    fig.cards.rotation.z = reduce ? 0 : Math.sin(t * 0.9 + s.phase) * 0.012;
    if (!reduce) {
      if (now > s.nextBlink) { s.blinkUntil = now + 130; s.nextBlink = now + 2400 + Math.random() * 4800; }
      const sy = now < s.blinkUntil ? 0.1 : 1;
      fig.eyes.forEach((e) => { e.scale.y = sy; });
    }
    s.ring.material.opacity = s.turn ? 0.55 + (reduce ? 0 : Math.sin(t * 4) * 0.25) : 0;
  }
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return;
    last = now;
    if (!idleMode) for (const k in seats) animate(seats[k], now);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => { if (idleMode) idle(); });
  idle();

  return { available: true, metrics, layout, idle, setPlayer, setTurn, act, anchor, isFemaleName };
})();
