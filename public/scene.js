'use strict';
// İskambil 51 - Kasaba kıraathanesi sahnesi (eski film havası)
// Durağan arka plan (tek sefer çizilir) + canlı katman (lamba, saat, soba, pencere) + toz + film greni
// Ayrıca: karakter portreleri, sandalyeler, masadaki çay ve tespih.
const Scene = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const url = (s) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}")`;
  const VB = 'viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"';

  // Ahşap doku filtresi (yön: fx fy)
  const woodFilter = (id, freq, seed, r, g, b) => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="4" seed="${seed}"/>
    <feColorMatrix values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"/>
    <feComponentTransfer><feFuncR type="table" tableValues="${r}"/><feFuncG type="table" tableValues="${g}"/><feFuncB type="table" tableValues="${b}"/></feComponentTransfer>
    <feComposite in2="SourceGraphic" operator="in"/></filter>`;
  const WR = '.15 .29 .19 .35 .23 .40 .26';
  const WG = '.075 .15 .095 .19 .12 .22 .14';
  const WB = '.03 .06 .035 .075 .045 .09 .05';

  // ================= DURAĞAN ARKA PLAN =================
  function staticSVG() {
    // lambri panelleri
    let panels = '';
    for (let x = 14; x < 1600; x += 168) {
      panels += `<rect x="${x}" y="404" width="148" height="160" rx="2" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="5"/>
        <path d="M${x + 3} 561 V407 H${x + 145}" stroke="rgba(255,205,150,.13)" stroke-width="2" fill="none"/>
        <path d="M${x + 145} 407 V561 H${x + 3}" stroke="rgba(0,0,0,.35)" stroke-width="2" fill="none"/>`;
    }
    // döşeme tahtaları (perspektif: yakına geldikçe aralık büyür)
    const ys = [600, 611, 624, 640, 659, 682, 710, 744, 785, 834, 893, 962, 1040];
    let floor = '';
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < ys.length - 1; i++) {
      floor += `<line x1="0" y1="${ys[i]}" x2="1600" y2="${ys[i]}" stroke="rgba(0,0,0,.65)" stroke-width="${1 + i * 0.25}"/>
        <line x1="0" y1="${ys[i] + 1.5 + i * 0.2}" x2="1600" y2="${ys[i] + 1.5 + i * 0.2}" stroke="rgba(255,200,140,.06)" stroke-width="1"/>`;
      let x = rnd() * 300;
      while (x < 1600) {
        floor += `<line x1="${x.toFixed(0)}" y1="${ys[i]}" x2="${(x + (x - 800) * 0.04).toFixed(0)}" y2="${ys[i + 1]}" stroke="rgba(0,0,0,.5)" stroke-width="${1 + i * 0.2}"/>`;
        x += 260 + rnd() * 420;
      }
    }
    // pencereden görünen kasaba evlerinin pencereleri (sönük hali)
    const wins = [[632, 370, 8, 9], [660, 372, 8, 9], [690, 374, 7, 8], [728, 373, 8, 9], [778, 360, 9, 10], [800, 360, 9, 10], [856, 376, 8, 8], [930, 368, 8, 10], [956, 370, 7, 9]]
      .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#4a2a14"/>`).join('');
    // raftaki çay bardakları
    let glasses = '';
    [312, 342, 372, 402, 432].forEach((cx, i) => {
      const full = i === 1 || i === 3;
      glasses += `<ellipse cx="${cx}" cy="298" rx="13" ry="3.2" fill="#d6cdbd" opacity=".85"/><ellipse cx="${cx}" cy="298" rx="13" ry="3.2" fill="none" stroke="#9a2a20" stroke-width=".9"/>
        ${full ? `<path d="M${cx - 8.5} 268 Q${cx - 9.5} 276 ${cx - 5} 282 Q${cx - 3} 286 ${cx - 5.5} 295 L${cx + 5.5} 295 Q${cx + 3} 286 ${cx + 5} 282 Q${cx + 9.5} 276 ${cx + 8.5} 268Z" fill="#8a3410" opacity=".9"/>` : ''}
        <path d="M${cx - 8} 262 Q${cx - 10} 274 ${cx - 5} 282 Q${cx - 3} 286 ${cx - 6} 296 L${cx + 6} 296 Q${cx + 3} 286 ${cx + 5} 282 Q${cx + 10} 274 ${cx + 8} 262Z" fill="rgba(220,230,235,.12)" stroke="rgba(255,250,235,.4)" stroke-width=".8"/>
        <path d="M${cx - 6} 266 Q${cx - 7} 274 ${cx - 3.5} 280" stroke="rgba(255,255,255,.45)" stroke-width="1" fill="none"/>`;
    });
    // saat kadranı çentikleri
    let ticks = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const r1 = i % 3 ? 31 : 28;
      ticks += `<line x1="${(1290 + Math.sin(a) * r1).toFixed(1)}" y1="${(188 - Math.cos(a) * r1).toFixed(1)}" x2="${(1290 + Math.sin(a) * 34).toFixed(1)}" y2="${(188 - Math.cos(a) * 34).toFixed(1)}" stroke="#2a1a10" stroke-width="${i % 3 ? 1.2 : 2.4}"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" ${VB}>
<defs>
  <filter id="fine" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .08  0 0 0 0 .05  0 0 0 0 .02  0 0 0 -1 .62"/></filter>
  <filter id="stain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0045 .008" numOctaves="5" seed="9"/><feColorMatrix values="0 0 0 0 .12  0 0 0 0 .065  0 0 0 0 .02  1.9 0 0 0 -.78"/></filter>
  <filter id="plaster" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="21" result="n"/><feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#d9b98a" result="l"><feDistantLight azimuth="240" elevation="58"/></feDiffuseLighting><feColorMatrix in="l" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 .22"/></filter>
  ${woodFilter('woodV', '.09 .0035', 2, WR, WG, WB)}
  ${woodFilter('woodH', '.0022 .12', 5, WR, WG, WB)}
  ${woodFilter('woodF', '.03 .006', 8, '.2 .34 .24 .4', '.1 .18 .12 .22', '.04 .07 .05 .09')}
  <radialGradient id="wallL" cx="50%" cy="22%" r="80%"><stop offset="0" stop-color="#a5845a"/><stop offset=".3" stop-color="#7a5c38"/><stop offset=".7" stop-color="#3d2b19"/><stop offset="1" stop-color="#1a110a"/></radialGradient>
  <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a2c"/><stop offset=".35" stop-color="#5a3818"/><stop offset="1" stop-color="#1e1108"/></linearGradient>
  <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(0,0,0,.6)"/><stop offset=".25" stop-color="rgba(0,0,0,.2)"/><stop offset=".7" stop-color="rgba(0,0,0,.3)"/><stop offset="1" stop-color="rgba(0,0,0,.75)"/></linearGradient>
  <radialGradient id="pool"><stop offset="0" stop-color="rgba(255,205,140,.2)"/><stop offset="1" stop-color="rgba(255,205,140,0)"/></radialGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2848"/><stop offset=".35" stop-color="#6e3c54"/><stop offset=".65" stop-color="#c8623e"/><stop offset=".85" stop-color="#f2a654"/><stop offset="1" stop-color="#ffd98c"/></linearGradient>
  <radialGradient id="sunG"><stop offset="0" stop-color="rgba(255,240,190,.95)"/><stop offset=".25" stop-color="rgba(255,200,110,.55)"/><stop offset="1" stop-color="rgba(255,170,80,0)"/></radialGradient>
  <linearGradient id="glassRef" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.12)"/><stop offset=".3" stop-color="rgba(255,255,255,0)"/><stop offset=".55" stop-color="rgba(255,255,255,.07)"/><stop offset=".62" stop-color="rgba(255,255,255,0)"/></linearGradient>
  <linearGradient id="frameW" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4626"/><stop offset=".5" stop-color="#3e2612"/><stop offset="1" stop-color="#22140a"/></linearGradient>
  <linearGradient id="curt" x1="0" y1="0" x2=".22" y2="0" spreadMethod="reflect"><stop offset="0" stop-color="#3e100c"/><stop offset=".55" stop-color="#8a2e22"/><stop offset="1" stop-color="#5a1812"/></linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e4a14"/><stop offset=".25" stop-color="#e8c66e"/><stop offset=".45" stop-color="#fff0b8"/><stop offset=".7" stop-color="#b8862e"/><stop offset="1" stop-color="#5a3a0c"/></linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#070707"/><stop offset=".3" stop-color="#3c3936"/><stop offset=".42" stop-color="#55504a"/><stop offset=".7" stop-color="#1a1918"/><stop offset="1" stop-color="#050505"/></linearGradient>
  <linearGradient id="copper" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a2410"/><stop offset=".35" stop-color="#d9824a"/><stop offset=".5" stop-color="#ffc08a"/><stop offset=".75" stop-color="#a04a20"/><stop offset="1" stop-color="#4a1a08"/></linearGradient>
  <linearGradient id="clockW" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1508"/><stop offset=".3" stop-color="#7a4a22"/><stop offset=".5" stop-color="#8e5a2c"/><stop offset="1" stop-color="#2a1508"/></linearGradient>
  <linearGradient id="sepia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8c09a"/><stop offset=".6" stop-color="#a88a5e"/><stop offset="1" stop-color="#6a5232"/></linearGradient>
  <radialGradient id="porc" cx="40%" cy="35%"><stop offset="0" stop-color="#fffdf4"/><stop offset=".7" stop-color="#d9d0bc"/><stop offset="1" stop-color="#8a8070"/></radialGradient>
  <radialGradient id="vig" cx="50%" cy="42%" r="75%"><stop offset=".42" stop-color="rgba(8,4,2,0)"/><stop offset="1" stop-color="rgba(8,4,2,.82)"/></radialGradient>
  <pattern id="grille" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#8a6e48"/><path d="M0 2H4M2 0V4" stroke="#5a4428" stroke-width=".8"/></pattern>
  <clipPath id="winC"><rect x="618" y="104" width="364" height="288"/></clipPath>
</defs>

<!-- duvar: sıva -->
<rect width="1600" height="600" fill="url(#wallL)"/>
<rect width="1600" height="600" filter="url(#plaster)"/>
<rect width="1600" height="600" filter="url(#stain)"/>
<rect width="1600" height="600" filter="url(#fine)"/>
<rect width="1600" height="24" fill="#140c06"/><rect y="24" width="1600" height="7" fill="url(#rail)"/>

<!-- lambri -->
<rect y="380" width="1600" height="205" fill="#000" filter="url(#woodV)"/>
<rect y="380" width="1600" height="205" fill="url(#wallL)" opacity=".45" style="mix-blend-mode:multiply"/>
${panels}
<rect y="368" width="1600" height="17" fill="url(#rail)"/>
<rect y="385" width="1600" height="6" fill="rgba(0,0,0,.4)"/>
<rect y="580" width="1600" height="22" fill="#170d06"/><rect y="580" width="1600" height="2" fill="rgba(255,200,140,.1)"/>

<!-- döşeme -->
<rect y="600" width="1600" height="400" fill="#000" filter="url(#woodH)"/>
${floor}
<rect y="600" width="1600" height="400" filter="url(#fine)" opacity=".8"/>
<ellipse cx="800" cy="770" rx="680" ry="210" fill="url(#pool)"/>
<rect y="600" width="1600" height="400" fill="url(#floorShade)"/>

<!-- tabela -->
<rect x="642" y="34" width="316" height="42" rx="3" fill="#000" filter="url(#woodF)"/>
<rect x="642" y="34" width="316" height="42" rx="3" fill="none" stroke="#b8923e" stroke-width="2.5"/>
<rect x="648" y="40" width="304" height="30" rx="2" fill="none" stroke="rgba(184,146,62,.45)" stroke-width="1"/>
<text x="800" y="63.5" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="22" font-weight="700" letter-spacing="7" fill="#e8c77a" stroke="#4a3010" stroke-width=".6">KIRAATHANE</text>
<rect x="642" y="34" width="316" height="42" rx="3" filter="url(#stain)" opacity=".6"/>

<!-- pencere: dışarıda kasaba, gün batımı -->
<g clip-path="url(#winC)">
  <rect x="618" y="104" width="364" height="288" fill="url(#sky)"/>
  <circle cx="905" cy="318" r="80" fill="url(#sunG)"/>
  <circle cx="905" cy="318" r="17" fill="#fff2c4"/>
  <path d="M618 330 L660 302 L700 318 L745 288 L800 312 L850 294 L905 316 L950 297 L982 310 V392 H618Z" fill="#7a4a56" opacity=".7"/>
  <path d="M618 346 L680 328 L740 341 L820 324 L900 339 L982 329 V392 H618Z" fill="#553240"/>
  <path d="M836 255 v137 M822 262 h32" stroke="#1a1016" stroke-width="3.5"/>
  <path d="M618 262 Q720 284 838 264 T982 272 M618 270 Q720 292 838 270 T982 280" stroke="#1a1016" stroke-width="1" fill="none"/>
  <g fill="#2e1c24"><path d="M652 356 Q652 318 692 315 Q732 318 732 356Z"/><rect x="646" y="352" width="92" height="40"/><rect x="690" y="303" width="3" height="13"/><circle cx="691.5" cy="302" r="2.5"/>
    <rect x="740" y="248" width="9" height="110"/><path d="M738 250 L744.5 218 L751 250Z"/><rect x="735.5" y="284" width="18" height="4"/><rect x="737" y="288" width="15" height="2.5"/></g>
  <g fill="#22140e" stroke="#3e2016" stroke-width="1.2">
    <path d="M618 392 V358 L648 339 L680 358 V392Z"/><path d="M672 392 V364 L712 347 L752 364 V392Z"/>
    <path d="M758 392 V350 L800 330 L842 350 V392Z"/><rect x="768" y="355" width="52" height="24" fill="#2a1912"/>
    <path d="M842 392 V367 L880 349 L918 367 V392Z"/><path d="M912 392 V357 L946 339 L982 357 V392Z"/>
  </g>
  ${wins}
  <rect x="963" y="320" width="3" height="72" fill="#140c08"/><path d="M958 320 h13 l-3 -8 h-7z" fill="#140c08"/>
  <rect x="618" y="104" width="364" height="288" fill="url(#glassRef)"/>
  <rect x="618" y="104" width="364" height="288" filter="url(#stain)" opacity=".55"/>
</g>
<path fill-rule="evenodd" fill="url(#frameW)" d="M600 86 H1000 V410 H600Z M618 104 V392 H982 V104Z"/>
<rect x="600" y="86" width="400" height="324" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="2"/>
<g fill="url(#frameW)"><rect x="794" y="104" width="12" height="288"/><rect x="618" y="194" width="364" height="8"/><rect x="618" y="292" width="364" height="8"/></g>
<path d="M618 104 H982 M618 202 H982 M618 300 H982" stroke="rgba(255,210,160,.12)" stroke-width="1"/>
<rect x="586" y="392" width="428" height="19" fill="url(#rail)"/><rect x="594" y="411" width="412" height="12" fill="rgba(0,0,0,.45)"/>
<!-- perdeler -->
<rect x="566" y="64" width="468" height="7" rx="3" fill="url(#brass)"/><circle cx="566" cy="67.5" r="7" fill="url(#brass)"/><circle cx="1034" cy="67.5" r="7" fill="url(#brass)"/>
<path d="M584 70 Q600 240 580 436 L662 436 Q644 330 652 250 Q664 160 668 70Z" fill="url(#curt)"/>
<path d="M584 70 Q600 240 580 436 L662 436 Q644 330 652 250 Q664 160 668 70Z" filter="url(#stain)" opacity=".6"/>
<path d="M584 252 Q620 262 656 250" stroke="#c9a24a" stroke-width="5" fill="none"/>
<path d="M1016 70 Q1000 240 1020 436 L938 436 Q956 330 948 250 Q936 160 932 70Z" fill="url(#curt)"/>
<path d="M1016 70 Q1000 240 1020 436 L938 436 Q956 330 948 250 Q936 160 932 70Z" filter="url(#stain)" opacity=".6"/>
<path d="M1016 252 Q980 262 944 250" stroke="#c9a24a" stroke-width="5" fill="none"/>

<!-- tablo -->
<rect x="296" y="112" width="168" height="124" fill="url(#brass)"/>
<rect x="306" y="122" width="148" height="104" fill="url(#sepia)"/>
<path d="M306 196 Q360 180 400 192 T454 186 V226 H306Z" fill="#7a603a"/><path d="M306 206 H454 V226 H306Z" fill="#5e4828"/>
<path d="M360 204 l18 0 l-3 5 l-12 0z M369 204 v-20 l9 16z" fill="#3a2a16"/><circle cx="420" cy="146" r="9" fill="#efdcb2" opacity=".8"/>
<rect x="306" y="122" width="148" height="104" filter="url(#stain)"/>
<rect x="296" y="112" width="168" height="124" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>
<rect x="300" y="236" width="164" height="8" fill="rgba(0,0,0,.35)"/>

<!-- raf: semaver, bardaklar, radyo -->
<rect x="200" y="312" width="380" height="12" fill="rgba(0,0,0,.4)"/>
<rect x="200" y="300" width="380" height="12" fill="url(#rail)"/>
<path d="M226 312 h14 l-14 30z M542 312 h14 v30z" fill="#2a170a"/>
<ellipse cx="255" cy="298" rx="27" ry="5" fill="#5a3a0c"/>
<path d="M232 296 Q225 250 238 222 L272 222 Q285 250 278 296Z" fill="url(#brass)"/>
<path d="M232 296 Q225 250 238 222 L272 222 Q285 250 278 296Z" filter="url(#stain)" opacity=".5"/>
<rect x="243" y="208" width="24" height="15" fill="url(#brass)"/><path d="M239 210 Q255 196 271 210Z" fill="url(#brass)"/>
<path d="M227 240 q-9 4 -4 14 M283 240 q9 4 4 14" stroke="#8a6020" stroke-width="3" fill="none"/>
<path d="M279 270 h15 v5 h-11z" fill="#c69a46"/>
<ellipse cx="255" cy="188" rx="16" ry="13" fill="url(#porc)"/><path d="M270 186 q10 -6 12 -14" stroke="#d6cfbe" stroke-width="3" fill="none"/>
<ellipse cx="255" cy="176" rx="8" ry="3" fill="#e9e2d2"/><circle cx="255" cy="173" r="2.2" fill="#c69a46"/><circle cx="251" cy="190" r="3.2" fill="#a3261c" opacity=".7"/>
${glasses}
<path d="M470 300 V252 Q470 226 515 226 Q560 226 560 252 V300Z" fill="#000" filter="url(#woodF)"/>
<path d="M470 300 V252 Q470 226 515 226 Q560 226 560 252 V300Z" fill="none" stroke="#1a0e06" stroke-width="1.5"/>
<path d="M481 276 V254 Q481 236 515 236 Q549 236 549 254 V276Z" fill="url(#grille)"/>
<rect x="481" y="280" width="68" height="9" rx="2" fill="#e8bd62" opacity=".8"/><circle cx="488" cy="295" r="3" fill="#c69a46"/><circle cx="542" cy="295" r="3" fill="#c69a46"/>

<!-- askı ve kasket, duvara dayalı sandalye -->
<circle cx="145" cy="330" r="4" fill="url(#brass)"/>
<path d="M112 350 Q114 332 146 330 Q176 331 178 348 Q160 344 140 345 Q122 346 112 350Z" fill="#3a3530"/><path d="M106 352 Q130 340 168 345 Q160 356 132 356 Q114 356 106 352Z" fill="#2a2622"/>
<ellipse cx="146" cy="656" rx="74" ry="11" fill="rgba(0,0,0,.55)"/>
<g stroke="#3a200c" stroke-linecap="round" fill="none">
  <path d="M110 532 Q98 436 146 424 Q194 436 182 532" stroke-width="8"/><path d="M124 530 Q118 456 146 448 Q174 456 168 530" stroke-width="5"/>
  <path d="M104 548 L92 652 M188 548 L200 652 M126 552 L122 642 M166 552 L170 642" stroke-width="6"/>
  <ellipse cx="146" cy="612" rx="44" ry="7" stroke-width="3.5"/>
</g>
<ellipse cx="146" cy="542" rx="54" ry="13" fill="#5a3416"/><ellipse cx="146" cy="539" rx="46" ry="9" fill="#9a7444"/><ellipse cx="146" cy="539" rx="46" ry="9" fill="url(#grille)" opacity=".5"/>

<!-- duvar saati (gövde) -->
<path d="M1234 132 Q1290 92 1346 132 V144 H1234Z" fill="url(#clockW)"/>
<rect x="1242" y="142" width="96" height="292" rx="4" fill="url(#clockW)"/>
<rect x="1242" y="142" width="96" height="292" rx="4" filter="url(#stain)" opacity=".6"/>
<circle cx="1290" cy="188" r="40" fill="url(#brass)"/><circle cx="1290" cy="188" r="36" fill="#efe4c8"/><circle cx="1290" cy="188" r="36" filter="url(#stain)" opacity=".5"/>
${ticks}
<g font-family="Georgia,serif" font-size="10" fill="#2a1a10" text-anchor="middle"><text x="1290" y="166">XII</text><text x="1313" y="191.5">III</text><text x="1290" y="217">VI</text><text x="1267" y="191.5">IX</text></g>
<rect x="1256" y="238" width="68" height="172" rx="30" fill="#0e0804" stroke="url(#brass)" stroke-width="3"/>
<path d="M1262 250 Q1268 300 1262 396" stroke="rgba(255,255,255,.1)" stroke-width="3" fill="none"/>
<path d="M1250 434 h80 l-12 18 h-56z" fill="url(#clockW)"/>
<!-- takvim (yazıları canlı katmanda) -->
<rect x="1354" y="204" width="80" height="102" rx="2" fill="#2a1a0e"/><circle cx="1394" cy="198" r="3" fill="url(#brass)"/><path d="M1394 198 L1366 206 M1394 198 L1422 206" stroke="#1a1008" stroke-width="1"/>
<rect x="1360" y="222" width="68" height="78" fill="#efe6cc"/><rect x="1360" y="222" width="68" height="18" fill="#9a2a20"/>
<path d="M1360 300 h68 v3 h-68z M1360 303 h68 v2 h-68z" fill="#d8ccae"/>

<!-- soba ve boru -->
<rect x="1466" y="96" width="20" height="378" fill="url(#iron)"/>
${[140, 230, 320, 410].map((y) => `<rect x="1463" y="${y}" width="26" height="6" fill="url(#iron)"/>`).join('')}
<path d="M1466 96 h20 v-20 h-40 v20z" fill="url(#iron)"/>
<ellipse cx="1476" cy="666" rx="84" ry="13" fill="rgba(0,0,0,.6)"/>
<rect x="1428" y="640" width="9" height="24" fill="#0a0a0a"/><rect x="1515" y="640" width="9" height="24" fill="#0a0a0a"/>
<path d="M1418 648 V500 Q1418 470 1476 470 Q1534 470 1534 500 V648Z" fill="url(#iron)"/>
<path d="M1418 648 V500 Q1418 470 1476 470 Q1534 470 1534 500 V648Z" filter="url(#stain)"/>
<ellipse cx="1476" cy="472" rx="60" ry="10" fill="#2a2826"/><ellipse cx="1476" cy="470" rx="54" ry="7" fill="#161514"/>
<rect x="1444" y="556" width="62" height="56" rx="5" fill="#0b0b0b" stroke="#4a4642" stroke-width="2"/>
<rect x="1418" y="520" width="116" height="5" fill="#55504a" opacity=".6"/><rect x="1418" y="628" width="116" height="5" fill="#55504a" opacity=".6"/>
<!-- sobanın üstünde bakır çaydanlık -->
<ellipse cx="1476" cy="466" rx="28" ry="5" fill="rgba(0,0,0,.6)"/>
<path d="M1452 466 Q1446 440 1460 430 L1492 430 Q1506 440 1500 466Z" fill="url(#copper)"/>
<path d="M1500 452 Q1514 446 1520 430" stroke="#a04a20" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M1458 430 Q1476 404 1494 430" stroke="#2a1a10" stroke-width="3" fill="none"/>
<ellipse cx="1476" cy="430" rx="16" ry="3.5" fill="#c06a36"/><circle cx="1476" cy="426" r="3" fill="#2a1a10"/>

<rect width="1600" height="1000" fill="url(#vig)"/>
</svg>`;
  }

  // ================= CANLI KATMAN =================
  function lamp(x, phase) {
    return `<g>
      <animateTransform attributeName="transform" type="rotate" values="-1.7 ${x} 0;1.7 ${x} 0;-1.7 ${x} 0" keyTimes="0;.5;1" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="7s" begin="-${phase}s" repeatCount="indefinite"/>
      <path d="M${x - 36} 214 L${x - 300} 1000 L${x + 300} 1000 L${x + 36} 214Z" fill="url(#cone)" style="mix-blend-mode:screen"/>
      <line x1="${x}" y1="0" x2="${x}" y2="172" stroke="#100804" stroke-width="2.5"/>
      <rect x="${x - 6}" y="168" width="12" height="14" rx="2" fill="url(#lBrass)"/>
      <path d="M${x - 9} 180 Q${x - 16} 186 ${x - 52} 216 L${x + 52} 216 Q${x + 16} 186 ${x + 9} 180Z" fill="url(#shade)"/>
      <path d="M${x - 9} 181 Q${x - 14} 186 ${x - 30} 202" stroke="rgba(255,255,255,.25)" stroke-width="2" fill="none"/>
      <ellipse cx="${x}" cy="216" rx="52" ry="6" fill="#f2e6c8"/>
      <ellipse cx="${x}" cy="218" rx="11" ry="8" fill="#fff8dc"/>
      <circle cx="${x}" cy="222" r="80" fill="url(#bulb)"><animate attributeName="opacity" values=".85;1;.9;1;.78;1;.95" dur="3.3s" begin="-${phase}s" repeatCount="indefinite"/></circle>
    </g>`;
  }
  function cloud(y, s, dur, begin) {
    return `<g opacity=".7"><animateTransform attributeName="transform" type="translate" from="990 ${y}" to="450 ${y}" dur="${dur}s" begin="-${begin}s" repeatCount="indefinite"/>
      <g transform="scale(${s})"><ellipse cx="60" cy="10" rx="56" ry="11" fill="#7a4a62"/><ellipse cx="44" cy="2" rx="30" ry="12" fill="#e89a78"/><ellipse cx="78" cy="0" rx="26" ry="10" fill="#f2b088"/><ellipse cx="62" cy="-6" rx="20" ry="9" fill="#ffc89a"/></g></g>`;
  }
  function bird(begin, y, dur) {
    return `<g><animateTransform attributeName="transform" type="translate" values="590 ${y};1000 ${y - 40}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      <path stroke="#1a1014" stroke-width="1.5" fill="none" stroke-linecap="round" d="M0 0 q4 -4 8 0 q4 -4 8 0"><animate attributeName="d" values="M0 0 q4 -4 8 0 q4 -4 8 0;M0 0 q4 3 8 0 q4 3 8 0;M0 0 q4 -4 8 0 q4 -4 8 0" dur=".55s" repeatCount="indefinite"/></path></g>`;
  }
  function liveSVG() {
    const winLights = [[632, 370, 8, 9, '3.7'], [690, 374, 7, 8, '5.3'], [778, 360, 9, 10, '4.1'], [800, 360, 9, 10, '6.2'], [930, 368, 8, 10, '2.9']]
      .map(([x, y, w, h, d]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffb24a"><animate attributeName="opacity" values=".95;.7;1;.82;.95;.6;.95" dur="${d}s" repeatCount="indefinite"/></rect>`).join('');
    const steam = (x, y, d) => `<path d="M${x} ${y} c-6 -10 6 -16 0 -28 c-5 -9 5 -14 1 -24" fill="none" stroke="rgba(255,248,235,.5)" stroke-width="4" stroke-linecap="round" filter="url(#sBlur)" opacity="0">
      <animate attributeName="opacity" values="0;.7;0" dur="4s" begin="${d}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 6;3 -26" dur="4s" begin="${d}s" repeatCount="indefinite"/></path>`;
    return `<svg class="sc-live" xmlns="http://www.w3.org/2000/svg" ${VB}>
<defs>
  <clipPath id="panesC"><rect x="618" y="104" width="176" height="90"/><rect x="806" y="104" width="176" height="90"/><rect x="618" y="202" width="176" height="90"/><rect x="806" y="202" width="176" height="90"/><rect x="618" y="300" width="176" height="92"/><rect x="806" y="300" width="176" height="92"/></clipPath>
  <clipPath id="clkC"><rect x="1256" y="238" width="68" height="172" rx="30"/></clipPath>
  <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,215,150,.26)"/><stop offset=".55" stop-color="rgba(255,205,140,.07)"/><stop offset="1" stop-color="rgba(255,200,130,0)"/></linearGradient>
  <radialGradient id="bulb"><stop offset="0" stop-color="rgba(255,244,200,.95)"/><stop offset=".18" stop-color="rgba(255,214,140,.45)"/><stop offset="1" stop-color="rgba(255,190,110,0)"/></radialGradient>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0e2418"/><stop offset=".4" stop-color="#3c6e4c"/><stop offset=".6" stop-color="#2a5238"/><stop offset="1" stop-color="#0a1a10"/></linearGradient>
  <linearGradient id="lBrass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e4a14"/><stop offset=".45" stop-color="#fff0b8"/><stop offset="1" stop-color="#5a3a0c"/></linearGradient>
  <radialGradient id="bob" cx="38%" cy="35%"><stop offset="0" stop-color="#fff2c0"/><stop offset=".5" stop-color="#c9983c"/><stop offset="1" stop-color="#5a3a0c"/></radialGradient>
  <radialGradient id="fire" cx="50%" cy="80%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".35" stop-color="#ffa030"/><stop offset=".8" stop-color="#c03a08"/><stop offset="1" stop-color="#4a0e00"/></radialGradient>
  <radialGradient id="fGlow"><stop offset="0" stop-color="rgba(255,140,50,.4)"/><stop offset="1" stop-color="rgba(255,120,40,0)"/></radialGradient>
  <radialGradient id="sLamp"><stop offset="0" stop-color="rgba(255,230,160,.95)"/><stop offset="1" stop-color="rgba(255,200,110,0)"/></radialGradient>
  <filter id="sBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
</defs>
<g clip-path="url(#panesC)">
  ${cloud(140, 1, 95, 10)}${cloud(176, 0.7, 120, 70)}${cloud(232, 1.25, 80, 45)}
  ${bird(2, 214, 17)}${bird(2.4, 222, 17)}${bird(9, 180, 21)}
  ${winLights}
  <circle cx="964.5" cy="317" r="16" fill="url(#sLamp)"><animate attributeName="opacity" values="1;.55;1;.9;1" dur="2.3s" repeatCount="indefinite"/></circle>
</g>
<!-- radyo kadranı -->
<rect x="481" y="280" width="68" height="9" rx="2" fill="#ffd27a"><animate attributeName="opacity" values=".25;.55;.35;.5;.25" dur="6s" repeatCount="indefinite"/></rect>
<line x1="506" y1="280" x2="506" y2="289" stroke="#7a1a10" stroke-width="1.5"/>
<!-- saat: sarkaç ve akrep/yelkovan -->
<g clip-path="url(#clkC)"><g>
  <animateTransform attributeName="transform" type="rotate" values="-7 1290 238;7 1290 238;-7 1290 238" keyTimes="0;.5;1" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1" dur="2s" repeatCount="indefinite"/>
  <line x1="1290" y1="238" x2="1290" y2="372" stroke="url(#lBrass)" stroke-width="3"/>
  <circle cx="1290" cy="378" r="14" fill="url(#bob)"/>
</g></g>
<line id="clkH" x1="1290" y1="190" x2="1290" y2="168" stroke="#1a120a" stroke-width="3.4" stroke-linecap="round"/>
<line id="clkM" x1="1290" y1="192" x2="1290" y2="159" stroke="#1a120a" stroke-width="2.2" stroke-linecap="round"/>
<line id="clkS" x1="1290" y1="196" x2="1290" y2="157" stroke="#9a1a10" stroke-width="1"/>
<circle cx="1290" cy="188" r="2.6" fill="#1a120a"/>
<!-- takvim -->
<g font-family="Georgia,serif" text-anchor="middle">
  <text id="calM" x="1394" y="235" font-size="10" fill="#f6e8c8" letter-spacing="1.5"></text>
  <text id="calD" x="1394" y="278" font-size="34" font-weight="700" fill="#2a1a10"></text>
  <text id="calW" x="1394" y="293" font-size="9" fill="#6a4a30" letter-spacing="1"></text>
</g>
<!-- soba ateşi -->
<ellipse cx="1476" cy="690" rx="190" ry="48" fill="url(#fGlow)"><animate attributeName="opacity" values=".8;1;.7;.95;.75;1;.8" dur="1.9s" repeatCount="indefinite"/></ellipse>
<g>${[1452, 1466, 1480, 1494].map((x, i) => `<rect x="${x}" y="566" width="6" height="36" rx="2" fill="url(#fire)"><animate attributeName="opacity" values="1;.6;.9;.7;1;.55;1" dur="${(1.1 + i * 0.27).toFixed(2)}s" repeatCount="indefinite"/></rect>`).join('')}</g>
${steam(1520, 428, 0)}${steam(1522, 428, 1.4)}${steam(1518, 428, 2.7)}
${lamp(520, 0)}${lamp(1080, 2.3)}
</svg>`;
  }

  // ================= TOZ ZERRECİKLERİ =================
  function dust(cv) {
    const g = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * dpr; cv.height = h * dpr; };
    fit();
    addEventListener('resize', fit);
    const P = [];
    const N = innerWidth < 600 ? 34 : 72;
    for (let i = 0; i < N; i++) P.push({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.5, vx: (Math.random() - 0.5) * 0.12, vy: -0.03 - Math.random() * 0.12, ph: Math.random() * 6.28, sp: 0.008 + Math.random() * 0.03 });
    let last = 0;
    const step = (t) => {
      requestAnimationFrame(step);
      if (document.hidden || t - last < 33) return;
      last = t;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      for (const p of P) {
        p.ph += p.sp;
        p.x += p.vx + Math.sin(p.ph) * 0.09;
        p.y += p.vy;
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
        if (p.x < -6) p.x = w + 6; else if (p.x > w + 6) p.x = -6;
        const a = 0.12 + 0.38 * (0.5 + 0.5 * Math.sin(p.ph * 1.7));
        g.fillStyle = `rgba(255,228,175,${a.toFixed(3)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.2832); g.fill();
      }
    };
    requestAnimationFrame(step);
  }

  // ================= SAAT VE TAKVİM =================
  const AY = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  const GUN = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'];
  function tick() {
    const d = new Date();
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
    const rot = (id, a) => { const el = document.getElementById(id); if (el) el.setAttribute('transform', `rotate(${a.toFixed(2)} 1290 188)`); };
    rot('clkH', hr * 30); rot('clkM', m * 6); rot('clkS', s * 6);
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    set('calM', AY[d.getMonth()]);
    set('calD', String(d.getDate()));
    set('calW', GUN[d.getDay()]);
    const cd = document.getElementById('calD');
    if (cd) cd.setAttribute('fill', d.getDay() === 0 ? '#9a2a20' : '#2a1a10');
  }

  // ================= FİLM KATMANI =================
  const GRAIN = url(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 .55"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
  function film() {
    const f = document.createElement('div');
    f.id = 'film';
    f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<div class="grain"></div><div class="vig"></div><div class="flick"></div><div class="scratch"></div><div class="scratch"></div>';
    f.querySelector('.grain').style.backgroundImage = GRAIN;
    document.body.appendChild(f);
    if (reduce) return;
    const sc = f.querySelectorAll('.scratch');
    const fire = () => {
      const el = sc[Math.random() < 0.5 ? 0 : 1];
      el.style.left = (5 + Math.random() * 90).toFixed(1) + '%';
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
      setTimeout(fire, 2500 + Math.random() * 6000);
    };
    setTimeout(fire, 3000);
  }

  // ================= PORTRE (göz kırpan kasabalı) =================
  function portrait(seed, uid) {
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const skin = pick([['#f0c49a', '#b97e52'], ['#e2ae80', '#a46a40'], ['#d29a6a', '#8e5630'], ['#c08458', '#7a4422']]);
    const jacket = pick(['#3b2f28', '#2d3440', '#4a3b2a', '#383830', '#4a2a22']);
    const capC = pick(['#4a3a2a', '#3a3f45', '#5a4632', '#2f2a26', '#5a554e']);
    const hairC = pick(['#1a120c', '#2a1c12', '#5a5048', '#8a8278']);
    const cap = r() < 0.7;
    const stache = Math.floor(r() * 3);
    const blink = (3.5 + r() * 4).toFixed(1);
    const id = (n) => `${uid}${n}`;
    const must = [
      `<path d="M38 60 Q44 55 50 58 Q56 55 62 60 Q56 63 50 61 Q44 63 38 60Z" fill="${hairC}"/>`,
      `<path d="M36 61 Q42 54 50 57.5 Q58 54 64 61 Q66 64 63 64 Q58 60 50 60.5 Q42 60 37 64 Q34 64 36 61Z" fill="${hairC}"/>`,
      `<path d="M40 59.5 Q50 55 60 59.5 Q50 61.5 40 59.5Z" fill="${hairC}" opacity=".85"/>`,
    ][stache];
    const top = cap
      ? `<path d="M29 41 Q30 20 52 19 Q72 20 72 38 Q62 33 48 34 Q37 35 29 41Z" fill="url(#${id('c')})"/>
         <path d="M27 42 Q44 32 66 35 Q64 42 46 43 Q34 44 27 42Z" fill="${capC}" opacity=".95"/><path d="M27 42 Q44 32 66 35" stroke="rgba(0,0,0,.4)" stroke-width="1" fill="none"/>
         <circle cx="51" cy="21" r="1.8" fill="${capC}"/>`
      : `<path d="M31 44 Q30 24 50 23 Q70 24 69 44 Q66 33 50 32 Q36 33 31 44Z" fill="${hairC}"/>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
      <radialGradient id="${id('b')}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#d9bd8a"/><stop offset=".6" stop-color="#8a6a40"/><stop offset="1" stop-color="#3a2614"/></radialGradient>
      <radialGradient id="${id('s')}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${skin[0]}"/><stop offset="1" stop-color="${skin[1]}"/></radialGradient>
      <linearGradient id="${id('j')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${jacket}"/><stop offset="1" stop-color="#0c0806"/></linearGradient>
      <linearGradient id="${id('c')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${capC}"/><stop offset="1" stop-color="#14100c"/></linearGradient>
      <radialGradient id="${id('v')}" r="60%"><stop offset=".6" stop-color="rgba(20,10,4,0)"/><stop offset="1" stop-color="rgba(20,10,4,.6)"/></radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#${id('b')})"/>
    <path d="M8 104 Q12 76 36 71 L64 71 Q88 76 92 104Z" fill="url(#${id('j')})"/>
    <path d="M40 71 L50 86 L60 71Z" fill="#e8dfcc"/><path d="M46 74 L50 86 L54 74Z" fill="#7a2a20"/>
    <rect x="43" y="58" width="14" height="15" fill="${skin[1]}"/>
    <ellipse cx="31" cy="48" rx="4" ry="6.5" fill="${skin[1]}"/><ellipse cx="69" cy="48" rx="4" ry="6.5" fill="${skin[1]}"/>
    <ellipse cx="50" cy="46" rx="18.5" ry="21.5" fill="url(#${id('s')})"/>
    ${cap ? `<path d="M31 44 Q31 50 33 52 L33 44Z M69 44 Q69 50 67 52 L67 44Z" fill="${hairC}"/>` : ''}
    <path d="M38 40 Q42 37.5 46 39.5 M54 39.5 Q58 37.5 62 40" stroke="${hairC}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <g fill="#1a100a"><ellipse cx="42.5" cy="45" rx="2" ry="2"><animate attributeName="ry" values="2;2;.2;2" keyTimes="0;.94;.97;1" dur="${blink}s" repeatCount="indefinite"/></ellipse>
      <ellipse cx="57.5" cy="45" rx="2" ry="2"><animate attributeName="ry" values="2;2;.2;2" keyTimes="0;.94;.97;1" dur="${blink}s" repeatCount="indefinite"/></ellipse></g>
    <path d="M50 46 Q48 53 46.5 55 Q50 56.5 53 55" stroke="${skin[1]}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${must}
    <path d="M45 64.5 Q50 66 55 64.5" stroke="#6a3020" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="43" cy="34" rx="8" ry="4" fill="rgba(255,255,255,.18)"/>
    ${top}
    <circle cx="50" cy="50" r="50" fill="url(#${id('v')})"/>
    </svg>`;
  }

  // ================= MASA ÇEVRESİ: sandalye, çay, tespih =================
  const CHAIR = `<svg viewBox="0 0 200 200" aria-hidden="true"><defs>
    <radialGradient id="chS" cx="42%" cy="38%" r="70%"><stop offset="0" stop-color="#dcb67e"/><stop offset=".6" stop-color="#a57a45"/><stop offset="1" stop-color="#5e3c1a"/></radialGradient>
    <pattern id="cane" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 4H8M4 0V8" stroke="#5a3a18" stroke-width="1.5" opacity=".55"/><circle cx="4" cy="4" r="1.3" fill="#3a2410" opacity=".6"/></pattern>
    <linearGradient id="chW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#84522a"/><stop offset=".5" stop-color="#4a2a10"/><stop offset="1" stop-color="#2a1606"/></linearGradient>
  </defs>
  <path d="M38 104 C30 52 62 18 100 18 C138 18 170 52 162 104" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="15" stroke-linecap="round" transform="translate(4 6)"/>
  <path d="M38 104 C30 52 62 18 100 18 C138 18 170 52 162 104" fill="none" stroke="url(#chW)" stroke-width="12" stroke-linecap="round"/>
  <path d="M38 104 C30 52 62 18 100 18 C138 18 170 52 162 104" fill="none" stroke="rgba(255,220,170,.3)" stroke-width="2" stroke-linecap="round" transform="translate(-2 -3)"/>
  <path d="M58 100 C54 66 76 40 100 40 C124 40 146 66 142 100" fill="none" stroke="url(#chW)" stroke-width="8" stroke-linecap="round"/>
  <circle cx="100" cy="122" r="66" fill="#2a1606"/>
  <circle cx="100" cy="122" r="62" fill="none" stroke="url(#chW)" stroke-width="9"/>
  <circle cx="100" cy="122" r="56" fill="url(#chS)"/>
  <circle cx="100" cy="122" r="56" fill="url(#cane)"/>
  <circle cx="100" cy="122" r="62" fill="none" stroke="rgba(255,220,170,.22)" stroke-width="1.5"/>
  <ellipse cx="82" cy="100" rx="30" ry="13" fill="rgba(255,240,210,.12)"/>
</svg>`;

  const TEA = `<svg viewBox="0 0 100 120" overflow="visible" aria-hidden="true"><defs>
    <radialGradient id="tSa" cx="45%" cy="40%"><stop offset="0" stop-color="#fffdf6"/><stop offset=".7" stop-color="#e6ddcb"/><stop offset="1" stop-color="#a99e88"/></radialGradient>
    <linearGradient id="tTe" x1="0" x2="1"><stop offset="0" stop-color="#3a0e02"/><stop offset=".35" stop-color="#b0421a"/><stop offset=".6" stop-color="#d9662a"/><stop offset="1" stop-color="#4a1404"/></linearGradient>
    <linearGradient id="tGl" x1="0" x2="1"><stop offset="0" stop-color="rgba(255,255,255,.5)"/><stop offset=".2" stop-color="rgba(255,255,255,.08)"/><stop offset=".75" stop-color="rgba(255,255,255,.04)"/><stop offset=".9" stop-color="rgba(255,255,255,.4)"/><stop offset="1" stop-color="rgba(255,255,255,.1)"/></linearGradient>
    <filter id="tBl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <filter id="tSt" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
  </defs>
  <ellipse cx="54" cy="100" rx="44" ry="15" fill="rgba(0,0,0,.5)" filter="url(#tBl)"/>
  <ellipse cx="50" cy="92" rx="42" ry="14" fill="url(#tSa)"/>
  <ellipse cx="50" cy="92" rx="40.5" ry="13" fill="none" stroke="#a3261c" stroke-width="2"/>
  <ellipse cx="50" cy="91" rx="27" ry="8" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>
  <path d="M70 96 L93 85" stroke="#d4d4d4" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="68" cy="97" rx="5.5" ry="2.6" fill="#e0e0e0" transform="rotate(-24 68 97)"/>
  <rect x="18" y="85" width="9" height="7" rx="1" fill="#fbf8f0" stroke="#d8d0c0" stroke-width=".6"/>
  <ellipse cx="50" cy="90" rx="16" ry="5" fill="rgba(0,0,0,.3)"/>
  <path d="M30 38 C29 50 37 58 41 64 C44 69 38 78 36 88 C42 92 58 92 64 88 C62 78 56 69 59 64 C63 58 71 50 70 38Z" fill="url(#tTe)" opacity=".93"/>
  <ellipse cx="50" cy="40" rx="19.5" ry="5.5" fill="#bf5226"/><ellipse cx="46" cy="39.4" rx="11" ry="2.6" fill="#ec9050" opacity=".55"/>
  <path d="M29 32 C28 48 37 58 41 64 C44 69 38 78 35 88 C42 93 58 93 65 88 C62 78 56 69 59 64 C63 58 72 48 71 32" fill="url(#tGl)" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
  <ellipse cx="50" cy="32" rx="21" ry="6" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.75)" stroke-width="1.2"/>
  <ellipse cx="50" cy="33.6" rx="20.6" ry="5.8" fill="none" stroke="#e0b44a" stroke-width="1" opacity=".8"/>
  <path d="M34 40 C34 50 40 57 43 62 M40 72 C39 78 38 82 38 86" stroke="rgba(255,255,255,.6)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <g class="steam" filter="url(#tSt)"><path d="M44 28 C38 18 50 12 44 0"/><path d="M54 28 C60 18 48 10 56 -4"/><path d="M49 26 C45 16 55 8 49 -6"/></g>
</svg>`;

  function tespih() {
    let beads = '';
    for (let i = 0; i < 33; i++) {
      const t = (i / 33) * Math.PI * 2;
      const x = 50 + Math.cos(t) * 34 + Math.sin(t * 2) * 3;
      const y = 40 + Math.sin(t) * 22;
      beads += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="url(#bd)"/>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
      <radialGradient id="bd" cx="35%" cy="30%"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".45" stop-color="#d9861a"/><stop offset="1" stop-color="#5a2604"/></radialGradient>
      <filter id="bdS" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
      <ellipse cx="52" cy="46" rx="38" ry="25" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="7" filter="url(#bdS)"/>
      ${beads}
      <ellipse cx="50" cy="66" rx="3.8" ry="7" fill="url(#bd)"/><path d="M50 73 L46 92 M50 73 L50 94 M50 73 L54 92 M50 73 L48 93 M50 73 L52 93" stroke="#7a1a12" stroke-width="1.3"/>
      <rect x="47" y="72" width="6" height="4" rx="1" fill="#c9a24a"/></svg>`;
  }

  function dressTable() {
    document.querySelectorAll('.chair').forEach((c) => { if (!c.firstChild) c.innerHTML = CHAIR; });
    const tea = document.querySelector('.prop.tea');
    if (tea && !tea.firstChild) tea.innerHTML = TEA;
    const tp = document.querySelector('.prop.tespih');
    if (tp && !tp.firstChild) tp.innerHTML = tespih();
  }

  // ================= KURULUM =================
  function init() {
    const root = document.createElement('div');
    root.id = 'scene';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `<div class="sc-static"></div>${liveSVG()}<div class="sc-haze"><i></i><i></i><i></i></div><canvas class="sc-dust"></canvas>`;
    root.querySelector('.sc-static').style.backgroundImage = url(staticSVG());
    document.body.prepend(root);
    tick();
    setInterval(tick, 1000);
    if (reduce) root.querySelector('svg.sc-live').pauseAnimations();
    else dust(root.querySelector('.sc-dust'));
    film();
    dressTable();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { portrait };
})();
