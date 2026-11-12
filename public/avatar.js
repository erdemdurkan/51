'use strict';
// Oyuncu portreleri: yuvarlak çerçevede vesikalık fotoğraf gibi, omuzdan yukarısı.
// Avatar.byId(n): numaralı kütüphane (COUNT adet, hep aynı görünür).
// Avatar.svg(seed, {female}): isimden türetilen görünüm (avatar seçmemiş oyuncular / bilgisayar).
const Avatar = (() => {
  const COUNT = 120;
  const SKIN = [['#f8dcc0', '#dfb08a'], ['#f0c8a0', '#cf9a6e'], ['#e2b184', '#b98252'], ['#cf9a68', '#a26a3e'], ['#b07a4c', '#80522c'], ['#8a5a36', '#5e3a1e']];
  const HAIR = ['#14100c', '#2e1e12', '#4e3219', '#7a4e26', '#a8702f', '#d9b264', '#eadbb0', '#7d7d7d', '#b5401f'];
  const BG = [['#e9eef5', '#b9c6d6'], ['#f3ead9', '#d2bf9c'], ['#e4efe6', '#adc8b4'], ['#efe2e6', '#cfaab5'], ['#e6e3f2', '#b3acd4'], ['#fdf0d8', '#e8c48a'], ['#dff1f4', '#9fcbd4'], ['#ececec', '#bdbdbd']];
  const KIT = [['#f6c400', '#c8102e'], ['#f6c400', '#16325c'], ['#ffffff', '#111111'], ['#1a8a3a', '#ffffff'], ['#7a1f3d', '#5aa0d8'], ['#d0021b', '#ffffff'], ['#0b3d91', '#ffffff'], ['#ff7a00', '#1b1b1b'], ['#5b2a86', '#f2c94c'], ['#00843d', '#ffd200']];
  const TEE = ['#d64545', '#2f6fd6', '#2e9e5b', '#f2b52b', '#7d4cc2', '#ef6aa0', '#2b2b2b', '#e8e8e8', '#1fa3a3', '#f07b2a'];
  const SUIT = ['#1f2a3d', '#2b2b2b', '#3b3f46', '#3d2b22', '#14213d', '#4a4f3a', '#5a2333'];
  const TIE = ['#a8182b', '#1e4fa3', '#c79a1b', '#2d7a46', '#6b2a8a', '#111111'];
  const SCARF = ['#7a1f3d', '#1e4f6e', '#3d6b3a', '#c48a2a', '#8a3b8f', '#2b2b2b', '#c94f4f', '#3a5aa8'];

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SH = 'M6 106 Q9 80 34 73 L66 73 Q91 80 94 106Z'; // omuzlar

  function outfit(kind, r, pick, id, skinD, female) {
    switch (kind) {
      case 'suit': {
        const jc = pick(SUIT);
        const tie = pick(TIE);
        const bow = r() < 0.2;
        return `<path d="${SH}" fill="${jc}"/><path d="M40 73 L50 92 L60 73Z" fill="#f4f4f2"/>
          ${bow ? `<path d="M44 76 L50 79 L56 76 L56 82 L50 79.5 L44 82Z" fill="${tie}"/>` : `<path d="M47.5 76 L50 79 L52.5 76 L51.6 96 L50 99 L48.4 96Z" fill="${tie}"/>`}
          <path d="M34 73 L44 73 L50 92 L41 84 L44 80Z" fill="rgba(0,0,0,.28)"/><path d="M66 73 L56 73 L50 92 L59 84 L56 80Z" fill="rgba(0,0,0,.28)"/>
          ${r() < 0.5 ? '<path d="M30 86 L37 85 L37 87.5 L30 88.5Z" fill="#f4f4f2" opacity=".85"/>' : ''}`;
      }
      case 'jersey': {
        const [a, b] = pick(KIT);
        const num = 1 + Math.floor(r() * 99);
        const hoops = r() < 0.3;
        return `<defs><clipPath id="${id('k')}"><path d="${SH}"/></clipPath></defs><path d="${SH}" fill="${a}"/>
          <g clip-path="url(#${id('k')})" fill="${b}">${hoops
            ? '<rect x="0" y="80" width="100" height="6"/><rect x="0" y="92" width="100" height="6"/>'
            : '<rect x="18" y="70" width="8" height="40"/><rect x="34" y="70" width="8" height="40"/><rect x="58" y="70" width="8" height="40"/><rect x="74" y="70" width="8" height="40"/>'}</g>
          <path d="M41 73 L50 83 L59 73" stroke="${b}" stroke-width="3" fill="${skinD}" stroke-linejoin="round"/>
          <text x="63" y="96" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="8" fill="${b === '#ffffff' ? '#111' : '#fff'}" stroke="${b}" stroke-width=".6" text-anchor="middle">${num}</text>`;
      }
      case 'hoodie': {
        const c = pick(TEE);
        return `<path d="${SH}" fill="${c}"/><path d="M33 74 Q50 90 67 74 Q63 82 50 85 Q37 82 33 74Z" fill="rgba(0,0,0,.25)"/>
          <path d="M44 84 L43 98 M56 84 L57 98" stroke="#f1f1f1" stroke-width="1.3" stroke-linecap="round"/><circle cx="43" cy="98.5" r="1.2" fill="#f1f1f1"/><circle cx="57" cy="98.5" r="1.2" fill="#f1f1f1"/>`;
      }
      case 'polo': {
        const c = pick(TEE);
        return `<path d="${SH}" fill="${c}"/><path d="M38 72 L50 79 L44 84Z M62 72 L50 79 L56 84Z" fill="${c}" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>
          <path d="M50 79 L50 92" stroke="rgba(0,0,0,.25)" stroke-width="1"/><circle cx="50" cy="84" r=".9" fill="#fff"/><circle cx="50" cy="89" r=".9" fill="#fff"/>`;
      }
      case 'sweater': {
        const c = pick(TEE);
        return `<path d="${SH}" fill="${c}"/><path d="M40 73 Q50 82 60 73" stroke="rgba(0,0,0,.25)" stroke-width="4" fill="none"/>
          <path d="M14 92 L86 92 M12 98 L88 98" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="3 2"/>`;
      }
      case 'leather': {
        return `<path d="${SH}" fill="#2a2522"/><path d="M41 73 L50 88 L59 73Z" fill="${pick(TEE)}"/>
          <path d="M34 73 L45 76 L50 90 L40 86Z M66 73 L55 76 L50 90 L60 86Z" fill="#3a332e"/>
          <path d="M56 80 L60 104" stroke="#9a9a9a" stroke-width="1"/><path d="M24 88 L32 88" stroke="#9a9a9a" stroke-width="1"/>`;
      }
      case 'shirt': {
        const c = pick(['#ffffff', '#cfe0f5', '#f5e1cf', '#e2f0d9', '#e9d8f0']);
        const check = r() < 0.4;
        return `<defs><pattern id="${id('p')}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${c}"/><path d="M0 3H6M3 0V6" stroke="${pick(['#c84a4a', '#3a64b0', '#3f8a52'])}" stroke-width=".8" opacity=".55"/></pattern></defs>
          <path d="${SH}" fill="${check ? `url(#${id('p')})` : c}"/>
          <path d="M39 72 L50 80 L45 86Z M61 72 L50 80 L55 86Z" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>
          <path d="M50 80 L50 106" stroke="rgba(0,0,0,.2)" stroke-width="1"/><circle cx="50" cy="88" r=".9" fill="#888"/><circle cx="50" cy="96" r=".9" fill="#888"/>`;
      }
      case 'vest': {
        const v = pick(SUIT);
        return `<path d="${SH}" fill="#f4f4f2"/><path d="M28 75 L42 74 L50 95 L50 106 L22 106Z M72 75 L58 74 L50 95 L50 106 L78 106Z" fill="${v}"/>
          <path d="M47.5 76 L50 79 L52.5 76 L51.6 94 L50 96 L48.4 94Z" fill="${pick(TIE)}"/><circle cx="47" cy="99" r=".9" fill="#ccc"/><circle cx="53" cy="99" r=".9" fill="#ccc"/>`;
      }
      case 'blouse': {
        const c = pick(['#f7d6e0', '#ffffff', '#d6e8f7', '#f7efd6', '#e0d6f7', '#c94f6a']);
        return `<path d="${SH}" fill="${c}"/><path d="M38 73 Q50 86 62 73" stroke="rgba(0,0,0,.18)" stroke-width="2" fill="${skinD}"/>
          <path d="M36 74 Q42 80 38 86 M64 74 Q58 80 62 86" stroke="rgba(0,0,0,.12)" stroke-width="2" fill="none"/>
          ${r() < 0.5 ? '<circle cx="50" cy="81" r="1.6" fill="#f2d27a"/><path d="M41 74 Q50 82 59 74" stroke="#f2d27a" stroke-width=".7" fill="none"/>' : ''}`;
      }
      case 'cardigan': {
        const c = pick(['#b5784a', '#7a8a9a', '#c9a0a0', '#5a6b4a', '#d8c8a8']);
        return `<path d="${SH}" fill="${c}"/><path d="M40 73 L50 92 L60 73Z" fill="${pick(['#ffffff', '#2b2b2b', '#f2e2c8'])}"/>
          <path d="M40 73 L50 92 M60 73 L50 92" stroke="rgba(0,0,0,.25)" stroke-width="2"/><circle cx="52" cy="97" r="1.1" fill="rgba(0,0,0,.35)"/><circle cx="52" cy="103" r="1.1" fill="rgba(0,0,0,.35)"/>`;
      }
      default: { // tişört
        const c = pick(TEE);
        const ink = c === '#e8e8e8' ? '#2b2b2b' : '#ffffff';
        const k = Math.floor(r() * 4);
        const art = [
          `<path d="M50 87 l2.6 5.3 5.8 .8 -4.2 4.1 1 5.8 -5.2 -2.7 -5.2 2.7 1 -5.8 -4.2 -4.1 5.8 -.8Z" fill="${ink}" opacity=".9"/>`,
          `<circle cx="50" cy="95" r="6.5" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".9"/><path d="M50 89 L50 101 M44 95 L56 95" stroke="${ink}" stroke-width="1.2" opacity=".9"/>`,
          `<text x="50" y="98" font-family="Arial Black, Arial, sans-serif" font-size="8" font-weight="900" fill="${ink}" text-anchor="middle" opacity=".9">51</text>`,
          `<path d="M44 98 L50 88 L56 98Z" fill="none" stroke="${ink}" stroke-width="1.6" opacity=".9"/>`,
        ][k];
        return `<path d="${SH}" fill="${c}"/><path d="M41 73 Q50 80 59 73" stroke="rgba(0,0,0,.28)" stroke-width="2.4" fill="none"/>${female && r() < 0.5 ? '' : art}`;
      }
    }
  }

  function hairLayers(female, style, hair) {
    if (female) {
      const back = [
        `<path d="M28 44 Q26 22 50 20 Q74 22 72 44 L75 78 Q66 84 60 75 L40 75 Q34 84 25 78Z" fill="${hair}"/>`, // uzun düz
        `<path d="M29 46 Q27 22 50 20 Q73 22 71 46 L72 64 Q64 70 58 62 L42 62 Q36 70 28 64Z" fill="${hair}"/>`, // küt
        `<path d="M30 44 Q28 22 50 20 Q72 22 70 44 L70 56 L30 56Z" fill="${hair}"/><circle cx="50" cy="16" r="8" fill="${hair}"/>`, // topuz
        `<path d="M30 44 Q28 22 50 20 Q72 22 70 44 L70 56 L30 56Z" fill="${hair}"/><path d="M68 34 Q82 46 76 72 Q72 60 66 48Z" fill="${hair}"/>`, // at kuyruğu
        `<g fill="${hair}"><circle cx="28" cy="40" r="9"/><circle cx="72" cy="40" r="9"/><circle cx="27" cy="54" r="9"/><circle cx="73" cy="54" r="9"/><circle cx="29" cy="67" r="8"/><circle cx="71" cy="67" r="8"/><circle cx="36" cy="25" r="10"/><circle cx="64" cy="25" r="10"/><circle cx="50" cy="20" r="11"/></g>`, // kıvırcık
        '', // kısa (pixie)
        `<path d="M30 44 Q28 22 50 20 Q72 22 70 44 L70 56 L30 56Z" fill="${hair}"/><path d="M30 50 Q24 64 30 80 L35 80 Q31 64 35 52Z" fill="${hair}"/><path d="M28 58 L36 58 M28 66 L35 66 M29 74 L35 74" stroke="rgba(0,0,0,.25)" stroke-width="1"/>`, // yan örgü
      ][style % 7];
      const front = style % 7 === 5
        ? `<path d="M31 46 Q29 23 50 22 Q71 23 69 44 Q64 32 50 31 Q40 33 34 40 Q32 43 31 46Z" fill="${hair}"/>`
        : style % 7 === 4
          ? `<path d="M31 42 Q32 26 50 25 Q68 26 69 42 Q62 32 50 32 Q38 32 31 42Z" fill="${hair}"/>`
          : `<path d="M31 44 Q30 24 50 23 Q70 24 69 44 Q63 33 54 31 Q48 37 36 38 Q33 40 31 44Z" fill="${hair}"/>`;
      return { back, front };
    }
    const front = [
      `<path d="M31 42 Q30 23 50 22 Q70 23 69 42 Q67 32 60 30 Q50 33 40 30 Q33 33 31 42Z" fill="${hair}"/>`, // kısa
      `<path d="M31 43 Q29 22 52 21 Q71 23 69 41 Q64 30 52 30 Q44 31 39 35 Q35 37 31 43Z" fill="${hair}"/>`, // yandan ayrık
      `<path d="M32 40 Q33 27 50 26 Q67 27 68 40 Q64 33 50 32.5 Q36 33 32 40Z" fill="${hair}" opacity=".9"/>`, // asker tıraşı
      `<g fill="${hair}"><circle cx="35" cy="32" r="6"/><circle cx="43" cy="26" r="6.5"/><circle cx="52" cy="24" r="7"/><circle cx="61" cy="27" r="6.5"/><circle cx="67" cy="34" r="5.5"/><circle cx="32" cy="40" r="4.5"/><circle cx="69" cy="41" r="4.5"/></g>`, // kıvırcık
      `<path d="M31 42 Q30 25 46 18 Q60 14 70 24 Q72 32 69 42 Q66 31 56 28 Q46 30 40 31 Q34 34 31 42Z" fill="${hair}"/>`, // kabarık perçem
      `<path d="M31 44 Q30 23 50 22 Q70 23 69 44 L70 60 Q66 52 66 44 Q60 33 50 32 Q40 33 34 44 Q34 52 30 60Z" fill="${hair}"/>`, // uzun saç
      '', // kel
    ][style % 7];
    return { back: '', front };
  }

  function headwear(kind, r, pick, hair) {
    const c = pick(SCARF);
    switch (kind) {
      case 'cap': return `<path d="M30 40 Q30 20 50 19 Q70 20 70 40 Q60 35 50 35 Q40 35 30 40Z" fill="${c}"/><path d="M30 40 Q50 32 76 37 Q74 42 56 41 Q40 41 30 40Z" fill="${c}" stroke="rgba(0,0,0,.3)" stroke-width=".8"/><circle cx="50" cy="20" r="1.6" fill="rgba(0,0,0,.3)"/>`;
      case 'beanie': return `<path d="M30 40 Q29 17 50 16 Q71 17 70 40Z" fill="${c}"/><rect x="29" y="34" width="42" height="8" rx="3" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width=".8"/><path d="M34 36 V41 M40 36 V41 M46 36 V41 M52 36 V41 M58 36 V41 M64 36 V41" stroke="rgba(0,0,0,.18)" stroke-width="1"/>${r() < 0.5 ? `<circle cx="50" cy="15" r="4" fill="${c}"/>` : ''}`;
      case 'fedora': return `<ellipse cx="50" cy="33" rx="27" ry="5" fill="#3a2e24"/><path d="M34 33 Q34 16 50 15 Q66 16 66 33Z" fill="#4a3a2c"/><path d="M34 29 L66 29 L66 32 L34 32Z" fill="${c}"/>`;
      case 'scarf': return `<path d="M26 50 Q24 20 50 18 Q76 20 74 50 L74 76 Q62 86 50 86 Q38 86 26 76Z" fill="${c}"/><path d="M33 46 Q34 28 50 27 Q66 28 67 46 L66 60 Q58 68 50 68 Q42 68 34 60Z" fill="rgba(0,0,0,.08)"/>`;
      case 'phones': return `<path d="M29 46 Q28 18 50 18 Q72 18 71 46" stroke="#2b2b2b" stroke-width="3.2" fill="none"/><rect x="24" y="40" width="8" height="14" rx="3.5" fill="${c}"/><rect x="68" y="40" width="8" height="14" rx="3.5" fill="${c}"/>`;
      default: return '';
    }
  }

  // p: { female, seed }
  function draw(seed, female, uid) {
    const r = rng(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const id = (n) => `${uid}-${n}`;
    const skin = pick(SKIN);
    const hair = female ? pick(HAIR.filter((h) => h !== '#7d7d7d')) : pick(HAIR);
    const bg = pick(BG);
    const style = Math.floor(r() * 7);
    const kinds = female ? ['tee', 'hoodie', 'jersey', 'blouse', 'cardigan', 'sweater', 'suit', 'leather', 'shirt', 'polo'] : ['suit', 'jersey', 'tee', 'hoodie', 'polo', 'sweater', 'leather', 'shirt', 'vest'];
    const kind = pick(kinds);
    const hwRoll = r();
    let hw = 'none';
    if (female) { if (hwRoll < 0.14) hw = 'scarf'; else if (hwRoll < 0.22) hw = 'beanie'; else if (hwRoll < 0.28) hw = 'phones'; }
    else if (hwRoll < 0.13) hw = 'cap'; else if (hwRoll < 0.2) hw = 'beanie'; else if (hwRoll < 0.26) hw = 'fedora'; else if (hwRoll < 0.31) hw = 'phones';
    const faceRoll = r();
    const facial = female ? 'none' : faceRoll < 0.22 ? 'beard' : faceRoll < 0.34 ? 'stache' : faceRoll < 0.44 ? 'goatee' : faceRoll < 0.54 ? 'stubble' : 'none';
    const gRoll = r();
    const glasses = gRoll < 0.12 ? 'round' : gRoll < 0.22 ? 'square' : gRoll < 0.27 ? 'sun' : 'none';
    const earrings = female && r() < 0.5;
    const eyeC = pick(['#2a1a10', '#3b2a1a', '#2c4a6e', '#3d5a2a', '#5a3a1a']);
    const smile = r();
    const blink = (3.5 + r() * 4).toFixed(1);
    const H = hairLayers(female, style, hair);
    const scarf = hw === 'scarf';
    const facialSvg = {
      beard: `<path d="M32 50 Q33 66 42 70 Q50 74 58 70 Q67 66 68 50 Q66 58 60 60 Q55 57 50 58 Q45 57 40 60 Q34 58 32 50Z" fill="${hair}" opacity=".95"/>`,
      stache: `<path d="M42 59 Q46 56 50 58 Q54 56 58 59 Q54 61 50 60 Q46 61 42 59Z" fill="${hair}"/>`,
      goatee: `<path d="M43 59 Q46 57 50 58.5 Q54 57 57 59 Q54 60.5 50 60 Q46 60.5 43 59Z M45 63 Q50 70 55 63 Q53 66.5 50 66.5 Q47 66.5 45 63Z" fill="${hair}"/>`,
      stubble: `<path d="M33 52 Q34 66 42 70 Q50 73 58 70 Q66 66 67 52 Q60 62 50 62 Q40 62 33 52Z" fill="${hair}" opacity=".22"/>`,
      none: '',
    }[facial];
    const mouth = smile < 0.35
      ? `<path d="M44 60 Q50 66 56 60 Q50 62.5 44 60Z" fill="#7a2a22"/><path d="M45 60.3 Q50 62 55 60.3" stroke="#fff" stroke-width="1" fill="none"/>`
      : smile < 0.8 ? `<path d="M44 60 Q50 64.5 56 60" stroke="${female ? '#c4505a' : '#9a4a3a'}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
        : `<path d="M45 61 Q50 62.5 55 61" stroke="${female ? '#c4505a' : '#9a4a3a'}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    const specs = glasses === 'none' ? '' : glasses === 'sun'
      ? `<g fill="#1d1d1d" stroke="#1d1d1d" stroke-width="1.2"><rect x="35" y="41" width="12" height="8" rx="3"/><rect x="53" y="41" width="12" height="8" rx="3"/></g><path d="M47 44 Q50 42.5 53 44" stroke="#1d1d1d" stroke-width="1.2" fill="none"/><path d="M37 43 L41 42" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`
      : glasses === 'round'
        ? `<g fill="rgba(255,255,255,.12)" stroke="#5a3a1a" stroke-width="1.2"><circle cx="41" cy="45" r="5"/><circle cx="59" cy="45" r="5"/></g><path d="M46 44.5 Q50 43 54 44.5" stroke="#5a3a1a" stroke-width="1.1" fill="none"/>`
        : `<g fill="rgba(255,255,255,.12)" stroke="#1d1d1d" stroke-width="1.3"><rect x="35.5" y="41" width="11" height="8" rx="2"/><rect x="53.5" y="41" width="11" height="8" rx="2"/></g><path d="M46.5 44 Q50 42.5 53.5 44" stroke="#1d1d1d" stroke-width="1.1" fill="none"/>`;
    const eyes = glasses === 'sun' ? '' : `<g><ellipse cx="41" cy="45" rx="3" ry="2.6" fill="#fff"/><ellipse cx="59" cy="45" rx="3" ry="2.6" fill="#fff"/>
        <circle cx="41.3" cy="45.2" r="1.7" fill="${eyeC}"/><circle cx="59.3" cy="45.2" r="1.7" fill="${eyeC}"/>
        <circle cx="41.9" cy="44.5" r=".55" fill="#fff"/><circle cx="59.9" cy="44.5" r=".55" fill="#fff"/>
        <rect x="37" y="41.5" width="26" height="0" fill="${skin[0]}"><animate attributeName="height" values="0;0;7;0" keyTimes="0;.95;.975;1" dur="${blink}s" repeatCount="indefinite"/></rect></g>
        ${female ? '<path d="M38.5 43.5 L37 42 M61.5 43.5 L63 42" stroke="#1b130d" stroke-width=".9" stroke-linecap="round"/>' : ''}`;

    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
      <radialGradient id="${id('bg')}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient>
      <radialGradient id="${id('sk')}" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="${skin[0]}"/><stop offset="1" stop-color="${skin[1]}"/></radialGradient>
      <radialGradient id="${id('vg')}" r="60%"><stop offset=".72" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.28)"/></radialGradient>
      <clipPath id="${id('cl')}"><circle cx="50" cy="50" r="50"/></clipPath>
    </defs><g clip-path="url(#${id('cl')})">
      <rect width="100" height="100" fill="url(#${id('bg')})"/>
      ${scarf ? '' : H.back}
      <rect x="43" y="58" width="14" height="17" rx="3" fill="${skin[1]}"/>
      ${outfit(kind, r, pick, id, skin[1], female)}
      ${scarf ? headwear('scarf', r, pick, hair) : ''}
      ${scarf ? '' : `<ellipse cx="31.5" cy="47" rx="3.6" ry="6" fill="${skin[1]}"/><ellipse cx="68.5" cy="47" rx="3.6" ry="6" fill="${skin[1]}"/>`}
      ${earrings && !scarf ? '<circle cx="31.5" cy="54.5" r="1.8" fill="#f2c94c"/><circle cx="68.5" cy="54.5" r="1.8" fill="#f2c94c"/>' : ''}
      <ellipse cx="50" cy="45" rx="18.5" ry="21.5" fill="url(#${id('sk')})"/>
      ${facialSvg}
      <path d="M37 39 Q41.5 36.5 46 38.5 M54 38.5 Q58.5 36.5 63 39" stroke="${hair}" stroke-width="2" stroke-linecap="round" fill="none"/>
      ${eyes}
      <path d="M50 46 Q48.3 52.5 47 54 Q50 55.6 53 54" stroke="${skin[1]}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      ${mouth}
      ${female ? '<ellipse cx="38" cy="54" rx="3.2" ry="1.8" fill="#f08c8c" opacity=".35"/><ellipse cx="62" cy="54" rx="3.2" ry="1.8" fill="#f08c8c" opacity=".35"/>' : ''}
      ${specs}
      ${scarf ? `<path d="M31 40 Q31 24 50 23 Q69 24 69 40 Q62 30 50 30 Q38 30 31 40Z" fill="${pick(SCARF)}" opacity=".0"/>` : H.front}
      ${!scarf && hw !== 'none' ? headwear(hw, r, pick, hair) : ''}
      <ellipse cx="44" cy="31" rx="9" ry="4" fill="rgba(255,255,255,.12)"/>
      <circle cx="50" cy="50" r="50" fill="url(#${id('vg')})"/>
    </g></svg>`;
  }

  // Kütüphanedeki n. avatar (tek numaralar kadın, çift numaralar erkek)
  const seedOf = (n) => (Math.imul(n + 1, 2654435761) ^ 0x51c0ffee) >>> 0;
  function byId(n, uid = 'lib') { return draw(seedOf(n), n % 2 === 1, uid + n); }
  function svg(seed, { female = false, uid = 'av' } = {}) { return draw(seed, female, uid); }
  return { COUNT, byId, svg };
})();
