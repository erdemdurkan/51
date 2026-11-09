'use strict';
// 3B çalışmayan cihazlar için 2B karakter portreleri (arka plan ve 3B sahne: stage3d.js).
const Scene = (() => {
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

  return { portrait };
})();
