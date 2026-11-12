// Tek parça 3B sahne: Vahşi Batı salonu (duvarlar, bar, lambalar, duman), sandalyeler ve kağıt tutan oyuncular (three.js).
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
  if (!available) return { available: false, metrics: null, layout: noop, idle: noop, setPlayer: noop, setTurn: noop, act: noop, anchor: () => null, isFemaleName: () => false, setLog: noop, setScores: noop };
  if (T.ColorManagement) T.ColorManagement.legacyMode = false;

  // masa ölçüsüne göre dünya ölçeği: 1 metre = k piksel, masa yüksekliği 0.62 metre
  const metrics = (TH, TM = 2.6) => {
    const k = TH / TM;
    const thick = Math.round(TH * 0.05);
    const hfloor = (TM < 2 ? 0.72 : 0.62) * k;
    return { k, thick, hfloor, leg: Math.round(hfloor - thick) };
  };

  const V = (x, y, z) => new T.Vector3(x, y, z);

  // ---------- dokular ----------
  function canvasTex(w, h, draw, rx, ry) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    if (rx) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry || rx); }
    return t;
  }
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function plankTex(base, rx, ry, seed) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rng(seed);
      const n = 8;
      const ph = h / n;
      for (let i = 0; i < n; i++) {
        const c = new T.Color(base).multiplyScalar(0.75 + r() * 0.4);
        g.fillStyle = '#' + c.getHexString();
        g.fillRect(0, i * ph, w, ph);
        for (let j = 0; j < 36; j++) {
          g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
          g.lineWidth = 0.5 + r() * 1.5;
          const y = i * ph + r() * ph;
          g.beginPath();
          g.moveTo(0, y);
          for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + j) * 2 * r());
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.55)';
        g.fillRect(0, i * ph, w, 3);
        g.fillRect(r() * w, i * ph, 3, ph);
        if (r() < 0.5) { g.fillStyle = 'rgba(30,15,5,.5)'; g.beginPath(); g.ellipse(r() * w, i * ph + ph / 2, 8, 4, 0, 0, 7); g.fill(); }
      }
    }, rx, ry);
  }
  const softTex = canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  const smokeTex = canvasTex(256, 256, (g, w) => {
    const r = rng(3);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.45;
      const y = w / 2 + (r() - 0.5) * w * 0.45;
      const rad = w * (0.12 + r() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,.22)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    }
  });
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
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x120a05, 1);
  renderer.shadowMap.enabled = false; // 175 Hz için gerçek zamanlı gölge yok
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // Masa HTML olarak 3B sahnenin ÜSTÜNDE çizilir; masaya uzanan kol onun altında kalmasın diye
  // kol (katman 1) ayrıca şeffaf bir üst tuvale çizilir.
  const ovCanvas = document.createElement('canvas');
  ovCanvas.className = 'scene3d-over';
  document.body.appendChild(ovCanvas);
  const ovRenderer = new T.WebGLRenderer({ canvas: ovCanvas, antialias: true, alpha: true });
  ovRenderer.outputEncoding = T.sRGBEncoding;
  ovRenderer.toneMapping = T.ACESFilmicToneMapping;
  ovRenderer.toneMappingExposure = 1.05;
  ovRenderer.setClearColor(0x000000, 0);
  let ovDirty = false;
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x1c1109, 2000, 4000);
  const camera = new T.PerspectiveCamera();
  const tableG = new T.Group();
  scene.add(tableG);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const std = (color, rough = 0.8, extra) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...(extra || {}) });

  // ---------- salon (metre birimiyle kurulur; layout ölçekler) ----------
  // room: y yukarı (masa normali), -z masanın uzak kenarı (üst oyuncunun arkası), zemin y = 0, masa merkezi orijin
  const room = new T.Group();
  room.rotation.x = Math.PI / 2;
  tableG.add(room);
  const floorT = plankTex('#3e2615', 10, 10, 11);
  floorT.anisotropy = maxAniso;
  const floor = new T.Mesh(new T.PlaneGeometry(14, 14), std(0xffffff, 0.8, { map: floorT }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);
  // masanın altında koyu, yıpranmış bir kilim
  const rugT = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#2c100c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6a4a22'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
    g.strokeStyle = 'rgba(160,110,50,.5)'; g.lineWidth = 3; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = 'rgba(120,70,30,.35)';
    for (let x = 50; x < w - 40; x += 34) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 10, 50); g.lineTo(x, 60); g.lineTo(x - 10, 50); g.fill(); g.beginPath(); g.moveTo(x, h - 60); g.lineTo(x + 10, h - 50); g.lineTo(x, h - 40); g.lineTo(x - 10, h - 50); g.fill(); }
    const r = rng(5);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.fillRect(r() * w, r() * h, 2 + r() * 4, 1 + r() * 2); }
  });
  const rug = new T.Mesh(new T.PlaneGeometry(6.2, 4.4), std(0xffffff, 0.95, { map: rugT }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.004;
  rug.receiveShadow = true;
  room.add(rug);

  const wallT = plankTex('#46291a', 3, 2, 5);
  wallT.rotation = Math.PI / 2;
  const wallM = std(0xffffff, 0.85, { map: wallT });
  const RW = 3.9; // yan duvarlar x = ±RW
  const RB = -4.2; // arka duvar z
  const RF = 2.6; // ön sınır
  const RH = 3.1;
  // kahvehane duvarı: altta ahşap lambri, üstte eskimiş sıva
  const plasterM = std(0xffffff, 0.95, { map: canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#9a8460'; g.fillRect(0, 0, w, w);
    const r = rng(8);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,40,20' : '200,180,140'},${r() * 0.08})`; g.beginPath(); g.ellipse(r() * w, r() * w, 6 + r() * 30, 4 + r() * 18, r() * 3, 0, 7); g.fill(); }
  }, 4, 2) });
  const WAIN = 1.0;
  function wall(w, x, z, ry) {
    const m = new T.Mesh(new T.PlaneGeometry(w, WAIN), wallM);
    m.position.set(x, WAIN / 2, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    const p = new T.Mesh(new T.PlaneGeometry(w, RH - WAIN), plasterM);
    p.position.set(x, WAIN + (RH - WAIN) / 2, z);
    p.rotation.y = ry;
    p.receiveShadow = true;
    room.add(m, p);
  }
  wall(RW * 2, 0, RB, 0);
  wall(RF - RB, -RW, (RF + RB) / 2, Math.PI / 2);
  wall(RF - RB, RW, (RF + RB) / 2, -Math.PI / 2);
  const darkWood = std(0x2e1a0c, 0.7);
  [[0, RB + 0.03, 0, RW * 2], [-RW + 0.03, (RF + RB) / 2, Math.PI / 2, RF - RB], [RW - 0.03, (RF + RB) / 2, -Math.PI / 2, RF - RB]].forEach(([x, z, ry, w]) => {
    [0.08, 1.0].forEach((y) => {
      const m = new T.Mesh(new T.BoxGeometry(w, y < 0.5 ? 0.16 : 0.06, 0.06), darkWood);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      room.add(m);
    });
  });
  // pencere (sol duvar) ve içeri süzülen ışık hüzmesi
  const winP = V(-RW + 0.05, 1.9, -1.7);
  const winC = new T.Mesh(new T.PlaneGeometry(1.1, 1.5), new T.MeshBasicMaterial({ color: 0xd8e2ff, fog: false }));
  winC.position.copy(winP);
  winC.rotation.y = Math.PI / 2;
  room.add(winC);
  [[0, 0.76, 1.2, 0.07], [0, -0.76, 1.2, 0.07], [0, 0, 0.06, 1.6], [0.58, 0, 0.07, 1.6], [-0.58, 0, 0.07, 1.6], [0, 0.25, 1.15, 0.04]].forEach(([dz, dy, w, h]) => {
    const b = new T.Mesh(new T.BoxGeometry(0.07, h, w), darkWood);
    b.position.set(winP.x + 0.02, winP.y + dy, winP.z + dz);
    room.add(b);
  });
  const shaftTex = canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.6, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const gx = g.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gx;
    g.fillRect(0, 0, w, h);
  });
  const shaftM = new T.MeshBasicMaterial({ color: 0xbfcfff, map: shaftTex, transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  const shaftEnd = V(-2.2, 0, -1.0);
  for (let i = 0; i < 1; i++) {
    const len = winP.distanceTo(shaftEnd);
    const sh = new T.Mesh(new T.CylinderGeometry(0.8 + i * 0.12, 0.6, len, 4, 1, true), shaftM);
    sh.position.copy(winP).add(shaftEnd).multiplyScalar(0.5);
    sh.quaternion.setFromUnitVectors(V(0, 1, 0), shaftEnd.clone().sub(winP).normalize());
    sh.rotateY(Math.PI / 4 + i * 0.3);
    room.add(sh);
  }

  // ---------- ışıklar ----------
  const hemi = new T.HemisphereLight(0x7a5238, 0x140a05, 1.15);
  const key = new T.DirectionalLight(0xffc890, 1.75);
  const fill = new T.DirectionalLight(0xbfd0ff, 0.22);
  key.castShadow = false;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 3;
  const keyTarget = new T.Object3D();
  tableG.add(hemi, key, fill, keyTarget);
  [hemi, key, fill].forEach((l) => l.layers.enable(1)); // üst tuvaldeki kol da aynı ışıkla
  key.target = keyTarget;
  // masanın üstüne düşen sıcak ışık halesi (zeminde)
  const pool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: softTex, color: 0xffb070, transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.01;
  pool.scale.set(7, 5, 1);
  room.add(pool);

  // gaz lambaları: titreyen nokta ışıklar
  const lamps = [];
  const brass = std(0x8a6a30, 0.35, { metalness: 0.7 });
  function lamp(p, intensity, dist) {
    const glow = new T.Sprite(new T.SpriteMaterial({ map: softTex, color: 0xffb060, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.setScalar(0.7);
    glow.position.copy(p);
    const flame = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new T.MeshBasicMaterial({ color: 0xffe0a0, fog: false }));
    flame.position.copy(p);
    const glass = new T.Mesh(new T.SphereGeometry(0.09, 16, 12), new T.MeshStandardMaterial({ color: 0xffd8a0, roughness: 0.1, transparent: true, opacity: 0.35, emissive: 0xff9a40, emissiveIntensity: 0.7 }));
    glass.scale.y = 1.4;
    glass.position.copy(p);
    const base = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 0.06, 12), brass);
    base.position.set(p.x, p.y - 0.15, p.z);
    room.add(glow, flame, glass, base);
    lamps.push({ L: null, glow, base: intensity, ph: Math.random() * 10 });
  }
  [V(-2.0, 2.4, RB + 0.15), V(1.2, 2.4, RB + 0.15), V(-RW + 0.15, 2.1, -0.2), V(RW - 0.15, 2.1, -0.4)].forEach((p) => lamp(p, 1.5, 7.5));

  // ---------- duman ve toz ----------
  const smoke = [];
  for (let i = 0; i < 8; i++) {
    const m = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: 0xc8b49c, transparent: true, opacity: 0.04 + Math.random() * 0.06, depthWrite: false }));
    m.position.set((Math.random() - 0.5) * (RW * 2 - 1), 1.5 + Math.random() * 1.5, RB + 0.3 + Math.random() * 4.5);
    m.scale.setScalar(1.4 + Math.random() * 2);
    m.userData = { v: V((Math.random() - 0.5) * 0.04, 0.01 + Math.random() * 0.02, (Math.random() - 0.5) * 0.03), rot: (Math.random() - 0.5) * 0.05 };
    room.add(m);
    smoke.push(m);
  }
  const puffs = [];
  const puffMat = new T.SpriteMaterial({ map: smokeTex, color: 0xd8ccbc, transparent: true, depthWrite: false });
  const dustN = 320;
  const dustG = new T.BufferGeometry();
  const dustP = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    const p = winP.clone().lerp(shaftEnd, Math.random());
    dustP[i * 3] = p.x + (Math.random() - 0.5) * 1.3;
    dustP[i * 3 + 1] = p.y + (Math.random() - 0.5) * 1.3;
    dustP[i * 3 + 2] = p.z + (Math.random() - 0.5) * 1.3;
  }
  dustG.setAttribute('position', new T.BufferAttribute(dustP, 3));
  const dustM = new T.PointsMaterial({ map: softTex, color: 0xfff0d0, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
  room.add(new T.Points(dustG, dustM));

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
    const eye = pick(['#4a2e14', '#3a5a3a', '#2a4a6a', '#5a3a1a', '#3a3020']);
    if (female) {
      return {
        female: true, eye,
        skin: pick(['#f2cdb0', '#efc29c', '#e2ae80', '#d29a6a']),
        shirt: pick(['#efe6d4', '#e8dcc6', '#d8c8e0', '#c8d8e0']),
        dress: pick(['#3a2a30', '#2a3040', '#4a3a2a', '#2a2a2a', '#5a2a30']),
        cardigan: pick(['#7a2a3a', '#2f4a6a', '#6a5a3a', '#3a5a4a', '#8a6a4a', '#5a3a5a']),
        hair: pick(['#1a120c', '#3a2010', '#6a3a1c', '#8a4a1c', '#b8884a']),
        style: pick(['long', 'bob', 'bun', 'pony', 'long']),
        scarf: r() < 0.4 ? pick(['#7a2a4a', '#3a5a7a', '#c8b89a', '#5a6a3a', '#8a4a2a', '#d8c8d8']) : null,
      };
    }
    const coat = r() < 0.65 ? pick(['#4a3a2a', '#3a3a3e', '#2a2e3a', '#5a4a3a', '#2a2622']) : null;
    return {
      female: false, eye,
      skin: pick(['#eec4a2', '#e2b08a', '#d4a07a', '#c08a62']),
      shirt: pick(['#e8e2d4', '#c8d0d8', '#d8cdb4', '#b8c0c8', '#e0d8c8']),
      vest: !coat || r() < 0.4 ? pick(['#3a2a1e', '#2a2a2a', '#4a3a2a', '#5a5048', '#3a3a4a']) : null,
      coat,
      pants: pick(['#3a3026', '#2e2a24', '#2a2a30', '#3a3a3a']),
      hair: pick(['#1a120c', '#2a1c12', '#4a4038', '#8a8278', '#b8b0a8', '#6a5a48']),
      cap: r() < 0.6 ? pick(['#4a4038', '#2a2622', '#5a5a5a', '#6a5a48', '#3a3a44']) : null,
      beard: pick(['stubble', 'none', 'none', 'stubble', 'full']),
      stache: r() < 0.8,
      cig: r() < 0.35,
      style: pick(['quiff', 'part', 'buzz', 'quiff', 'part', 'bald']),
    };
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

  function limbMesh(r, mat) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r * 0.92, 1, 14), mat);
    m.userData.set = (a, b) => {
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.scale.set(1, Math.max(0.001, a.distanceTo(b)), 1);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    };
    return m;
  }
  function ball(r, mat, p) {
    const m = new T.Mesh(new T.SphereGeometry(r, 18, 14), mat);
    if (p) m.position.copy(p);
    return m;
  }
  const CARD_W = 0.085;
  const CARD_H = 0.12;
  const cardGeo = new T.BoxGeometry(CARD_W, CARD_H, 0.004).translate(0, CARD_H / 2, 0);
  const cardWhite = std(0xf6f2e6, 0.7);
  const backMats = { red: std(0xffffff, 0.6, { map: backTex('red') }), blue: std(0xffffff, 0.6, { map: backTex('blue') }) };
  const glint = new T.MeshBasicMaterial({ color: 0xffffff });

  // ---------- çizgi film karakterleri: büyük yuvarlak baş, iri gözler, toon gölgelendirme ----------
  const toonRamp = (() => {
    const t = new T.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, T.RedFormat);
    t.minFilter = t.magFilter = T.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  })();
  const toonCache = {};
  // karakter malzemeleri: renk + (isteğe bağlı) çift yüz / saydamlık; pürüzlülük vb. yok sayılır
  function toon(color, _r, extra) {
    const c = new T.Color(color);
    const key2 = c.getHexString() + (extra ? JSON.stringify(Object.keys(extra).sort().map((k) => [k, typeof extra[k] === 'object' ? 0 : extra[k]])) : '');
    if (toonCache[key2]) return toonCache[key2];
    const p = { color: c, gradientMap: toonRamp };
    if (extra) ['side', 'transparent', 'opacity', 'map', 'emissive', 'emissiveIntensity'].forEach((k) => { if (extra[k] !== undefined) p[k] = extra[k]; });
    return (toonCache[key2] = new T.MeshToonMaterial(p));
  }
  const tube = (pts, r, mat, seg = 16) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z))), seg, r, 8, false), mat);
  const capsule = (r, len, mat) => new T.Mesh(new T.CapsuleGeometry(r, len, 6, 14), mat);
  const HEAD_S = 1.32; // baş, gövdeye göre iri (çizgi film oranı)

  function buildHead(head, o, F, _skin, _skinD, _hairM, _dark) {
    const std = toon;
    head.scale.setScalar(HEAD_S);
    head.position.y += 0.045;
    const skin = std(o.skin);
    const skinD = std(new T.Color(o.skin).multiplyScalar(0.9));
    const hairM = std(o.hair);
    const hairL = std(new T.Color(o.hair).multiplyScalar(1.18));
    const ink = std(0x2a1a18);
    const white = std(0xffffff);
    // yuvarlak baş ve kulaklar
    const R = 0.108;
    const skull = new T.Mesh(new T.SphereGeometry(R, 40, 30), skin);
    skull.scale.set(1.04, 0.97, 0.95);
    head.add(skull);
    [-1, 1].forEach((s) => {
      const ear = ball(0.026, skinD, V(s * 0.104, -0.008, -0.004));
      ear.scale.set(0.5, 0.9, 0.7);
      head.add(ear);
    });
    // iri gözler: beyaz oval, kocaman gözbebeği, iki parıltı
    const eyes = [-1, 1].map((s) => {
      const eye = new T.Group();
      eye.position.set(s * 0.04, 0.008, 0.088);
      eye.rotation.y = s * 0.18;
      const w = ball(0.024, white);
      w.scale.set(0.85, 1.12, 0.5);
      const pupil = ball(0.0165, std(new T.Color(o.eye).multiplyScalar(0.55)), V(0, -0.002, 0.009));
      pupil.scale.set(0.95, 1.05, 0.45);
      const shine = ball(0.0055, white, V(0.006, 0.007, 0.0165));
      const shine2 = ball(0.0028, white, V(-0.005, -0.006, 0.0165));
      eye.add(w, pupil, shine, shine2);
      if (F) {
        // kirpikler: göz kenarında üç kıvrık çizgi
        [0, 1, 2].forEach((k) => {
          const l = capsule(0.0018, 0.008, ink);
          l.position.set(s * (0.012 + k * 0.004), 0.019 - k * 0.004, 0.006);
          l.rotation.z = -s * (0.6 + k * 0.35);
          eye.add(l);
        });
      }
      head.add(eye);
      // kalın, yumuşak kaşlar
      const br = capsule(F ? 0.0042 : 0.0065, 0.026, F ? std(new T.Color(o.hair).multiplyScalar(0.85)) : hairM);
      br.rotation.z = Math.PI / 2 + s * (F ? -0.12 : 0.1);
      br.position.set(s * 0.041, 0.05, 0.096);
      head.add(br);
      return eye;
    });
    // küçük yuvarlak burun
    const nose = ball(0.0135, skinD, V(0, -0.016, 0.104));
    nose.scale.set(1, 0.85, 0.8);
    head.add(nose);
    // gülümseyen ağız
    const lipC = F ? std(0xd2525e) : ink;
    head.add(tube([[-0.026, -0.042, 0.094], [-0.012, -0.053, 0.1], [0, -0.055, 0.101], [0.012, -0.053, 0.1], [0.026, -0.042, 0.094]], F ? 0.0042 : 0.0032, lipC));
    // yanak allığı
    const blushM = std(0xff8a8a, 0, { transparent: true, opacity: F ? 0.55 : 0.32 });
    [-1, 1].forEach((s) => {
      const b = ball(0.016, blushM, V(s * 0.06, -0.03, 0.082));
      b.scale.set(1.2, 0.7, 0.4);
      b.rotation.y = s * 0.5;
      head.add(b);
    });
    // sakal / bıyık
    if (!F && o.beard === 'full') {
      const bd = new T.Mesh(new T.SphereGeometry(R * 0.86, 32, 20, 0, Math.PI, Math.PI * 0.55, Math.PI * 0.4), hairM);
      bd.scale.set(1.12, 0.95, 1.05);
      bd.position.set(0, -0.03, 0.006);
      head.add(bd);
    }
    if (!F && o.stache) {
      [-1, 1].forEach((s) => {
        const m = capsule(0.0075, 0.018, hairM);
        m.rotation.z = Math.PI / 2 + s * 0.35;
        m.position.set(s * 0.014, -0.032, 0.103);
        head.add(m);
      });
    }
    // başörtüsü veya saç
    if (F && o.scarf) {
      const sm = std(o.scarf, 0, { side: T.DoubleSide });
      const wrapS = new T.Mesh(new T.SphereGeometry(R * 1.1, 40, 28, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.82), sm);
      wrapS.scale.set(1.04, 1.04, 1.0);
      wrapS.position.y = 0.004;
      const rim = new T.Mesh(new T.TorusGeometry(R * 0.93, 0.011, 10, 40, Math.PI * 1.25), sm);
      rim.rotation.set(0.12, 0, -Math.PI * 0.125);
      rim.position.set(0, -0.004, 0.035);
      const drape = new T.Mesh(new T.CylinderGeometry(0.075, 0.13, 0.09, 32, 1, true), sm);
      drape.position.set(0, -0.112, -0.005);
      head.add(wrapS, rim, drape);
      const pin = ball(0.006, std(0xf2d27a), V(0.07, -0.06, 0.07));
      head.add(pin);
    } else if (F) {
      // tepe + yana taranmış perçem
      const cap = new T.Mesh(new T.SphereGeometry(R * 1.07, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM);
      cap.scale.set(1.03, 1.0, 1.02);
      cap.rotation.x = -0.32;
      cap.position.y = 0.006;
      const bang = ball(0.05, hairM, V(-0.035, 0.07, 0.07));
      bang.scale.set(1.5, 0.55, 0.65);
      bang.rotation.z = 0.35;
      const bang2 = ball(0.035, hairL, V(0.045, 0.075, 0.065));
      bang2.scale.set(1.3, 0.5, 0.6);
      bang2.rotation.z = -0.4;
      const back = new T.Mesh(new T.SphereGeometry(R * 1.09, 32, 20, Math.PI, Math.PI, 0, Math.PI * 0.72), hairM);
      head.add(cap, bang, bang2, back);
      const st = o.style;
      if (st === 'long' || st === 'bob') {
        const L = st === 'long' ? 0.17 : 0.07;
        const mass = capsule(0.085, L, hairM);
        mass.scale.set(1.28, 1, 0.62);
        mass.position.set(0, -0.06 - L / 2, -0.055);
        head.add(mass);
        [-1, 1].forEach((s) => {
          const side = capsule(0.032, L * 0.8 + 0.03, hairM);
          side.position.set(s * 0.093, -0.045 - L * 0.4, -0.01);
          side.rotation.z = s * 0.08;
          head.add(side);
          const tip = ball(0.034, hairL, V(s * 0.095, -0.065 - L * 0.85, 0.0));
          tip.scale.set(1, 0.7, 0.9);
          head.add(tip);
        });
      } else if (st === 'bun') {
        const bun = ball(0.048, hairM, V(0, 0.105, -0.06));
        const ring = new T.Mesh(new T.TorusGeometry(0.03, 0.007, 8, 20), std(0xf2a6c0));
        ring.position.set(0, 0.085, -0.045);
        ring.rotation.x = 1.0;
        head.add(bun, ring);
      } else {
        const tail = capsule(0.032, 0.16, hairM);
        tail.position.set(0, -0.035, -0.135);
        tail.rotation.x = -0.32;
        const tie = new T.Mesh(new T.TorusGeometry(0.03, 0.008, 8, 20), std(0x5ab0e8));
        tie.position.set(0, 0.04, -0.112);
        tie.rotation.x = 1.25;
        head.add(tail, tie);
      }
    } else {
      // erkek saçı: tepe + model
      const st = o.style;
      const cap = new T.Mesh(new T.SphereGeometry(R * 1.06, 40, 24, 0, Math.PI * 2, 0, Math.PI * (st === 'bald' ? 0.0 : 0.42)), hairM);
      cap.scale.set(1.03, 1.0, 1.02);
      cap.rotation.x = -0.4;
      cap.position.y = 0.004;
      const back = new T.Mesh(new T.SphereGeometry(R * 1.07, 32, 18, Math.PI, Math.PI, Math.PI * (st === 'bald' ? 0.35 : 0.05), Math.PI * 0.55), hairM);
      head.add(back);
      if (st !== 'bald') head.add(cap);
      if (st === 'quiff') {
        const q = ball(0.05, hairL, V(0.01, 0.098, 0.05));
        q.scale.set(1.35, 0.6, 0.9);
        q.rotation.x = -0.3;
        head.add(q);
      } else if (st === 'part') {
        const p = ball(0.055, hairM, V(-0.02, 0.09, 0.055));
        p.scale.set(1.45, 0.5, 0.85);
        p.rotation.z = 0.22;
        head.add(p);
      }
      [-1, 1].forEach((s) => {
        const sb = capsule(0.01, 0.02, hairM);
        sb.position.set(s * 0.1, 0.012, 0.028);
        head.add(sb);
      });
    }
    // kasket
    if (!F && o.cap) {
      const capM = std(o.cap);
      const dome = new T.Mesh(new T.SphereGeometry(R * 1.13, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), capM);
      dome.scale.set(1.03, 0.5, 1.1);
      dome.position.set(0, 0.045, 0.01);
      dome.rotation.x = 0.1;
      const band = new T.Mesh(new T.CylinderGeometry(R * 1.1, R * 1.1, 0.026, 36, 1, true), capM);
      band.scale.set(1.0, 1, 1.03);
      band.position.set(0, 0.04, 0.004);
      const peak = new T.Mesh(new T.CylinderGeometry(0.082, 0.082, 0.01, 28, 1, false, -Math.PI / 2, Math.PI), capM);
      peak.scale.z = 0.62;
      peak.position.set(0, 0.04, 0.1);
      peak.rotation.x = 0.18;
      head.add(dome, band, peak, ball(0.009, capM, V(0, 0.1, 0.012)));
    }
    return eyes;
  }

  // Bir grubun doğrudan çocuğu olan, kıpırdamayan ağları malzemeye göre birleştirir (saydamlar ve 'skip' içindekiler hariç)
  const NOSKIP = new Set();
  function mergeStatic(group, skip) {
    const buckets = new Map();
    let cast = false;
    group.children.slice().forEach((m) => {
      if (!m.isMesh || skip.has(m) || Array.isArray(m.material) || m.material.transparent) return;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      m.updateMatrix();
      g.applyMatrix4(m.matrix);
      if (m.castShadow) cast = true;
      if (!buckets.has(m.material)) buckets.set(m.material, []);
      buckets.get(m.material).push(g);
      group.remove(m);
    });
    buckets.forEach((geos, mat) => {
      let n = 0;
      geos.forEach((g) => { n += g.attributes.position.count; });
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const hasUv = geos.every((g) => g.attributes.uv);
      const uv = hasUv ? new Float32Array(n * 2) : null;
      let o = 0;
      geos.forEach((g) => {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        if (uv) uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count;
        g.dispose();
      });
      const mg = new T.BufferGeometry();
      mg.setAttribute('position', new T.BufferAttribute(pos, 3));
      mg.setAttribute('normal', new T.BufferAttribute(nor, 3));
      if (uv) mg.setAttribute('uv', new T.BufferAttribute(uv, 2));
      mg.computeBoundingSphere();
      const mm = new T.Mesh(mg, mat);
      mm.castShadow = cast;
      group.add(mm);
    });
  }

  // Karakter: dış çerçevede y = 0 oturak hizası (zemin y = -0.42), +z masaya bakar
  function build(o) {
    const std = toon; // karakterler çizgi film gölgelendirmesiyle
    const F = o.female;
    const skin = std(o.skin, 0.62);
    const skinD = std(new T.Color(o.skin).multiplyScalar(0.84), 0.7);
    const shirt = std(o.shirt, 0.85);
    const cloth = std(F ? o.dress : o.vest || o.shirt, 0.75, { side: T.DoubleSide });
    const cardi = std(F ? o.cardigan : 0x000000, 0.9, { side: T.DoubleSide });
    const pants = std(F ? o.dress : o.pants, 0.9);
    const hairM = std(o.hair, 0.95);
    const dark = std(0x1a0f08, 0.5);
    const boots = std(0x2a170b, 0.45);
    const root = new T.Group();
    const body = new T.Group(); // zemin çerçevesi
    body.position.y = -0.42;
    root.add(body);

    // sandalye
    const wood = std(0x3e2412, 0.6);
    const seat = new T.Mesh(new T.BoxGeometry(0.46, 0.05, 0.44), wood);
    seat.position.y = 0.42;
    body.add(seat);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const l = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.42, 8), wood);
      l.position.set(x * 0.2, 0.21, z * 0.19);
      body.add(l);
    });
    [-1, 1].forEach((x) => { const p = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.6, 8), wood); p.position.set(x * 0.2, 0.72, -0.21); body.add(p); });
    [0.68, 0.84, 0.98].forEach((y) => { const s = new T.Mesh(new T.BoxGeometry(0.42, 0.05, 0.025), wood); s.position.set(0, y, -0.21); body.add(s); });

    // bacaklar ve çizmeler
    [-1, 1].forEach((s) => {
      const th = limbMesh(0.075, pants);
      th.userData.set(V(s * 0.1, 0.5, -0.02), V(s * 0.11, 0.5, 0.38));
      const sn = limbMesh(0.058, F ? dark : pants);
      sn.userData.set(V(s * 0.11, 0.49, 0.4), V(s * 0.12, 0.1, 0.44));
      body.add(th, sn, ball(0.06, F ? dark : pants, V(s * 0.11, 0.49, 0.39)));
      const boot = new T.Mesh(new T.CylinderGeometry(0.062, 0.066, 0.22, 14), boots);
      boot.position.set(s * 0.12, 0.13, 0.44);
      const toe = ball(0.065, boots, V(s * 0.12, 0.035, 0.5));
      toe.scale.set(0.9, 0.5, 1.6);
      body.add(boot, toe);
    });
    if (F) {
      const skirt = new T.Mesh(new T.CylinderGeometry(0.2, 0.34, 0.48, 32, 1, true), cloth);
      skirt.position.set(0, 0.34, 0.12);
      skirt.scale.z = 1.25;
      const lap = new T.Mesh(new T.BoxGeometry(0.36, 0.06, 0.42), cloth);
      lap.position.set(0, 0.54, 0.17);
      body.add(skirt, lap);
    }

    // gövde (kalça ekseninden eğilir)
    const torso = new T.Group();
    torso.position.y = 0.5;
    body.add(torso);
    const chest = new T.Mesh(new T.CylinderGeometry(F ? 0.15 : 0.175, F ? 0.17 : 0.19, 0.56, 28), shirt);
    chest.scale.z = 0.66;
    chest.position.y = 0.28;
    const shoulder = new T.Mesh(new T.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), F ? cardi : shirt);
    shoulder.scale.set(F ? 0.92 : 1.08, 0.42, 0.68);
    shoulder.position.y = 0.55;
    torso.add(chest, shoulder);
    // gömlek / bluz yakası
    [-1, 1].forEach((s) => {
      const col = new T.Mesh(new T.ConeGeometry(0.035, 0.07, 3), shirt);
      col.rotation.set(-0.3, 0, s * 2.4);
      col.scale.z = 0.3;
      col.position.set(s * 0.035, 0.6, 0.07);
      torso.add(col);
    });
    if (F) {
      // önü açık hırka ve kolye
      const hirka = new T.Mesh(new T.CylinderGeometry(0.162, 0.185, 0.56, 32, 1, true, 0.45, Math.PI * 2 - 0.9), cardi);
      hirka.scale.z = 0.7;
      hirka.position.y = 0.27;
      torso.add(hirka);
      const neckl = new T.Mesh(new T.TorusGeometry(0.058, 0.006, 6, 24), std(0xd8b04a, 0.3, { metalness: 0.7 }));
      neckl.rotation.x = Math.PI / 2 - 0.3;
      neckl.position.set(0, 0.6, 0.02);
      torso.add(neckl, ball(0.012, std(0xd8b04a, 0.2, { metalness: 0.8 }), V(0, 0.565, 0.085)));
    } else {
      if (o.vest) {
        const vest = new T.Mesh(new T.CylinderGeometry(0.183, 0.198, 0.5, 32, 1, true, 0.38, Math.PI * 2 - 0.76), cloth);
        vest.scale.z = 0.68;
        vest.position.y = 0.27;
        torso.add(vest);
        const btn = std(0x2a2420, 0.4);
        for (let i = 0; i < 4; i++) [-1, 1].forEach((s) => torso.add(ball(0.007, btn, V(s * 0.05, 0.12 + i * 0.08, 0.125))));
      }
      if (o.coat) {
        const coatM = std(o.coat, 0.85, { side: T.DoubleSide });
        const coat = new T.Mesh(new T.CylinderGeometry(0.195, 0.215, 0.58, 32, 1, true, 0.55, Math.PI * 2 - 1.1), coatM);
        coat.scale.z = 0.7;
        coat.position.y = 0.27;
        const csh = new T.Mesh(new T.SphereGeometry(0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), coatM);
        csh.scale.set(1.08, 0.42, 0.68);
        csh.position.y = 0.55;
        torso.add(coat, csh);
      }
    }
    const neck = new T.Mesh(new T.CylinderGeometry(0.048, 0.055, 0.12, 14), skinD);
    neck.position.y = 0.64;
    torso.add(neck);

    // baş
    const head = new T.Group();
    head.position.y = 0.79;
    torso.add(head);
    const eyes = buildHead(head, o, F, skin, skinD, hairM, dark);
    // sigara (bazı erkeklerde)
    let cig = null;
    if (!F && o.cig) {
      const cg = new T.Group();
      cg.position.set(0.03, -0.06, 0.1);
      cg.rotation.set(0.25, 0.45, 0);
      const stick = new T.Mesh(new T.CylinderGeometry(0.0045, 0.0045, 0.07, 8), std(0xeee8dc, 0.8));
      stick.rotation.x = Math.PI / 2;
      stick.position.z = 0.035;
      const tip = ball(0.005, new T.MeshBasicMaterial({ color: 0xff5a1a }), V(0, 0, 0.071));
      const tipGlow = new T.Sprite(new T.SpriteMaterial({ map: softTex, color: 0xff6a20, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      tipGlow.scale.setScalar(0.05);
      tipGlow.position.copy(tip.position);
      cg.add(stick, tip, tipGlow);
      head.add(cg);
      cig = { tip, tipGlow, last: 0 };
    }

    // kollar ve eller (her karede omuzdan ele yeniden kurulur)
    const sleeve = std(F ? o.cardigan : o.coat || o.shirt, 0.85);
    const cuffM = std(0xe8e0cc, 0.8);
    const arms = [-1, 1].map((s) => {
      const up = limbMesh(0.05, sleeve);
      const fo = limbMesh(0.042, sleeve);
      const elb = ball(0.048, sleeve);
      const cuff = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 12), cuffM);
      const hand = new T.Group();
      const palm = ball(0.04, skin);
      palm.scale.set(0.8, 1, 0.55);
      const thumb = new T.Mesh(new T.CapsuleGeometry(0.012, 0.03, 4, 8), skin);
      thumb.position.set(-s * 0.025, 0.02, 0.02);
      thumb.rotation.z = -s * 0.8;
      hand.add(palm, thumb);
      // kağıtları kavrayan dört parmak
      for (let fi = 0; fi < 4; fi++) {
        const fg = new T.Mesh(new T.CapsuleGeometry(0.0075, 0.03, 4, 8), skin);
        fg.position.set((fi - 1.5) * 0.014, 0.045 - Math.abs(fi - 1.5) * 0.004, 0.012);
        fg.rotation.x = 0.7;
        hand.add(fg);
      }
      body.add(up, fo, elb, cuff, hand);
      return { s, up, fo, elb, cuff, hand };
    });
    // kağıt yelpazesi: iki elin arasında, kendine dönük
    const cards = new T.Group();
    cards.position.set(0, 0.6, 0.24);
    cards.rotation.x = -0.4;
    root.add(cards);
    // kıpırdamayan parçalar malzemeye göre tek ağa birleşir: çizim çağrısı sayısı yarıdan fazla düşer
    const moving = new Set();
    arms.forEach((a) => [a.up, a.fo, a.elb, a.cuff, a.hand].forEach((m) => moving.add(m)));
    mergeStatic(body, moving);
    mergeStatic(torso, moving);
    mergeStatic(head, moving);
    eyes.forEach((e) => mergeStatic(e, NOSKIP));
    arms.forEach((a) => mergeStatic(a.hand, NOSKIP));
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { root, body, torso, head, eyes, arms, cards, cig };
  }

  // omuz → dirsek → el (eller zemin çerçevesinde)
  const sh0 = V(0, 0, 0);
  const mid0 = V(0, 0, 0);
  function poseArms(f, targets) {
    f.torso.updateMatrix();
    f.arms.forEach((a, i) => {
      const hand = targets[i];
      sh0.set(a.s * 0.19, 0.53, -0.01).applyMatrix4(f.torso.matrix);
      mid0.copy(sh0).lerp(hand, 0.5);
      mid0.x += a.s * 0.08;
      mid0.y -= 0.12;
      mid0.z -= 0.02;
      a.up.userData.set(sh0, mid0);
      a.fo.userData.set(mid0, hand);
      a.elb.position.copy(mid0);
      a.hand.position.copy(hand);
      a.cuff.position.copy(mid0).lerp(hand, 0.88);
      a.cuff.quaternion.copy(a.fo.quaternion);
      a.hand.quaternion.copy(a.fo.quaternion);
    });
  }

  const SEATS = {
    top: { yaw: 0 },
    left: { yaw: Math.PI / 2 },
    right: { yaw: -Math.PI / 2 },
  };
  const seats = {};

  function setCards(s, cols) {
    const key2 = cols.join('');
    if (s.cardKey === key2) return;
    s.cardKey = key2;
    const g = s.fig.cards;
    while (g.children.length) { const c0 = g.children[0]; g.remove(c0); if (c0.geometry !== cardGeo) c0.geometry.dispose(); }
    const n = cols.length;
    const mid = (n - 1) / 2;
    const step = n > 1 ? Math.min(0.13, 1.25 / (n - 1)) : 0;
    cols.forEach((c, i) => {
      const m = new T.Mesh(cardGeo, backMats[c] || backMats.blue);
      m.rotation.z = -(i - mid) * step;
      m.position.z = i * 0.0035;
      m.castShadow = true;
      g.add(m);
    });
    mergeStatic(g, NOSKIP);
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
      s = { slot, seed, female: !!female, g, body, yaw, fig, ring, turn: false, actUntil: 0, nextBlink: 0, blinkUntil: 0, leanNow: 0, glance: 0, glanceT: 0, phase: (seed % 628) / 100, baseHeadYaw: -SEATS[slot].yaw * 0.35, cardKey: '' };
      seats[slot] = s;
      placeSeat(s);
    }
    s.turn = !!turn;
    setCards(s, cols);
    return s;
  }
  function setTurn(slot, on) { if (seats[slot]) seats[slot].turn = !!on; }
  // act(slot): kısa genel uzanma. act(slot, {x,y}, dur): el ekrandaki o noktanın masadaki yerine gider,
  // orada kısa durur ve geri çekilir (kağıt bırakma / alma). Kol fazla uzamasın diye mesafe sınırlı.
  const rayO = V(0, 0, 0);
  const rayD = V(0, 0, 0);
  const plN = V(0, 0, 0);
  const plP = V(0, 0, 0);
  const restR = V(0.07, 1.02, 0.22);
  function tablePoint(x, y) {
    tableG.updateMatrixWorld(true);
    plP.setFromMatrixPosition(tableG.matrixWorld);
    plN.set(0, 0, 1).transformDirection(tableG.matrixWorld);
    rayO.copy(camera.position);
    rayD.set(x, -y, 0).sub(rayO).normalize();
    const den = plN.dot(rayD);
    if (Math.abs(den) < 1e-6) return null;
    const tt = plP.clone().sub(rayO).dot(plN) / den;
    return rayO.clone().addScaledVector(rayD, tt);
  }
  function act(slot, to, dur) {
    const s = seats[slot];
    if (!s) return;
    if (!to) { s.actUntil = performance.now() + 900; return; }
    const w = tablePoint(to.x, to.y);
    if (!w) { s.actUntil = performance.now() + 900; return; }
    const fr = s.fig.arms[1].hand.parent;
    fr.updateMatrixWorld(true);
    const loc = fr.worldToLocal(w);
    loc.y += 0.035; // masanın biraz üstünde dursun
    const d = loc.clone().sub(restR);
    const MAX = 1.6; // masaya kadar uzanabilsin (çizgi film kolu)
    if (d.length() > MAX) loc.copy(restR).addScaledVector(d.normalize(), MAX);
    s.reachLocal = loc;
    s.actStart = performance.now();
    s.actDur = dur || 1200;
  }
  // 0 → 1 (uzan) → 1 (bırak/al) → 0 (geri çek)
  function reachProfile(s, now) {
    if (!s.reachLocal) return -1;
    const p = (now - s.actStart) / s.actDur;
    if (p >= 1) { s.reachLocal = null; return -1; }
    const ease = (u) => u * u * (3 - 2 * u);
    if (p < 0.42) return ease(p / 0.42);
    if (p < 0.6) return 1;
    return ease(1 - (p - 0.6) / 0.4);
  }

  // ---------- yerde duran tebeşir panoları: solda masa olayları, sağda puanlar ----------
  const BW = 640;
  const BH = 820;
  const CHALK = '"Segoe Print", "Comic Sans MS", "Bradley Hand", cursive';
  const slate = (() => {
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(BW / 2, BH * 0.45, 60, BW / 2, BH / 2, BH * 0.75);
    gr.addColorStop(0, '#2c3a32'); gr.addColorStop(1, '#141c18');
    g.fillStyle = gr; g.fillRect(0, 0, BW, BH);
    const r = rng(17);
    for (let i = 0; i < 90; i++) { // silinmiş tebeşir izleri
      g.fillStyle = `rgba(230,235,225,${0.012 + r() * 0.025})`;
      g.beginPath(); g.ellipse(r() * BW, r() * BH, 30 + r() * 120, 8 + r() * 30, r() * 3, 0, 7); g.fill();
    }
    return c;
  })();
  function makeBoard(side) {
    const c = document.createElement('canvas');
    c.width = BW; c.height = BH;
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = maxAniso;
    const g = new T.Group();
    const frameM = std(0x4a2a14, 0.55);
    const panel = new T.Mesh(new T.PlaneGeometry(1, BH / BW), new T.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.9 }));
    const ph = BH / BW;
    const tilt = new T.Group(); // pano biraz geriye yaslı
    tilt.position.y = 0.42;
    tilt.rotation.x = -0.12;
    panel.position.set(0, ph / 2, 0.026);
    const back = new T.Mesh(new T.BoxGeometry(1.08, ph + 0.08, 0.05), frameM);
    back.position.set(0, ph / 2, 0);
    const tray = new T.Mesh(new T.BoxGeometry(1.0, 0.03, 0.07), frameM);
    tray.position.set(0, -0.01, 0.05);
    const chalk = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.08, 8), std(0xf4f0e6, 0.9));
    chalk.rotation.z = Math.PI / 2; chalk.position.set(0.3, 0.015, 0.06);
    tilt.add(back, panel, tray, chalk);
    g.add(tilt);
    // ayaklı sehpa: iki ön ayak + arka destek
    [-1, 1].forEach((s) => {
      const leg = new T.Mesh(new T.BoxGeometry(0.05, 1.7, 0.05), frameM);
      leg.position.set(s * 0.5, 0.8, -0.07);
      leg.rotation.x = -0.12;
      g.add(leg);
    });
    const rear = new T.Mesh(new T.BoxGeometry(0.05, 1.25, 0.05), frameM);
    rear.position.set(0, 0.6, -0.42);
    rear.rotation.x = 0.32;
    g.add(rear);
    g.rotation.y = side < 0 ? 0.16 : -0.16;
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = m !== panel; } });
    g.visible = false;
    room.add(g);
    return { side, g, panel, c, ctx: c.getContext('2d'), tex };
  }
  const boards = { left: makeBoard(-1), right: makeBoard(1) };
  function chalkText(g, text, x, y, size, color, align = 'left', weight = 'bold') {
    g.font = `${weight} ${size}px ${CHALK}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,255,240,.35)';
    g.shadowBlur = 3;
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.shadowBlur = 0;
  }
  function chalkLine(g, x1, y1, x2, y2, w = 3) {
    g.strokeStyle = 'rgba(240,238,228,.75)';
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo((x1 + x2) / 2 + 1, (y1 + y2) / 2 - 1); g.lineTo(x2, y2); g.stroke();
  }
  function wrap(g, text, maxW) {
    const words = String(text).split(/\s+/);
    const out = [];
    let line = '';
    words.forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }
  const WHITE = '#f3f0e6';
  const YEL = '#ffe08a';
  const PINK = '#ff9f92';
  let logKey = '';
  function setLog(lines) {
    return; // 3B pano kapalı (sol üstteki olay satırı kullanılıyor)
    const key2 = JSON.stringify(lines || []);
    if (key2 === logKey) return;
    logKey = key2;
    const b = boards.left;
    const g = b.ctx;
    g.drawImage(slate, 0, 0);
    chalkText(g, 'MASADA OLANLAR', BW / 2, 62, 46, YEL, 'center');
    chalkLine(g, 70, 100, BW - 70, 104, 3);
    const items = (lines || []).slice(-5);
    // en yeni altta; sığmazsa eskiler düşer
    const size = 46;
    g.font = `bold ${size}px ${CHALK}`;
    const blocks = items.map((l) => wrap(g, l, BW - 90));
    let total = blocks.reduce((a, bl) => a + bl.length * 56 + 20, 0);
    while (total > BH - 150 && blocks.length > 1) { total -= blocks[0].length * 56 + 20; blocks.shift(); }
    let y = 150;
    blocks.forEach((bl, i) => {
      const newest = i === blocks.length - 1;
      bl.forEach((ln, j) => {
        chalkText(g, (j === 0 ? '• ' : '   ') + ln, 40, y, size, newest ? YEL : WHITE, 'left', newest ? 'bold' : 'normal');
        y += 56;
      });
      y += 20;
    });
    b.tex.needsUpdate = true;
  }
  let scoreKey = '';
  // d: { names[4], rows[[4]], totalHands, final: {first, second} | null, team, solo }
  function setScores(d) {
    return; // 3B pano kapalı (sol üstteki puan satırı kullanılıyor)
    const key2 = JSON.stringify(d || {});
    if (key2 === scoreKey) return;
    scoreKey = key2;
    const b = boards.right;
    const g = b.ctx;
    g.drawImage(slate, 0, 0);
    chalkText(g, 'PUANLAR', BW / 2, 58, 50, YEL, 'center');
    if (!d) { b.tex.needsUpdate = true; return; }
    const x0 = 70;
    const colW = (BW - x0 - 24) / 4;
    const head = 120;
    const maxRows = 11;
    const start = Math.max(0, d.rows.length - maxRows);
    const rows = d.rows.slice(start);
    const rowH = 44;
    const totY = head + 40 + maxRows * rowH + 16;
    for (let c = 0; c < 4; c++) {
      const cx = x0 + c * colW + colW / 2;
      const nm = d.names[c] || '—';
      chalkText(g, nm.length > 7 ? nm.slice(0, 6) + '.' : nm, cx, head, 32, WHITE, 'center');
      if (c > 0) chalkLine(g, x0 + c * colW, head - 22, x0 + c * colW + 2, totY + 40, 2);
    }
    chalkLine(g, 24, head + 26, BW - 24, head + 28, 3);
    for (let k = 0; k < Math.min(maxRows, d.totalHands - start); k++) {
      const no = start + k + 1;
      const fin = d.solo && no === d.totalHands;
      chalkText(g, fin ? 'F' : String(no), 40, head + 60 + k * rowH, 26, fin ? PINK : 'rgba(243,240,230,.6)', 'center', 'normal');
    }
    rows.forEach((row, k) => {
      for (let c = 0; c < 4; c++) {
        const finRow = d.final && start + k === d.totalHands - 1;
        if (finRow && (c === d.final.first || c === d.final.second)) {
          chalkText(g, c === d.final.first ? '1.' : '2.', x0 + c * colW + colW / 2, head + 60 + k * rowH, 32, '#9fe8a0', 'center');
          continue;
        }
        const v = row[c];
        chalkText(g, String(v), x0 + c * colW + colW / 2, head + 60 + k * rowH, 32, v < 0 ? PINK : WHITE, 'center', 'normal');
      }
    });
    chalkLine(g, 24, totY, BW - 24, totY + 2, 3);
    chalkLine(g, 24, totY + 7, BW - 24, totY + 8, 2);
    for (let c = 0; c < 4; c++) {
      const t = d.rows.reduce((a, h) => a + h[c], 0);
      chalkText(g, String(t), x0 + c * colW + colW / 2, totY + 40, 40, t < 0 ? PINK : YEL, 'center');
    }
    if (d.team) {
      const tA = d.rows.reduce((a, h) => a + h[0] + h[2], 0);
      const tB = d.rows.reduce((a, h) => a + h[1] + h[3], 0);
      chalkText(g, `A: ${tA}`, BW * 0.28, totY + 92, 38, YEL, 'center');
      chalkText(g, `B: ${tB}`, BW * 0.72, totY + 92, 38, YEL, 'center');
    }
    b.tex.needsUpdate = true;
  }
  setLog([]);
  setScores(null);

  // panoları ekranın yan boşluklarına sığdır: masanın ön köşesi ile ekran kenarı arasına
  const pj = V(0, 0, 0);
  function screenOf(obj, x, y) {
    pj.set(x, y, 0);
    obj.localToWorld(pj);
    pj.project(camera);
    return { x: ((pj.x + 1) / 2) * cur.vw, y: ((1 - pj.y) / 2) * cur.vh };
  }
  function fitBoards() {
    const show = !idleMode && cur;
    let ok = false;
    if (show) {
      // masanın ön köşelerinin ekrandaki yeri (tableG düzleminde)
      const cornerX = (sx) => {
        const c = V(sx * (cur.TW / 2 + 0.85 * cur.kk), 0, 0);
        tableG.localToWorld(c);
        c.project(camera);
        return ((c.x + 1) / 2) * cur.vw;
      };
      const cl = cornerX(-1);
      const cr = cornerX(1);
      const avail = Math.min(cl, cur.vw - cr) - 30;
      const target = Math.min(avail, 400, cur.vh * 0.46);
      ok = false; // panolar kaldırıldı: masada olanlar ve puanlar sol üstteki çubuklarda (target >= 150)
      void target;
      ['left', 'right'].forEach((sd) => {
        const b = boards[sd];
        b.g.visible = ok;
        if (!ok) return;
        const s = sd === 'left' ? -1 : 1;
        let sc = 1;
        let x = s * (cur.TW / cur.k / 2 + 0.9);
        const z = -0.2;
        const hw = 0.5;
        const ph = BH / BW;
        for (let i = 0; i < 6; i++) {
          b.g.position.set(x, 0, z);
          b.g.scale.setScalar(sc);
          room.updateMatrixWorld(true);
          const xs = [[-hw, 0], [hw, 0], [-hw, ph], [hw, ph]].map(([px, py]) => screenOf(b.panel, px, py - ph / 2).x);
          const wpx = Math.max(...xs) - Math.min(...xs);
          // iç kenar masanın köşesinden 18px uzakta kalsın
          const inner = s < 0 ? Math.max(...xs) : Math.min(...xs);
          const want = s < 0 ? cl - 18 : cr + 18;
          x += ((want - inner) * sc) / wpx;
          sc *= target / wpx;
        }
      });
    } else {
      boards.left.g.visible = false;
      boards.right.g.visible = false;
    }
    document.body.classList.toggle('boards3d', ok);
  }

  // ---------- kahvehane: çay ocağı, duvar süsleri ----------
  const brassM = std(0xc89a48, 0.3, { metalness: 0.8 });
  const teaM = new T.MeshStandardMaterial({ color: 0xa83a10, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x4a1204, emissiveIntensity: 0.5 });
  const glassM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28 });
  const saucerM = std(0xf2efe8, 0.4);
  const teaGlassG = new T.CylinderGeometry(0.024, 0.017, 0.075, 14, 1, true);
  const teaG = new T.CylinderGeometry(0.021, 0.016, 0.055, 14);
  const saucerG = new T.CylinderGeometry(0.045, 0.04, 0.008, 18);
  // ince belli çay bardağı (tabağıyla)
  function teaGlass(parent, x, y, z) {
    const s = new T.Mesh(saucerG, saucerM);
    s.position.set(x, y + 0.004, z);
    const g = new T.Mesh(teaGlassG, glassM);
    g.position.set(x, y + 0.046, z);
    const t = new T.Mesh(teaG, teaM);
    t.position.set(x, y + 0.037, z);
    parent.add(s, t, g);
  }
  // tezgah (çay ocağı) arka duvarın sağında
  const ocakX = 2.3;
  const counter = new T.Mesh(new T.BoxGeometry(2.4, 1.0, 0.55), std(0xffffff, 0.6, { map: plankTex('#5a3418', 2, 1, 21) }));
  counter.position.set(ocakX, 0.5, RB + 0.45);
  counter.castShadow = true;
  counter.receiveShadow = true;
  const ctop = new T.Mesh(new T.BoxGeometry(2.5, 0.05, 0.62), std(0x8a8a86, 0.3, { metalness: 0.4 }));
  ctop.position.set(ocakX, 1.02, RB + 0.45);
  room.add(counter, ctop);
  // semaver ve demlik
  const sem = new T.Group();
  const semBody = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.5, 24), brassM);
  semBody.position.y = 0.3;
  const semTop = new T.Mesh(new T.CylinderGeometry(0.06, 0.15, 0.12, 20), brassM);
  semTop.position.y = 0.61;
  const pot = new T.Mesh(new T.SphereGeometry(0.1, 18, 14), std(0xe8e4dc, 0.3));
  pot.scale.y = 0.85;
  pot.position.y = 0.75;
  const potLid = ball(0.03, std(0xe8e4dc, 0.3), V(0, 0.84, 0));
  const tap = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.12, 8), brassM);
  tap.rotation.x = Math.PI / 2;
  tap.position.set(0, 0.16, 0.2);
  const semBase = new T.Mesh(new T.CylinderGeometry(0.14, 0.18, 0.06, 20), brassM);
  semBase.position.y = 0.03;
  sem.add(semBody, semTop, pot, potLid, tap, semBase);
  sem.position.set(ocakX - 0.6, 1.045, RB + 0.4);
  room.add(sem);
  // tezgahta ve rafta dizili bardaklar
  for (let i = 0; i < 9; i++) teaGlass(room, ocakX - 0.2 + (i % 5) * 0.12, 1.045, RB + 0.32 + Math.floor(i / 5) * 0.14);
  [1.55, 1.95].forEach((y) => {
    const sh = new T.Mesh(new T.BoxGeometry(2.2, 0.04, 0.22), std(0x4a2a12, 0.6));
    sh.position.set(ocakX, y, RB + 0.13);
    room.add(sh);
    for (let x = ocakX - 1.0; x < ocakX + 1.0; x += 0.1) {
      const g = new T.Mesh(teaGlassG, glassM);
      g.position.set(x, y + 0.06, RB + 0.13);
      room.add(g);
    }
  });
  // duvar saati ve çerçeveler
  const clock = new T.Group();
  const face = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.03, 32), std(0xf0ead8, 0.5));
  face.rotation.x = Math.PI / 2;
  const rim2 = new T.Mesh(new T.TorusGeometry(0.22, 0.025, 8, 32), std(0x3a2410, 0.5));
  const hh = new T.Mesh(new T.BoxGeometry(0.014, 0.12, 0.01), dark0());
  hh.position.set(0, 0.05, 0.02);
  const mh = new T.Mesh(new T.BoxGeometry(0.01, 0.18, 0.01), dark0());
  mh.position.set(0, 0.08, 0.025);
  const mhPivot = new T.Group();
  mhPivot.add(mh);
  mhPivot.position.z = 0;
  clock.add(face, rim2, hh, mhPivot);
  hh.parent.remove(hh);
  const hhPivot = new T.Group();
  hhPivot.add(hh);
  clock.add(hhPivot);
  clock.position.set(-0.4, 2.35, RB + 0.04);
  room.add(clock);
  function dark0() { return std(0x1a1410, 0.5); }
  [[-2.6, 2.0, 0.6, 0.45, 0x4a4030], [-1.5, 2.1, 0.45, 0.6, 0x3a4048], [0.6, 2.05, 0.55, 0.4, 0x5a4a38], [-RW + 0.03, 2.05, 0.7, 0.5, 0x3a3a2a]].forEach(([x, y, w, h, c], i) => {
    const f = new T.Mesh(new T.BoxGeometry(w + 0.08, h + 0.08, 0.03), std(0x2a1808, 0.5));
    const pc = new T.Mesh(new T.PlaneGeometry(w, h), std(c, 0.9));
    if (i === 3) { f.rotation.y = pc.rotation.y = Math.PI / 2; f.position.set(x, y, 1.0); pc.position.set(x + 0.02, y, 1.0); } else { f.position.set(x, y, RB + 0.02); pc.position.set(x, y, RB + 0.04); }
    room.add(f, pc);
  });

  // ---------- diğer masalar: dört kişi gerçekten 51 oynuyor ----------
  const faceCache = {};
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  function faceMat(r, s) {
    const key2 = r + s;
    if (!faceCache[key2]) {
      faceCache[key2] = std(0xffffff, 0.6, { map: canvasTex(64, 90, (g, w, h) => {
        g.fillStyle = '#f7f3e8'; g.fillRect(0, 0, w, h);
        g.fillStyle = s === '♥' || s === '♦' ? '#b3261e' : '#1d1d1d';
        g.font = 'bold 20px Georgia'; g.fillText(RANKS[r], 5, 22);
        g.font = '40px Georgia'; g.fillText(s, 18, 70);
      }) });
    }
    return faceCache[key2];
  }
  const flatCard = new T.BoxGeometry(0.063, 0.002, 0.088);
  function tableCard(r, s) {
    return new T.Mesh(flatCard, [cardWhite, cardWhite, faceMat(r, s), cardWhite, cardWhite, cardWhite]);
  }
  const clothTex = [
    canvasTex(256, 256, (g, w) => { g.fillStyle = '#1f5a3a'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(255,240,200,.25)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, w - 28); g.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 600; i++) g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }),
    canvasTex(256, 256, (g, w) => { g.fillStyle = '#6a1a22'; g.fillRect(0, 0, w, w); g.strokeStyle = 'rgba(214,168,82,.6)'; g.lineWidth = 5; g.strokeRect(16, 16, w - 32, w - 32); g.fillStyle = 'rgba(255,210,150,.08)'; for (let x = 32; x < w; x += 32) for (let y = 32; y < w; y += 32) { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.fill(); } }),
    canvasTex(256, 256, (g, w) => { for (let x = 0; x < w; x += 32) for (let y = 0; y < w; y += 32) { g.fillStyle = (x + y) % 64 ? '#e8dcc4' : '#8a2a22'; g.fillRect(x, y, 32, 32); } }),
  ];
  const dummyRing = { material: { opacity: 0 } };
  const bgSeats = [];
  const bgTables = [];
  function bgTable(x, z, rot, seed) {
    const r = rng(seed);
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const cm = std(0xffffff, 0.9, { map: clothTex[seed % 3] });
    const top = new T.Mesh(new T.BoxGeometry(0.92, 0.03, 0.92), cm);
    top.position.y = 0.735;
    const skirtM = std(new T.Color(seed % 3 === 0 ? 0x1a4a30 : seed % 3 === 1 ? 0x5a161c : 0xc8bca4), 0.9, { side: T.DoubleSide });
    const skirt = new T.Mesh(new T.CylinderGeometry(0.66, 0.68, 0.16, 4, 1, true), skirtM);
    skirt.rotation.y = Math.PI / 4;
    skirt.position.y = 0.67;
    g.add(top, skirt);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const l = new T.Mesh(new T.BoxGeometry(0.05, 0.6, 0.05), std(0x3a2210, 0.6));
      l.position.set(a * 0.4, 0.3, b * 0.4);
      g.add(l);
    });
    const deck = new T.Mesh(new T.BoxGeometry(0.063, 0.03, 0.088), [cardWhite, cardWhite, backMats[r() < 0.5 ? 'red' : 'blue'], cardWhite, cardWhite, cardWhite]);
    deck.position.set(-0.07, 0.765, 0.0);
    deck.rotation.y = 0.2;
    const pile = new T.Group();
    pile.position.set(0.08, 0.751, 0.02);
    g.add(deck, pile);
    const tb = { g, pile, seats: [], turn: Math.floor(r() * 4), t0: 0, step: 0, melds: [], flying: [], pause: 0 };
    [[0, -0.79], [0.79, 0], [0, 0.79], [-0.79, 0]].forEach(([sx, sz], i) => {
      const female = r() < 0.2;
      const fig = build(look(seed * 7 + i * 131, female));
      fig.root.position.set(sx, 0.42, sz);
      fig.root.rotation.y = Math.atan2(-sx, -sz);
      fig.root.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
      g.add(fig.root);
      const s = { fig, turn: false, actUntil: 0, nextBlink: 0, blinkUntil: 0, leanNow: 0, glance: 0, glanceT: 0, phase: r() * 6, baseHeadYaw: 0, ring: dummyRing, hand: 14, tb, idx: i, sx, sz };
      fillFan(s);
      tb.seats.push(s);
      bgSeats.push(s);
      teaGlass(g, sx * 0.5 + (sz ? 0.25 : 0), 0.75, sz * 0.5 + (sx ? -0.25 : 0));
    });
    room.add(g);
    bgTables.push(tb);
  }
  function fillFan(s) {
    const cg = s.fig.cards;
    while (cg.children.length) { const c0 = cg.children[0]; cg.remove(c0); if (c0.geometry !== cardGeo) c0.geometry.dispose(); }
    const n = s.hand;
    const mid = (n - 1) / 2;
    const step = n > 1 ? Math.min(0.13, 1.25 / (n - 1)) : 0;
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(cardGeo, backMats[(i * 7 + s.idx) % 3 ? 'red' : 'blue']);
      m.rotation.z = -(i - mid) * step;
      m.position.z = i * 0.0035;
      cg.add(m);
    }
    mergeStatic(cg, NOSKIP);
  }
  const tmpH = V(0, 0, 0);
  function throwTo(tb, s, target, rotY) {
    const c = tableCard(Math.floor(Math.random() * 13), SUITS[Math.floor(Math.random() * 4)]);
    s.fig.arms[1].hand.getWorldPosition(tmpH);
    tb.g.worldToLocal(tmpH);
    c.position.copy(tmpH);
    tb.g.add(c);
    tb.flying.push({ c, from: tmpH.clone(), to: target, t: 0, rot: rotY });
  }
  // sıradaki oyuncu: önce desteden çeker, sonra yere atar; ara sıra per açar, eli biten olunca el yeniden dağıtılır
  function bgStep(tb, t, now, dt) {
    if (tb.pause > t) return;
    if (tb.pause && tb.pause <= t) {
      tb.pause = 0;
      tb.melds.forEach((m) => tb.g.remove(m));
      tb.melds = [];
      while (tb.pile.children.length) tb.pile.remove(tb.pile.children[0]);
      tb.seats.forEach((s) => { s.hand = 14; fillFan(s); });
    }
    const s = tb.seats[tb.turn];
    if (!tb.t0) { tb.t0 = t; tb.step = 0; tb.seats.forEach((o) => { o.turn = o === s; }); }
    const e = t - tb.t0;
    if (tb.step === 0 && e > 0.6) { tb.step = 1; s.actUntil = now + 900; } // desteye uzanır
    if (tb.step === 1 && e > 2.0) { tb.step = 2; s.actUntil = now + 900; } // yere atmaya uzanır
    if (tb.step === 2 && e > 2.45) {
      tb.step = 3;
      if (s.hand >= 8 && Math.random() < 0.14) {
        // per açar: oyuncunun önüne 3-4 açık kağıt
        const n = 3 + Math.floor(Math.random() * 2);
        const base = Math.floor(Math.random() * 9);
        const suit = SUITS[Math.floor(Math.random() * 4)];
        const row = new T.Group();
        for (let i = 0; i < n; i++) {
          const c = tableCard(base + i, suit);
          c.position.set((i - (n - 1) / 2) * 0.045, 0, 0);
          row.add(c);
        }
        const k2 = tb.melds.filter((m) => m.userData.seat === s.idx).length;
        row.userData.seat = s.idx;
        row.position.set(s.sx * (0.33 - k2 * 0.1), 0.752 + tb.melds.length * 0.001, s.sz * (0.33 - k2 * 0.1));
        row.rotation.y = Math.atan2(-s.sx, -s.sz);
        tb.g.add(row);
        tb.melds.push(row);
        s.hand -= n;
      }
      throwTo(tb, s, V(0.08 + (Math.random() - 0.5) * 0.04, 0.751 + Math.min(tb.pile.children.length, 6) * 0.002, 0.02 + (Math.random() - 0.5) * 0.04), Math.random() * 1.2 - 0.6);
      fillFan(s);
    }
    if (tb.step === 3 && e > 3.2) {
      if (s.hand <= 3) { tb.pause = t + 3; s.hand = 0; fillFan(s); }
      tb.turn = (tb.turn + 1) % 4;
      tb.t0 = 0;
    }
  }
  function bgFly(tb, dt) {
    for (let i = tb.flying.length - 1; i >= 0; i--) {
      const f = tb.flying[i];
      f.t = Math.min(1, f.t + dt * 2.2);
      const k2 = f.t * f.t * (3 - 2 * f.t);
      f.c.position.lerpVectors(f.from, f.to, k2);
      f.c.position.y += Math.sin(k2 * Math.PI) * 0.06;
      f.c.rotation.y = f.rot * k2;
      if (f.t >= 1) {
        tb.g.remove(f.c);
        f.c.position.set(f.to.x - 0.08, (tb.pile.children.length % 6) * 0.002, f.to.z - 0.02);
        tb.pile.add(f.c);
        if (tb.pile.children.length > 6) tb.pile.remove(tb.pile.children[0]);
        tb.flying.splice(i, 1);
      }
    }
  }
  // performans: arka plandaki diğer masalar kaldırıldı
  // bgTable(-1.9, -2.35, 0.25, 11);
  // bgTable(3.05, -1.45, -0.4, 52);
  // çaycı tezgahın arkasında ayakta
  const caycı = build(look(9001, false));
  caycı.root.position.set(ocakX + 0.3, 0.76, RB + 0.18);
  caycı.cards.visible = false;
  caycı.root.visible = false; // performans: çaycı gizli
  const caySeat = { fig: caycı, turn: false, actUntil: 0, nextBlink: 0, blinkUntil: 0, leanNow: 0, glance: 0, glanceT: 0, phase: 2, baseHeadYaw: 0, ring: dummyRing };
  // (çaycı canlandırılmıyor)

  // ---------- yerleşim ----------
  let cur = null;
  const upW = V(0, 0, 1); // salonun "yukarı" yönü (dünya)
  let idleMode = true;
  function placeSeat(s) {
    if (!cur) return;
    const k = cur.kk;
    const zSeat = -cur.hfloor + 0.42 * k;
    const edge = (s.slot === 'top' ? 0.24 : 0.3) * k; // yanlar kağıtları masa kenarının dışında tutsun
    const pos = s.slot === 'top' ? [0, cur.TH / 2 + edge, zSeat] : s.slot === 'left' ? [-cur.TW / 2 - edge, 0, zSeat] : [cur.TW / 2 + edge, 0, zSeat];
    s.g.position.set(pos[0], pos[1], pos[2]);
    s.body.scale.setScalar(k);
    s.g.visible = !idleMode;
  }

  function sizeRenderer(vw, vh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1);
    if (renderer.domElement.width !== Math.round(vw * dpr) || renderer.domElement.height !== Math.round(vh * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(vw, vh, false);
      ovRenderer.setPixelRatio(dpr);
      ovRenderer.setSize(vw, vh, false);
    }
  }

  // p: { vw, vh, ox, oy (perspektif merkezi), cx, cy (masa merkezi), TW, TH, tilt (derece) } — hepsi ekran pikseli
  function layout(p, idle) {
    idleMode = !!idle;
    const m = metrics(p.TH, p.TM);
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
    upW.set(0, Math.sin((p.tilt * Math.PI) / 180), Math.cos((p.tilt * Math.PI) / 180));
    const fz = -m.hfloor;
    // salon: metre ölçeği k; masa en/boyu metre cinsinden TW/k × 2.6
    room.scale.setScalar(m.k);
    room.position.set(0, 0, fz);
    const tw = p.TW / m.k;
    const td = p.TH / m.k;
    rug.scale.set((tw + 1.9) / 6.2, 1, (td + 1.9) / 4.4);
    pool.scale.set(tw + 2.4, td + 2.4, 1);
    // noktasal ışık yok: lambalar yalnızca parıltı
    scene.fog.near = D * 0.95;
    scene.fog.far = D + 10 * m.k;
    key.position.set(-p.TW * 0.35, -p.TH * 0.55, m.k * 6);
    fill.position.set(p.TW * 0.6, p.TH * 0.4, m.k * 3);
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
    fitBoards();
  }

  function idle() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TH = Math.min(vh * 0.55, vw * 0.45);
    layout({ vw, vh, ox: vw / 2, oy: vh * 0.3, cx: vw / 2, cy: vh * 0.5, TW: TH * 1.5, TH, tilt: 40 }, true);
  }

  // oyuncunun bir noktasının (metre, oyuncu çerçevesinde) ekrandaki yeri
  const ANCH = { fan: [0, 0.55, 0.4], pill: { top: [0.45, 1.14, 0], left: [0, 1.24, 0], right: [0, 1.24, 0] } };
  function anchor(slot, what) {
    const s = seats[slot];
    if (!s || !cur) return null;
    let v;
    if (what === 'hand') { // sağ elin şu anki yeri (kağıt eli takip etsin)
      v = V(0, 0, 0);
      s.fig.arms[1].hand.getWorldPosition(v);
    } else {
      const pt = what === 'fan' ? ANCH.fan : ANCH.pill[slot];
      v = V(pt[0], pt[1], pt[2]);
      s.yaw.updateWorldMatrix(true, false);
      s.yaw.localToWorld(v);
    }
    v.project(camera);
    return { x: ((v.x + 1) / 2) * cur.vw, y: ((1 - v.y) / 2) * cur.vh };
  }

  // ---------- çizim ----------
  const handL = V(0, 0, 0);
  const handR = V(0, 0, 0);
  const reachTo = V(0.14, 0.78, 0.66);
  const tmpW = V(0, 0, 0);
  function puff(pos) {
    const m = new T.Sprite(puffMat.clone());
    m.position.copy(pos);
    m.scale.setScalar(0.05 * cur.kk);
    m.userData = { age: 0, life: 3.5 + Math.random() * 2, v: upW.clone().multiplyScalar(0.14 + Math.random() * 0.06).add(V((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05)).multiplyScalar(cur.kk) };
    scene.add(m);
    puffs.push(m);
  }
  function animate(s, t, now, dt) {
    const f = s.fig;
    const ph = s.phase;
    const br2 = reduce ? 0 : Math.sin(t * 1.6 + ph);
    f.torso.scale.set(1 + 0.008 * br2, 1 + 0.012 * br2, 1 + 0.008 * br2);
    // kart çekme/atma: el masaya uzanır, baş eğilir
    const rp = reachProfile(s, now);
    const a = Math.max(0, (s.actUntil - now) / 900);
    const reach = rp >= 0 ? rp : Math.sin(a * Math.PI);
    s.leanNow += ((s.turn ? 0.1 : 0) - s.leanNow) * 0.08;
    f.torso.rotation.x = -0.12 + s.leanNow + reach * (rp >= 0 ? 0.32 : 0.1); // masaya uzanırken öne eğilir
    // bakış: arada bir başka oyuncuya, sırası gelince masaya
    if (t > s.glanceT) { s.glanceT = t + 2 + Math.random() * 4; s.glance = (Math.random() - 0.5) * 1.0; }
    const hy = (s.turn ? 0 : s.glance) + s.baseHeadYaw * 0.4 + (reduce ? 0 : Math.sin(t * 0.7 + ph) * 0.05);
    f.head.rotation.y += (hy - f.head.rotation.y) * 0.05;
    f.head.rotation.x = (s.turn ? -0.1 : -0.28) + reach * 0.2 + (reduce ? 0 : Math.sin(t * 0.5 + ph) * 0.04);
    f.head.rotation.z = reduce ? 0 : Math.sin(t * 0.4 + ph) * 0.03;
    if (!reduce && now > s.nextBlink) { s.blinkUntil = now + 120; s.nextBlink = now + 2000 + Math.random() * 4500; }
    const ey = now < s.blinkUntil ? 0.12 : 1;
    f.eyes.forEach((e) => { e.scale.y = ey; e.rotation.y = -f.head.rotation.y * 0.35; });
    // eller kağıtları tutar; sağ el gerektiğinde masaya uzanır
    const sway = reduce ? 0 : Math.sin(t * 0.9 + ph) * 0.01;
    handL.set(-0.07, 1.02 + sway, 0.22);
    handR.set(0.07, 1.02 - sway, 0.22).lerp(rp >= 0 ? s.reachLocal : reachTo, reach);
    poseArms(f, [handL, handR]);
    f.cards.position.set(sway, 0.6 + reach * 0.02, 0.24);
    f.cards.rotation.z = reduce ? 0 : Math.sin(t * 0.8 + ph) * 0.03;
    s.ring.material.opacity = s.turn ? 0.55 + (reduce ? 0 : Math.sin(t * 4) * 0.25) : 0;
    if (f.cig && !reduce) {
      const g = 0.6 + 0.4 * Math.max(0, Math.sin(t * 0.8 + ph));
      f.cig.tipGlow.material.opacity = g;
      f.cig.tipGlow.scale.setScalar(0.03 + g * 0.03);
      if (t - f.cig.last > 0.55) { f.cig.last = t; f.cig.tip.getWorldPosition(tmpW); puff(tmpW); }
    }
  }
  // sabit oda eşyaları ve arka masaların tabla/ayak/tabakları tek ağda (rug ve pool her yerleşimde ölçeklenir)
  mergeStatic(room, new Set([rug, pool]));
  bgTables.forEach((tb) => mergeStatic(tb.g, NOSKIP));
  let last = 0;
  let bgTick = false;
  // sağ altta FPS göstergesi: saniyede çizilen sahne karesi
  const fpsEl = document.createElement('div');
  fpsEl.id = 'fps';
  fpsEl.textContent = 'FPS –';
  document.body.appendChild(fpsEl);
  let fpsN = 0;
  let fpsT = performance.now();
  let tPrev = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return; // ekran yenileme hızında (ör. 175 Hz) çizilir
    last = now;
    const t = now / 1000;
    const dt = Math.min(0.1, t - tPrev);
    tPrev = t;
    if (!reduce) {
      lamps.forEach((l) => {
        const fl = 0.9 + Math.sin(t * 7 + l.ph) * 0.04 + Math.sin(t * 13.7 + l.ph * 2) * 0.03 + (Math.random() - 0.5) * 0.05;
        void fl;
        l.glow.material.opacity = 0.75 * fl;
      });
      smoke.forEach((m) => {
        m.position.addScaledVector(m.userData.v, dt);
        m.material.rotation += m.userData.rot * dt;
        if (m.position.y > RH - 0.2) m.position.y = 1.5;
        if (Math.abs(m.position.x) > RW - 0.5) m.userData.v.x *= -1;
      });
      const da = dustG.attributes.position;
      for (let i = 0; i < dustN; i++) {
        da.array[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.0006;
        da.array[i * 3] += Math.cos(t * 0.3 + i * 1.3) * 0.0005;
      }
      da.needsUpdate = true;
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const m = puffs[i];
      const u = m.userData;
      u.age += dt;
      m.position.addScaledVector(u.v, dt);
      m.scale.setScalar((0.03 + u.age * 0.055) * (cur ? cur.kk : 1));
      m.material.opacity = 0.2 * (1 - u.age / u.life);
      m.material.rotation += dt * 0.3;
      if (u.age > u.life) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); }
    }
    if (!idleMode) for (const k in seats) animate(seats[k], t, now, dt);
    bgTables.forEach((tb) => { bgStep(tb, t, now, dt); bgFly(tb, dt); });
    bgTick = !bgTick;
    if (bgTick) bgSeats.forEach((s) => animate(s, t, now, dt * 2)); // arka masalar yarı hızda
    const d0 = new Date();
    mhPivot.rotation.z = -(d0.getMinutes() / 60) * Math.PI * 2;
    hhPivot.rotation.z = -((d0.getHours() % 12) / 12 + d0.getMinutes() / 720) * Math.PI * 2;
    renderer.render(scene, camera);
    // uzanan kollar üst tuvale (masanın üstüne) çizilir
    let anyReach = false;
    for (const k in seats) {
      const s = seats[k];
      const on = !!s.reachLocal && !idleMode;
      if (on) anyReach = true;
      if (s.armsOver !== on) {
        s.armsOver = on;
        const a = s.fig.arms[1]; // yalnızca uzanan sağ kol
        [a.up, a.fo, a.elb, a.cuff, a.hand].forEach((m) => m.traverse((o) => { if (on) o.layers.enable(1); else o.layers.disable(1); }));
      }
    }
    if (anyReach || ovDirty) {
      camera.layers.set(1);
      ovRenderer.render(scene, camera);
      camera.layers.set(0);
      ovDirty = anyReach; // son kareden sonra bir kez daha çizip temizle
    }
    fpsN++;
    if (now - fpsT >= 500) { fpsEl.textContent = 'FPS ' + Math.round((fpsN * 1000) / (now - fpsT)); fpsEl.dataset.calls = renderer.info.render.calls; fpsN = 0; fpsT = now; }
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => { if (idleMode) idle(); });
  idle();

  return { available: true, metrics, layout, idle, setPlayer, setTurn, act, anchor, isFemaleName, setLog, setScores };
})();
