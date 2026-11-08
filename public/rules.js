'use strict';
// İskambil 51 - Kurallar penceresi (oyun güncellemelerinden bağımsız; okurken kapanmaz, kaymaz)
(() => {
  const c = (t) => `<span class="rc${/[♥♦]/.test(t) ? ' red' : ''}${t === '🃏' ? ' jk' : ''}">${t}</span>`;
  const cs = (s) => s.split(' ').map(c).join('');

  const SECTIONS = [
    ['Malzeme', `
      <ul>
        <li><b>2 deste</b> (mavi ve kırmızı arkalı) × 52 kağıt + <b>2 sahte okey</b> = <b>106 kağıt</b>.</li>
        <li>4 kişi oynanır. <b>Tekli</b>: herkes kendi için. <b>Eşli</b>: 2'ye 2, karşındaki eşin.</li>
        <li>Oyun başta seçilen el sayısı kadar sürer.</li>
        <li><b>Puan ceza puanıdır: en az puanı olan kazanır.</b></li>
      </ul>`],
    ['Gösterge ve okey', `
      <ul>
        <li>Dağıtıcının sağındaki oyuncu <b>15</b>, diğerleri <b>14</b> kağıt alır. Dağıtıcı her el bir sonrakine geçer.</li>
        <li>Desteden bir kağıt açılır: <b>gösterge</b>. <b>Okey</b>, göstergenin aynı renkten bir üstüdür.</li>
      </ul>
      <div class="rex">Gösterge ${c('♦3')} → okey ${c('♦4')} &nbsp;·&nbsp; Gösterge ${c('♠A')} → okey ${c('♠2')}</div>
      <ul>
        <li><b>Okey joker gibidir:</b> her per ve seride eksik kağıdın yerine geçer, her kağıtla çift olur.</li>
        <li><b>Sahte okey</b> ${c('🃏')} joker değildir; okeyin yerine geçen sıradan bir kağıttır (okey ${c('♦4')} ise sahte okey "${c('♦4')}" sayılır).</li>
      </ul>`],
    ['Sıra nasıl döner?', `
      <ol>
        <li>15 kağıdı olan oyuncu önce <b>bir kağıt atar</b>.</li>
        <li>Sonra herkes sırayla: <b>kağıt çeker</b> → <b>bir kağıt atar</b>.</li>
        <li>Çekmek için: <b>desteden</b>, ya da <b>yerden</b> (yalnızca senden önceki oyuncunun <b>son attığı</b> kağıt).</li>
        <li>Yerden aldığını, kağıt atmadan önce <b>↩ Geri bırak</b> ile geri koyup yeniden çekebilirsin.</li>
      </ol>
      <div class="rwarn">⚠️ Yerdeki okey alınamaz. · Bitmeden yere okey atan <b>+100 ceza</b> yer. · Deste biterse el <b>berabere</b>, puan yazılmaz.</div>`],
    ['Gruplar', `
      <div class="rgrid">
        <div><h4>Per</h4><p>Aynı sayı, farklı renk, 3 ya da 4 kağıt</p><div class="rex">${cs('♠7 ♥7 ♦7')}</div></div>
        <div><h4>Seri</h4><p>Aynı renk, sıralı, en az 3 kağıt</p><div class="rex">${cs('♥9 ♥10 ♥J')}</div></div>
        <div><h4>Çift</h4><p>Birebir aynı iki kağıt (iki desteden)</p><div class="rex">${cs('♣8 ♣8')}</div></div>
      </div>
      <div class="rex">Geçerli ${cs('♠Q ♠K ♠A')} &nbsp; · &nbsp; Geçersiz <s>${cs('♠A ♠2 ♠3')}</s> (As sadece en üstte durur)</div>`],
    ['Nasıl bitilir?', `
      <p>Elinde 15 kağıt varken birini atıp <b>Bitir</b>'e basarsın. Kalan <b>14 kağıt</b> şunlardan birine uymalı:</p>
      <table class="rtab">
        <tr><th>Normal bitiş</th><td>14 kağıdın hepsi per ve serilere girer</td></tr>
        <tr><th>Çiftten bitiş</th><td><b>7 çift</b></td></tr>
        <tr><th>Çiftten bitiş</th><td><b>5 çift + bir 4'lü grup</b> (4'lü seri ya da aynı sayıdan 4 renk)</td></tr>
      </table>
      <p>Bittiğin son kağıt <b>okey</b> olursa buna <b>okey atarak bitmek</b> denir ve çiftten bitiş gibi özel sayılır.</p>`],
    ['Kağıt değerleri ve renk çarpanı', `
      <table class="rtab center">
        <tr><th>A</th><th>10 · J · Q · K</th><th>2–9</th><th>Elde kalan okey</th></tr>
        <tr><td>11</td><td>10</td><td>üzerindeki sayı</td><td>0</td></tr>
      </table>
      <p>Bütün puanlar <b>okeyin rengine</b> göre çarpılır:</p>
      <table class="rtab center">
        <tr><th>${c('♣')} Sinek</th><th>${c('♠')} Maça</th><th>${c('♦')} Karo</th><th>${c('♥')} Kupa</th></tr>
        <tr><td>×2</td><td>×3</td><td>×4</td><td>×5</td></tr>
      </table>
      <div class="rnow"></div>`],
    ['Biri bitince puanlar', `
      <p><b>Biten:</b> normal bitişte <b>−100</b>; çiftten ya da okey atarak bittiyse <b>−100 × renk</b>.</p>
      <p><b>Diğerleri:</b></p>
      <table class="rtab">
        <tr><th>Okeye dönmüş el<br><small>(bitmeye hazırdı, bitmedi)</small></th><td><b>100 × renk</b></td></tr>
        <tr><th>En az 4 çift → çifte gider</th><td>çiftlere girmeyenlerin toplamı <b>× renk × 2</b><br><small>yalnızca en yüksek tek per düşülür</small></td></tr>
        <tr><th>En az 1 per veya seri</th><td>perlere girmeyenlerin toplamı <b>× renk</b></td></tr>
        <tr><th>Hiç per yok</th><td>sabit <b>100 × renk</b></td></tr>
      </table>
      <div class="rwarn">Biten çiftten ya da okey atarak bittiyse <b>herkesin cezası ayrıca ×2</b>. Eşli oyunda bitenin eşi ceza yazmaz.</div>
      <div class="rex block"><b>Örnek:</b> Okey kupa (×5). Perlere girmeyen ${cs('♠K ♦7')} kaldı → (10 + 7) × 5 = <b>85 ceza</b>.</div>
      <p><b>Elini açma:</b> biri bitince <b>30 saniyen</b> var. Ceza <b>senin dizilişine göre</b> yazılır; yalnızca <b>yan yana duran</b> geçerli gruplar sayılır.</p>`],
    ['Gösterge göstermek', `
      <ul>
        <li>Göstergenin eşi (ikinci destedeki aynı kağıt) sendeyse, <b>sıran gelince, kağıt çekmeden önce</b> gösterebilirsin: <b>−10 × renk</b> ödül.</li>
        <li>Gösterdiğin kağıt o elin sonuna kadar <b>çiftlerde joker</b> sayılır.</li>
        <li>Göstergen yokken basarsan <b>+50 ceza</b>. Düğme herkese açıktır, kimde olduğu belli olmasın diye.</li>
        <li>Her elde bir kez denenebilir.</li>
      </ul>`],
    ['Final ve kazanan', `
      <p><b>Tekli:</b> son el <b>final</b>dir.</p>
      <ul>
        <li>Finalden önce en az puanı olan iki kişi <b>1.</b> ve <b>2.</b> olur, finali oynamaz.</li>
        <li>En çok puanı olan iki kişi finali oynar. Final eli yazıldıktan sonra <b>toplamı düşük olan</b> kazanır; eli bitirmek tek başına yetmeyebilir.</li>
        <li>Eşitlikte finali eli bitiren, o da yoksa final elinde daha az yazan kazanır.</li>
      </ul>
      <p><b>Eşli:</b> iki eşin toplamı düşük olan takım kazanır.</p>`],
    ['Altın (online masa)', `
      <ul>
        <li>Herkes masa ücretini yatırır (en az 250 altın).</li>
        <li><b>1.</b> yerdeki paranın yarısını alır; <b>2.</b> ve <b>finali kazanan</b> yatırdığını geri alır.</li>
        <li>Kalan iki kişi yatırdığını kaybeder. Bilgisayara karşı oyun ücretsizdir.</li>
      </ul>`],
  ];

  const MULT = { C: 2, S: 3, D: 4, H: 5 };
  const SYMS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function build() {
    const w = document.createElement('div');
    w.id = 'rules';
    w.className = 'hidden';
    w.innerHTML = `<div class="rules-card" role="dialog" aria-modal="true" aria-labelledby="rulesTitle">
      <header><h2 id="rulesTitle">📜 Oyun kuralları</h2><button class="rules-x" aria-label="Kapat">✕</button></header>
      <nav class="rules-nav">${SECTIONS.map(([t], i) => `<button data-i="${i}">${t}</button>`).join('')}</nav>
      <div class="rules-body">${SECTIONS.map(([t, h], i) => `<section id="rs${i}"><h3>${t}</h3>${h}</section>`).join('')}</div>
    </div>`;
    document.body.appendChild(w);
    const body = w.querySelector('.rules-body');
    w.addEventListener('click', (e) => {
      if (e.target === w || e.target.closest('.rules-x')) close();
      const nb = e.target.closest('.rules-nav button');
      if (nb) body.scrollTo({ top: w.querySelector('#rs' + nb.dataset.i).offsetTop - body.offsetTop - 4, behavior: 'smooth' });
    });
    // okurken bulunduğun bölümü üstte işaretle
    body.addEventListener('scroll', () => {
      let cur = 0;
      w.querySelectorAll('.rules-body section').forEach((s, i) => { if (s.offsetTop - body.offsetTop - 30 <= body.scrollTop) cur = i; });
      w.querySelectorAll('.rules-nav button').forEach((b, i) => b.classList.toggle('on', i === cur));
    }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.classList.contains('hidden')) close(); });
    return w;
  }

  let el = null;
  function open() {
    el = el || build();
    // oyun sürüyorsa bu elin okeyini ve çarpanını göster
    let now = '';
    try {
      const g = typeof S !== 'undefined' && S && S.game;
      if (g && g.okey) now = `Bu elde okey <b>${SYMS[g.okey.s]}${RL[g.okey.r] || g.okey.r}</b> → çarpan <b>×${MULT[g.okey.s]}</b>`;
    } catch {}
    const rn = el.querySelector('.rnow');
    rn.innerHTML = now;
    rn.classList.toggle('hidden', !now);
    el.classList.remove('hidden');
    el.querySelector('.rules-body').scrollTop = 0;
    el.querySelectorAll('.rules-nav button').forEach((b, i) => b.classList.toggle('on', i === 0));
    if (window.FX) FX.play('click');
  }
  function close() { if (el) el.classList.add('hidden'); }

  document.addEventListener('click', (e) => { if (e.target.closest('.rules-btn')) open(); });
  window.Rules = { open, close };
})();
