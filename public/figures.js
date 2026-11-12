'use strict';
// Hayvan ve kostümlü figürler: omuzdan yukarı büst, arka plansız (isim plakasının üstünde durur).
// Her figürün iki renk çeşidi var. Avatar kütüphanesi (avatar.js) bunları insanlardan sonra sıralar.
const Figures = (() => {
  const SH = 'M6 106 Q9 80 34 73 L66 73 Q91 80 94 106Z';
  const body = (c, extra = '') => `<path d="${SH}" fill="${c}"/><path d="M6 106 Q9 80 34 73 L40 73 Q22 82 18 106Z" fill="rgba(255,255,255,.12)"/>${extra}`;
  const eye = (x, y, r = 3.2, c = '#1b1410') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`;
  const shine = '<ellipse cx="43" cy="30" rx="8" ry="3.5" fill="rgba(255,255,255,.18)"/>';
  const skinF = ['#f0c8a0', '#c58a5c'];

  const ANIMALS = [
    { name: 'Kedi', v: [['#f2a14a', '#fff3e0', '#2e7d4f'], ['#8d8f96', '#eceef2', '#7b4bb3']], draw: ([f, l, c]) => `
      ${body(c)}<path d="M44 70 L56 70 L55 76 L45 76Z" fill="${f}"/>
      <path d="M29 36 L33 14 L46 28Z M71 36 L67 14 L54 28Z" fill="${f}"/><path d="M32 31 L34 19 L42 28Z M68 31 L66 19 L58 28Z" fill="#f4a3b4"/>
      <ellipse cx="50" cy="46" rx="22" ry="20" fill="${f}"/>
      <path d="M41 26 L43 33 M50 25 L50 32 M59 26 L57 33" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="50" cy="55" rx="11" ry="8" fill="${l}"/>
      <ellipse cx="41" cy="44" rx="3.6" ry="4.4" fill="#3d8a3d"/><ellipse cx="59" cy="44" rx="3.6" ry="4.4" fill="#3d8a3d"/>
      <ellipse cx="41" cy="44" rx="1.2" ry="3.6" fill="#111"/><ellipse cx="59" cy="44" rx="1.2" ry="3.6" fill="#111"/>
      <path d="M47.5 51 L52.5 51 L50 54Z" fill="#e8768a"/><path d="M50 54 Q47 58 44.5 56.5 M50 54 Q53 58 55.5 56.5" stroke="#5a3a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M28 52 L40 54 M28 57 L40 56 M72 52 L60 54 M72 57 L60 56" stroke="#fff" stroke-width=".8" opacity=".9"/>${shine}` },
    { name: 'Tilki', v: [['#e8661f', '#fff', '#2b4c7e'], ['#b8b2a6', '#fff', '#8a2a2a']], draw: ([f, l, c]) => `
      ${body(c, '<path d="M38 73 L50 86 L62 73Z" fill="#fff"/>')}
      <path d="M26 40 L28 12 L46 30Z M74 40 L72 12 L54 30Z" fill="${f}"/><path d="M28 18 L28 12 L33 16Z M72 18 L72 12 L67 16Z" fill="#2a1a12"/><path d="M30 33 L30 20 L41 30Z M70 33 L70 20 L59 30Z" fill="#fff" opacity=".85"/>
      <path d="M26 42 Q28 26 50 25 Q72 26 74 42 Q74 56 50 72 Q26 56 26 42Z" fill="${f}"/>
      <path d="M26 46 Q38 50 50 72 Q30 62 26 46Z M74 46 Q62 50 50 72 Q70 62 74 46Z" fill="${l}"/>
      ${eye(41, 44, 2.8)}${eye(59, 44, 2.8)}
      <ellipse cx="50" cy="64" rx="3.6" ry="2.6" fill="#1b1410"/>${shine}` },
    { name: 'Ayı', v: [['#8a5a34', '#d9b48a', '#c0392b'], ['#3a3330', '#a08a74', '#1f7a6a']], draw: ([f, l, c]) => `
      ${body(c)}<circle cx="31" cy="27" r="9" fill="${f}"/><circle cx="69" cy="27" r="9" fill="${f}"/><circle cx="31" cy="27" r="5" fill="${l}"/><circle cx="69" cy="27" r="5" fill="${l}"/>
      <ellipse cx="50" cy="46" rx="23" ry="22" fill="${f}"/>
      <ellipse cx="50" cy="56" rx="11" ry="9" fill="${l}"/>
      ${eye(41, 42, 3)}${eye(59, 42, 3)}
      <ellipse cx="50" cy="51.5" rx="4.5" ry="3.2" fill="#1b1410"/><path d="M50 55 L50 58 Q47 61 44.5 59 M50 58 Q53 61 55.5 59" stroke="#1b1410" stroke-width="1.2" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Panda', v: [['#f7f7f2', '#1b1b1b', '#3c8d4f'], ['#f7f7f2', '#1b1b1b', '#d6457a']], draw: ([f, k, c]) => `
      ${body(k, `<path d="M30 76 Q50 88 70 76 L72 106 L28 106Z" fill="${c}"/>`)}
      <circle cx="31" cy="27" r="8.5" fill="${k}"/><circle cx="69" cy="27" r="8.5" fill="${k}"/>
      <ellipse cx="50" cy="46" rx="23" ry="21" fill="${f}"/>
      <ellipse cx="40" cy="44" rx="6" ry="7.5" fill="${k}" transform="rotate(25 40 44)"/><ellipse cx="60" cy="44" rx="6" ry="7.5" fill="${k}" transform="rotate(-25 60 44)"/>
      <circle cx="40.5" cy="43" r="2.4" fill="#fff"/><circle cx="41" cy="43.3" r="1.3" fill="#111"/>
      <circle cx="59.5" cy="43" r="2.4" fill="#fff"/><circle cx="59" cy="43.3" r="1.3" fill="#111"/>
      <ellipse cx="50" cy="54" rx="4" ry="2.8" fill="${k}"/><path d="M50 56.5 Q47 60 44.5 58.5 M50 56.5 Q53 60 55.5 58.5" stroke="${k}" stroke-width="1.2" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Tavşan', v: [['#f4f1ec', '#f4a3b4', '#e2a12b'], ['#a77b56', '#e7b3a4', '#3a6fb0']], draw: ([f, p, c]) => `
      ${body(c)}<ellipse cx="40" cy="16" rx="6.5" ry="17" fill="${f}" transform="rotate(-10 40 16)"/><ellipse cx="60" cy="16" rx="6.5" ry="17" fill="${f}" transform="rotate(10 60 16)"/>
      <ellipse cx="40" cy="17" rx="3.2" ry="12" fill="${p}" transform="rotate(-10 40 17)"/><ellipse cx="60" cy="17" rx="3.2" ry="12" fill="${p}" transform="rotate(10 60 17)"/>
      <ellipse cx="50" cy="49" rx="21" ry="20" fill="${f}"/>
      ${eye(42, 46, 3)}${eye(58, 46, 3)}
      <ellipse cx="36" cy="55" rx="3.5" ry="2" fill="${p}" opacity=".6"/><ellipse cx="64" cy="55" rx="3.5" ry="2" fill="${p}" opacity=".6"/>
      <path d="M47.5 53 L52.5 53 L50 55.5Z" fill="#e8768a"/><path d="M50 55.5 L50 58" stroke="#5a3a2a" stroke-width="1"/>
      <rect x="47" y="58" width="6" height="5" rx="1" fill="#fff" stroke="#ccc" stroke-width=".5"/><path d="M50 58 L50 63" stroke="#ccc" stroke-width=".5"/>${shine}` },
    { name: 'Baykuş', v: [['#8a6a48', '#e9d6b6', '#5a3e7a'], ['#d8d4cc', '#fff', '#2d5a8a']], draw: ([f, l, c]) => `
      ${body(c)}<path d="M28 34 L30 16 L40 28Z M72 34 L70 16 L60 28Z" fill="${f}"/>
      <path d="M26 46 Q26 24 50 24 Q74 24 74 46 Q74 70 50 72 Q26 70 26 46Z" fill="${f}"/>
      <path d="M36 62 Q50 70 64 62 Q60 72 50 72 Q40 72 36 62Z" fill="${l}"/>
      <circle cx="39" cy="44" r="9.5" fill="${l}"/><circle cx="61" cy="44" r="9.5" fill="${l}"/>
      <circle cx="39" cy="44" r="6" fill="#f2a516"/><circle cx="61" cy="44" r="6" fill="#f2a516"/>
      ${eye(39, 44, 3.4)}${eye(61, 44, 3.4)}
      <path d="M46 52 L54 52 L50 60Z" fill="#e88a1a"/>${shine}` },
    { name: 'Aslan', v: [['#e8b04a', '#a85a1e', '#8a2a2a'], ['#f0d080', '#5a3418', '#1d4f8a']], draw: ([f, m, c]) => `
      ${body(c)}<g fill="${m}">${Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return `<circle cx="${(50 + Math.cos(a) * 25).toFixed(1)}" cy="${(46 + Math.sin(a) * 24).toFixed(1)}" r="9"/>`; }).join('')}<circle cx="50" cy="46" r="26"/></g>
      <circle cx="33" cy="29" r="5" fill="${f}"/><circle cx="67" cy="29" r="5" fill="${f}"/>
      <ellipse cx="50" cy="47" rx="19" ry="19" fill="${f}"/>
      <ellipse cx="50" cy="56" rx="9" ry="7" fill="#fbe6b8"/>
      ${eye(42, 43, 2.8)}${eye(58, 43, 2.8)}
      <path d="M46 51 L54 51 L50 55Z" fill="#5a2a1a"/><path d="M50 55 Q47 59 44.5 57.5 M50 55 Q53 59 55.5 57.5" stroke="#5a2a1a" stroke-width="1.1" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Köpek', v: [['#d9a066', '#fff2df', '#2e6fd6'], ['#4a3a30', '#c9a27e', '#d64545']], draw: ([f, l, c]) => `
      ${body(c, '<path d="M36 74 Q50 82 64 74" stroke="#d22" stroke-width="4" fill="none"/><circle cx="50" cy="82" r="3" fill="#f2c94c"/>')}
      <ellipse cx="50" cy="45" rx="21" ry="21" fill="${f}"/>
      <path d="M30 32 Q20 36 22 58 Q28 60 33 50Z M70 32 Q80 36 78 58 Q72 60 67 50Z" fill="#7a4a26"/>
      <ellipse cx="50" cy="56" rx="12" ry="10" fill="${l}"/>
      ${eye(42, 42, 3)}${eye(58, 42, 3)}
      <ellipse cx="50" cy="51" rx="4.5" ry="3.2" fill="#1b1410"/>
      <path d="M44 58 Q50 62 56 58" stroke="#1b1410" stroke-width="1.2" fill="none"/><path d="M47.5 59.5 Q50 67 52.5 59.5Z" fill="#e8768a"/>${shine}` },
    { name: 'Penguen', v: [['#1d2330', '#fff', '#e2a12b'], ['#2a3a5a', '#fff', '#c0392b']], draw: ([f, l, c]) => `
      ${body(f, `<path d="M36 73 Q50 80 64 73 L66 106 L34 106Z" fill="${l}"/><path d="M42 76 L50 82 L58 76 L58 81 L50 84 L42 81Z" fill="${c}"/>`)}
      <ellipse cx="50" cy="45" rx="22" ry="23" fill="${f}"/>
      <path d="M33 48 Q33 34 43 34 Q50 38 57 34 Q67 34 67 48 Q67 64 50 66 Q33 64 33 48Z" fill="${l}"/>
      ${eye(43, 44, 2.8)}${eye(57, 44, 2.8)}
      <path d="M44 51 Q50 48 56 51 L50 57Z" fill="#f29b1a"/>
      <ellipse cx="38" cy="54" rx="3" ry="1.8" fill="#f4a3b4" opacity=".6"/><ellipse cx="62" cy="54" rx="3" ry="1.8" fill="#f4a3b4" opacity=".6"/>${shine}` },
    { name: 'Maymun', v: [['#7a4e2c', '#e8c39a', '#2e9e5b'], ['#3a2a20', '#d9b48a', '#f2b52b']], draw: ([f, l, c]) => `
      ${body(c)}<circle cx="27" cy="46" r="8" fill="${f}"/><circle cx="73" cy="46" r="8" fill="${f}"/><circle cx="27" cy="46" r="4.5" fill="${l}"/><circle cx="73" cy="46" r="4.5" fill="${l}"/>
      <ellipse cx="50" cy="45" rx="22" ry="23" fill="${f}"/>
      <path d="M50 30 Q42 30 38 38 Q32 40 34 48 Q34 56 40 60 Q42 70 50 70 Q58 70 60 60 Q66 56 66 48 Q68 40 62 38 Q58 30 50 30Z" fill="${l}"/>
      ${eye(43, 44, 2.8)}${eye(57, 44, 2.8)}
      <circle cx="48" cy="54" r="1" fill="#3a2214"/><circle cx="52" cy="54" r="1" fill="#3a2214"/>
      <path d="M42 60 Q50 66 58 60" stroke="#3a2214" stroke-width="1.4" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Kaplan', v: [['#ee8a24', '#fff6e8', '#1f2a3d'], ['#f1f1ee', '#ffffff', '#4a2a7a']], draw: ([f, l, c]) => `
      ${body(c)}<circle cx="31" cy="28" r="7.5" fill="${f}"/><circle cx="69" cy="28" r="7.5" fill="${f}"/><circle cx="31" cy="28" r="4" fill="#2a1a12"/><circle cx="69" cy="28" r="4" fill="#2a1a12"/>
      <ellipse cx="50" cy="46" rx="23" ry="21" fill="${f}"/>
      <g fill="#2a1a12"><path d="M50 26 L47 34 L53 34Z"/><path d="M42 27 L44 33 L46 27Z"/><path d="M58 27 L56 33 L54 27Z"/><path d="M27 42 L36 44 L28 47Z"/><path d="M73 42 L64 44 L72 47Z"/><path d="M28 51 L36 51 L29 55Z"/><path d="M72 51 L64 51 L71 55Z"/></g>
      <ellipse cx="50" cy="56" rx="12" ry="9" fill="${l}"/>
      <ellipse cx="41" cy="44" rx="3.4" ry="3.8" fill="#e8c21a"/><ellipse cx="59" cy="44" rx="3.4" ry="3.8" fill="#e8c21a"/><ellipse cx="41" cy="44" rx="1.1" ry="3" fill="#111"/><ellipse cx="59" cy="44" rx="1.1" ry="3" fill="#111"/>
      <path d="M46.5 51 L53.5 51 L50 54.5Z" fill="#d06a7a"/><path d="M50 54.5 Q47 58.5 44.5 57 M50 54.5 Q53 58.5 55.5 57" stroke="#2a1a12" stroke-width="1.1" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Kurbağa', v: [['#5cb85c', '#d8f0b0', '#c0392b'], ['#3a8fd0', '#cfe8fa', '#f2b52b']], draw: ([f, l, c]) => `
      ${body(c)}<ellipse cx="50" cy="50" rx="25" ry="19" fill="${f}"/>
      <circle cx="38" cy="33" r="9" fill="${f}"/><circle cx="62" cy="33" r="9" fill="${f}"/>
      <circle cx="38" cy="33" r="6" fill="#fff"/><circle cx="62" cy="33" r="6" fill="#fff"/>${eye(39, 34, 3.2)}${eye(61, 34, 3.2)}
      <ellipse cx="50" cy="58" rx="16" ry="8" fill="${l}"/>
      <path d="M34 52 Q50 64 66 52" stroke="#1d4a1d" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="47" cy="45" r=".9" fill="#1d4a1d"/><circle cx="53" cy="45" r=".9" fill="#1d4a1d"/>
      <ellipse cx="33" cy="53" rx="3.5" ry="2" fill="#f4a3b4" opacity=".55"/><ellipse cx="67" cy="53" rx="3.5" ry="2" fill="#f4a3b4" opacity=".55"/>${shine}` },
  ];

  // yüz (kostümlerin altında): ten rengi s = [açık, koyu]
  const face = (s, opt = {}) => `<rect x="43" y="58" width="14" height="17" rx="3" fill="${s[1]}"/>
    <ellipse cx="50" cy="45" rx="18.5" ry="21.5" fill="${s[0]}"/>
    ${opt.noEyes ? '' : `${eye(42, 45, 2.4)}${eye(58, 45, 2.4)}`}
    ${opt.noMouth ? '' : '<path d="M44 59 Q50 64 56 59" stroke="#8a3a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>'}`;

  const COSTUMES = [
    { name: 'Ninja', v: [['#1d1f24', '#c0392b'], ['#f2f2f2', '#2d5aa8']], draw: ([k, b], s) => `
      ${body(k, `<path d="M36 74 L64 90" stroke="${b}" stroke-width="4"/>`)}
      <ellipse cx="50" cy="45" rx="21" ry="24" fill="${k}"/>
      <rect x="31" y="38" width="38" height="13" rx="6" fill="${s[0]}"/>
      <path d="M30 34 L70 34 L70 38 L30 38Z" fill="${b}"/><path d="M70 35 L82 30 L80 36 L70 37Z" fill="${b}"/>
      <path d="M36 42 L47 44 M64 42 L53 44" stroke="#1b1410" stroke-width="1.4" stroke-linecap="round"/>${eye(42, 46, 2.2)}${eye(58, 46, 2.2)}${shine}` },
    { name: 'Korsan', v: [['#1b1b1b', '#b5401f'], ['#3a2618', '#1e4fa3']], draw: ([h, sh], s) => `
      ${body(sh, '<path d="M40 73 L50 90 L60 73Z" fill="#f4f1ec"/>')}
      ${face(s)}
      <path d="M32 52 Q34 70 50 72 Q66 70 68 52 Q60 60 50 60 Q40 60 32 52Z" fill="#3a2214"/>
      <path d="M36 41 L64 37" stroke="#111" stroke-width="1.2"/><ellipse cx="58" cy="45" rx="5" ry="4.5" fill="#111"/>
      <path d="M22 30 Q50 6 78 30 Q66 26 50 27 Q34 26 22 30Z" fill="${h}"/><path d="M20 31 Q50 22 80 31 Q50 30 20 31Z" fill="#d9a52b"/>
      <circle cx="50" cy="19" r="4" fill="#fff"/><path d="M47 24 L53 24" stroke="#fff" stroke-width="1.6"/>${shine}` },
    { name: 'Astronot', v: [['#f2f2f2', '#2d6fd6'], ['#f2f2f2', '#e2662a']], draw: ([w, a], s) => `
      ${body(w, `<rect x="40" y="82" width="20" height="12" rx="2" fill="${a}"/><circle cx="45" cy="88" r="1.6" fill="#fff"/><circle cx="51" cy="88" r="1.6" fill="#f2c94c"/><circle cx="56" cy="88" r="1.6" fill="#d22"/>`)}
      <circle cx="50" cy="44" r="29" fill="${w}" stroke="#c9ced6" stroke-width="2"/>
      <ellipse cx="50" cy="46" rx="21" ry="20" fill="#1b2a44"/>
      <g transform="translate(0 2) scale(1)"><ellipse cx="50" cy="47" rx="15" ry="17" fill="${s[0]}"/>${eye(44, 46, 2)}${eye(56, 46, 2)}<path d="M45 56 Q50 60 55 56" stroke="#8a3a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>
      <path d="M33 38 Q38 28 50 27" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="19" y="40" width="5" height="12" rx="2" fill="${a}"/><rect x="76" y="40" width="5" height="12" rx="2" fill="${a}"/>` },
    { name: 'Şövalye', v: [['#b8c0cc', '#c0392b'], ['#d9b45a', '#2d5aa8']], draw: ([m, p]) => `
      ${body(m, `<path d="M40 76 L60 76 L58 96 L50 102 L42 96Z" fill="${p}"/><path d="M50 80 L50 98 M44 86 L56 86" stroke="#f2c94c" stroke-width="2.4"/>`)}
      <path d="M50 4 Q60 8 58 22" stroke="${p}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M28 46 Q28 20 50 20 Q72 20 72 46 L72 64 Q72 72 50 72 Q28 72 28 64Z" fill="${m}"/>
      <path d="M28 46 Q28 20 50 20 Q40 24 36 46 L36 66 Q30 66 28 64Z" fill="rgba(255,255,255,.3)"/>
      <rect x="32" y="42" width="36" height="5" rx="2" fill="#1b1b1b"/>
      <path d="M50 47 L50 70" stroke="rgba(0,0,0,.35)" stroke-width="1.6"/>
      <g fill="#1b1b1b"><circle cx="43" cy="56" r="1.1"/><circle cx="43" cy="61" r="1.1"/><circle cx="57" cy="56" r="1.1"/><circle cx="57" cy="61" r="1.1"/></g>` },
    { name: 'Büyücü', v: [['#3d2a8a', '#f2c94c'], ['#1e6b4f', '#e8e8e8']], draw: ([r, st], s) => `
      ${body(r)}
      ${face(s, { noMouth: true })}
      <path d="M30 50 Q30 82 50 92 Q70 82 70 50 Q62 60 50 60 Q38 60 30 50Z" fill="#eeeeee"/>
      <path d="M40 58 Q50 54 60 58 Q50 62 40 58Z" fill="#dcdcdc"/>
      <path d="M50 -2 L74 34 L26 34Z" fill="${r}"/><path d="M18 34 Q50 26 82 34 Q50 40 18 34Z" fill="${r}"/>
      <path d="M48 12 L50 8 L52 12 L56 12 L53 15 L54 19 L50 17 L46 19 L47 15 L44 12Z" fill="${st}"/><circle cx="58" cy="26" r="1.8" fill="${st}"/><circle cx="41" cy="24" r="1.3" fill="${st}"/>
      <path d="M36 39 L46 41 M64 39 L54 41" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>` },
    { name: 'Robot', v: [['#9aa6b4', '#29d3f0'], ['#d9a52b', '#ff4d6d']], draw: ([m, led]) => `
      ${body(m, `<rect x="38" y="80" width="24" height="14" rx="3" fill="#2a2f38"/><rect x="41" y="84" width="6" height="6" fill="${led}"/><rect x="50" y="84" width="9" height="2" fill="${led}"/><rect x="50" y="88" width="6" height="2" fill="${led}"/>`)}
      <path d="M50 14 L50 22" stroke="#555" stroke-width="2"/><circle cx="50" cy="12" r="3.5" fill="${led}"/>
      <rect x="44" y="64" width="12" height="10" fill="#6a7480"/>
      <rect x="27" y="22" width="46" height="44" rx="8" fill="${m}"/><rect x="27" y="22" width="46" height="10" rx="5" fill="rgba(255,255,255,.25)"/>
      <rect x="22" y="38" width="6" height="14" rx="2" fill="#6a7480"/><rect x="72" y="38" width="6" height="14" rx="2" fill="#6a7480"/>
      <rect x="33" y="36" width="34" height="13" rx="6" fill="#1b1f26"/>
      <circle cx="42" cy="42.5" r="4" fill="${led}"/><circle cx="58" cy="42.5" r="4" fill="${led}"/><circle cx="43" cy="41.5" r="1.3" fill="#fff"/><circle cx="59" cy="41.5" r="1.3" fill="#fff"/>
      <rect x="38" y="55" width="24" height="5" rx="2" fill="#1b1f26"/><path d="M42 55 L42 60 M46 55 L46 60 M50 55 L50 60 M54 55 L54 60 M58 55 L58 60" stroke="${led}" stroke-width="1"/>` },
    { name: 'Vampir', v: [['#1b1b1b', '#a8182b'], ['#2a1a3a', '#6b2a8a']], draw: ([k, red]) => `
      ${body(k, `<path d="M20 72 L36 66 L42 78 L34 82Z M80 72 L64 66 L58 78 L66 82Z" fill="${red}"/><path d="M42 73 L50 86 L58 73Z" fill="#f4f1ec"/>`)}
      ${face(['#e6e0ec', '#b9b0c4'], { noMouth: true, noEyes: true })}
      <path d="M31 38 Q31 20 50 20 Q69 20 69 38 Q62 30 56 31 L50 40 L44 31 Q38 30 31 38Z" fill="${k}"/>
      <path d="M37 42 L47 44 M63 42 L53 44" stroke="#1b1b1b" stroke-width="1.6" stroke-linecap="round"/>
      ${eye(42, 47, 2.4, '#8a0a1a')}${eye(58, 47, 2.4, '#8a0a1a')}
      <path d="M43 58 Q50 62 57 58" stroke="#5a1a2a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M45.5 59 L46.5 63 L47.5 59.5Z M54.5 59 L53.5 63 L52.5 59.5Z" fill="#fff"/>` },
    { name: 'Mumya', v: [['#e8dcc0', '#2e9e5b'], ['#d6cbb0', '#f2b52b']], draw: ([w, e]) => `
      ${body(w, '<path d="M10 92 L90 84 M8 100 L92 94 M20 80 L80 76" stroke="rgba(0,0,0,.12)" stroke-width="2"/>')}
      <rect x="43" y="60" width="14" height="15" fill="${w}"/>
      <ellipse cx="50" cy="45" rx="20" ry="23" fill="${w}"/>
      <g stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"><path d="M30 32 L70 28"/><path d="M30 52 L70 56"/><path d="M31 60 L69 64"/><path d="M32 25 L68 36"/><path d="M33 66 L67 58"/></g>
      <rect x="33" y="40" width="34" height="10" rx="4" fill="#3a2c1c"/>
      <circle cx="42" cy="45" r="3" fill="${e}"/><circle cx="58" cy="45" r="3" fill="${e}"/><circle cx="43" cy="44" r="1" fill="#fff"/><circle cx="59" cy="44" r="1" fill="#fff"/>${shine}` },
    { name: 'Süper kahraman', v: [['#d0021b', '#1e4fa3'], ['#1a8a3a', '#5b2a86']], draw: ([cape, suit], s) => `
      <path d="M14 106 Q20 74 36 70 L64 70 Q80 74 86 106Z" fill="${cape}"/>
      ${body(suit, '<path d="M42 82 L50 76 L58 82 L50 96Z" fill="#f2c94c"/><path d="M46 83 L50 80 L54 83 L50 90Z" fill="' + cape + '"/>')}
      ${face(s)}
      <path d="M31 30 Q32 18 50 18 Q68 18 69 30 Q62 24 50 25 Q38 24 31 30Z" fill="#2a1c12"/>
      <path d="M32 44 Q36 38 46 41 L50 43 L54 41 Q64 38 68 44 Q66 50 56 49 L50 46 L44 49 Q34 50 32 44Z" fill="${suit}"/>
      <ellipse cx="41.5" cy="44.5" rx="3" ry="2.2" fill="#fff"/><ellipse cx="58.5" cy="44.5" rx="3" ry="2.2" fill="#fff"/><circle cx="42" cy="44.7" r="1.4" fill="#111"/><circle cx="58" cy="44.7" r="1.4" fill="#111"/>` },
    { name: 'Kovboy', v: [['#8a5a2c', '#c0392b'], ['#2b2b2b', '#2d5aa8']], draw: ([h, b], s) => `
      ${body('#5a7aa8', `<path d="M34 73 L50 86 L66 73 L60 70 L50 78 L40 70Z" fill="${b}"/><circle cx="44" cy="76" r="1" fill="#fff"/><circle cx="56" cy="76" r="1" fill="#fff"/>`)}
      ${face(s)}
      <path d="M36 52 Q38 49 50 51 Q62 49 64 52 Q60 55 50 54 Q40 55 36 52Z" fill="#5a3418"/>
      <path d="M14 34 Q24 40 50 38 Q76 40 86 34 Q82 42 50 42 Q18 42 14 34Z" fill="${h}"/>
      <path d="M32 36 Q30 14 40 14 Q46 16 50 20 Q54 16 60 14 Q70 14 68 36Z" fill="${h}"/><path d="M32 32 L68 32 L68 36 L32 36Z" fill="rgba(0,0,0,.35)"/>${shine}` },
    { name: 'Uzaylı', v: [['#7ed957', '#5b2a86'], ['#b48ae8', '#1f7a6a']], draw: ([g, c]) => `
      ${body(c, '<circle cx="50" cy="86" r="5" fill="#f2c94c"/><circle cx="50" cy="86" r="2" fill="' + c + '"/>')}
      <path d="M38 22 Q34 10 28 8" stroke="${g}" stroke-width="2" fill="none"/><path d="M62 22 Q66 10 72 8" stroke="${g}" stroke-width="2" fill="none"/><circle cx="28" cy="8" r="3.5" fill="${g}"/><circle cx="72" cy="8" r="3.5" fill="${g}"/>
      <rect x="44" y="62" width="12" height="12" fill="${g}"/>
      <path d="M50 18 Q76 18 76 42 Q76 62 50 70 Q24 62 24 42 Q24 18 50 18Z" fill="${g}"/>
      <ellipse cx="39" cy="44" rx="8" ry="10" fill="#111" transform="rotate(-20 39 44)"/><ellipse cx="61" cy="44" rx="8" ry="10" fill="#111" transform="rotate(20 61 44)"/>
      <ellipse cx="37" cy="40" rx="2.5" ry="3.5" fill="#fff" opacity=".85"/><ellipse cx="59" cy="40" rx="2.5" ry="3.5" fill="#fff" opacity=".85"/>
      <path d="M45 60 Q50 63 55 60" stroke="#1b3a10" stroke-width="1.6" fill="none" stroke-linecap="round"/>${shine}` },
    { name: 'Maske balosu', v: [['#c8102e', '#f2c94c'], ['#1b1b1b', '#c9ced6']], draw: ([m, g], s) => `
      ${body('#2a1a2a', `<path d="M40 73 L50 84 L60 73Z" fill="#f4f1ec"/><path d="M47 77 L50 80 L53 77 L52 82 L50 84 L48 82Z" fill="${m}"/>`)}
      ${face(s, { noEyes: true })}
      <path d="M31 34 Q32 18 50 18 Q68 18 69 34 Q62 26 50 27 Q38 26 31 34Z" fill="#2a1c12"/>
      <path d="M26 42 Q30 34 44 38 Q50 41 56 38 Q70 34 74 42 Q72 52 60 52 Q54 51 50 47 Q46 51 40 52 Q28 52 26 42Z" fill="${m}" stroke="${g}" stroke-width="1.6"/>
      <ellipse cx="41" cy="44" rx="4.5" ry="3" fill="#1b1410"/><ellipse cx="59" cy="44" rx="4.5" ry="3" fill="#1b1410"/>
      <path d="M70 38 Q80 22 76 10 Q84 22 74 40Z" fill="${g}"/><path d="M72 39 Q86 30 90 18 Q90 32 74 42Z" fill="${m}" opacity=".9"/>` },
  ];

  // Tüm figürler: [tür, figür, çeşit]
  const LIST = [];
  for (const [kind, arr] of [['animal', ANIMALS], ['costume', COSTUMES]]) arr.forEach((f, i) => f.v.forEach((_, v) => LIST.push({ kind, i, v })));
  const SKINS = [['#f0c8a0', '#cf9a6e'], ['#cf9a68', '#a26a3e'], ['#8a5a36', '#5e3a1e']];
  function draw(n) {
    const it = LIST[n];
    const f = (it.kind === 'animal' ? ANIMALS : COSTUMES)[it.i];
    const inner = f.draw(f.v[it.v], SKINS[(it.i + it.v) % SKINS.length] || skinF);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
  }
  const nameOf = (n) => { const it = LIST[n]; return (it.kind === 'animal' ? ANIMALS : COSTUMES)[it.i].name; };
  return { COUNT: LIST.length, draw, nameOf, kindOf: (n) => LIST[n].kind };
})();
