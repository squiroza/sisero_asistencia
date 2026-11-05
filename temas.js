/* SISERO · Temas de temporada (compartido entre el checador y el panel de administrador).
   El administrador elige el tema en el panel → "Temas". Se guarda en la base de datos y cada celular
   lo toma al abrir la app (y cada 10 minutos). Para agregar un tema nuevo, copia uno de la lista TEMAS. */
(function () {
  'use strict';
  var KEY = 'sisero_tema_id', root = document.documentElement;

  var TEMAS = [
    { id: 'normal', nombre: 'Normal', emoji: '🛡️', desc: 'Sin decoración: colores de SISERO.', band: 'linear-gradient(135deg,#0b2c55,#2f6aa3)' },
    { id: 'muertos', nombre: 'Día de Muertos', emoji: '💀', desc: '1 y 2 de noviembre · cempasúchil, papel picado y calaveras.',
      c: { navy: '#3b1a5a', navy2: '#5b2a86', ink: '#24103a', blue: '#b83280', blueBg: '#fde7f3', bg: '#fff3df', surface: '#fffcf6', line: '#efd9b4', line2: '#f5e6cc', field: '#e0c595' },
      band: 'linear-gradient(135deg,#3b1a5a,#6d2a8f 62%,#e8730c)', bandera: ['#f97316', '#c026d3', '#7c3aed', '#0d9488', '#facc15'],
      caen: ['🌼', '🌼', '🌼', '💀', '🦋', '🕯️'], sonido: true,
      frases: ['¡BUUUU!', '¡Ya llegó la Catrina! 💃', '¡Te toca checar, calaca!', 'Pan de muerto para quien checa a tiempo 🍞', '¡Ánimas del turno, presentes!'] },
    { id: 'halloween', nombre: 'Halloween', emoji: '🎃', desc: '31 de octubre · naranja, morado y mucho susto.',
      c: { navy: '#1f1233', navy2: '#3a2159', ink: '#140a22', blue: '#e8730c', blueBg: '#ffe9d3', bg: '#f6efe6', surface: '#fffaf4', line: '#e6d6c2', line2: '#efe3d2', field: '#d9c4a6' },
      band: 'linear-gradient(135deg,#1f1233,#4a1f7a 60%,#ea580c)', bandera: ['#f97316', '#111827', '#7c3aed', '#f97316', '#111827'],
      caen: ['🎃', '🦇', '👻', '🕸️', '🎃'], sonido: true,
      frases: ['¡BUUUU!', '¡Dulce o truco, guardia! 🍬', '¡Un fantasma quiere checar! 👻', '¡Cuidado con el turno de noche! 🦇'] },
    { id: 'navidad', nombre: 'Navidad', emoji: '🎄', desc: 'Diciembre · rojo, verde y nieve cayendo.',
      c: { navy: '#7f1d1d', navy2: '#991b1b', ink: '#3b0d0d', blue: '#15803d', blueBg: '#e4f5ea', bg: '#fbf6f4', surface: '#fffdfc', line: '#ecd9d4', line2: '#f3e6e2', field: '#e0c7c0' },
      band: 'linear-gradient(135deg,#7f1d1d,#b91c1c 55%,#166534)', bandera: ['#dc2626', '#ffffff', '#16a34a', '#dc2626', '#facc15'],
      caen: ['❄️', '❄️', '❄️', '🎄', '⭐', '🎁'],
      frases: ['¡Feliz Navidad! 🎄', '¡Felices fiestas, equipo! 🎁', '¡Que la paz llegue a cada servicio! ⭐', '¡Ho, ho, ho! 🎅'] },
    { id: 'independencia', nombre: 'Independencia', emoji: '🎆', desc: '16 de septiembre · verde, blanco y rojo.',
      c: { navy: '#14532d', navy2: '#1f7a45', ink: '#0f2f1d', blue: '#b91c1c', blueBg: '#fde8e8', bg: '#f6f8f4', surface: '#ffffff', line: '#d9e3d5', line2: '#e6eee3', field: '#c6d3c0' },
      band: 'linear-gradient(135deg,#14532d,#1f7a45 55%,#b91c1c)', bandera: ['#15803d', '#ffffff', '#dc2626', '#15803d', '#ffffff', '#dc2626'],
      caen: ['🎆', '🔔', '🎺', '🌶️', '🎆'],
      frases: ['¡Viva México! 🎉', '¡Viva la Independencia! 🔔', '¡Que viva la patria! 🎆', '¡Viva Hidalgo! 🔔'] },
    { id: 'revolucion', nombre: 'Revolución', emoji: '🐎', desc: '20 de noviembre · tonos tierra y sombreros.',
      c: { navy: '#3f2a14', navy2: '#6b4423', ink: '#2a1b0c', blue: '#b45309', blueBg: '#fdf0dc', bg: '#f5ecdc', surface: '#fffaf0', line: '#e0cfae', line2: '#ebddc2', field: '#d3bf97' },
      band: 'linear-gradient(135deg,#3f2a14,#7c4a1e 60%,#b45309)', bandera: ['#7c2d12', '#d97706', '#15803d', '#7c2d12', '#facc15'],
      caen: ['🌵', '🐎', '🎺', '⭐'],
      frases: ['¡Viva la Revolución! 🐎', '¡Sufragio efectivo, no reelección!', '¡A checar, compañeros! 🌵', '¡Viva Zapata! 🐎'] },
    { id: 'puebla', nombre: 'Batalla de Puebla', emoji: '🎺', desc: '5 de mayo · azul militar, rojo y dorado.',
      c: { navy: '#1e3a5f', navy2: '#2b5287', ink: '#122338', blue: '#b91c1c', blueBg: '#fde8e8', bg: '#f3f5f9', surface: '#ffffff', line: '#d5dce8', line2: '#e3e8f1', field: '#c2ccdd' },
      band: 'linear-gradient(135deg,#1e3a5f,#2b5287 55%,#b91c1c)', bandera: ['#15803d', '#ffffff', '#dc2626', '#facc15', '#1e3a5f'],
      caen: ['🎺', '⭐', '🥁', '🌿'],
      frases: ['¡Viva el 5 de mayo! 🎺', '¡Viva Puebla! ⭐', '¡Los Fuertes no se rinden! 🥁', '¡Viva Zaragoza! 🎺'] }
  ];

  var leerId = function () { try { return localStorage.getItem(KEY) || 'normal'; } catch (e) { return 'normal'; } };
  var buscar = function (id) { for (var i = 0; i < TEMAS.length; i++) if (TEMAS[i].id === id) return TEMAS[i]; return TEMAS[0]; };

  var base = [
    '#tm-fab{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:9500;width:44px;height:44px;border-radius:50%;border:2px solid #f59e0b;background:var(--navy,#0b2c55);color:#fff;font-size:22px;line-height:1;display:none;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer;padding:0;opacity:.92}',
    'html.tema-on #tm-fab{display:grid}',
    '#tm-papel{display:none}',
    'html.tema-on #tm-papel{display:block;position:fixed;top:0;left:0;right:0;height:14px;z-index:9400;pointer-events:none;background-repeat:repeat-x;background-position:left top;background-size:auto 14px}',
    '#tm-caen{display:none}',
    'html.tema-on #tm-caen{display:block;position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:9300}',
    '#tm-caen span{position:absolute;top:-40px;opacity:.55;animation:tm-caer linear infinite;will-change:transform}',
    '@keyframes tm-caer{to{transform:translate3d(var(--dx,0),112vh,0) rotate(360deg)}}',
    '#tm-sorpresa{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;background:radial-gradient(circle,rgba(20,20,40,.93),rgba(5,5,15,.97));animation:tm-in .2s ease-out;cursor:pointer;padding:20px;text-align:center}',
    '#tm-sorpresa.tm-fuera{opacity:0;transition:opacity .4s}',
    '#tm-sorpresa .tm-g{font-size:42vmin;line-height:1;animation:tm-pop .45s cubic-bezier(.2,1.6,.4,1);filter:drop-shadow(0 0 28px #f59e0b)}',
    '#tm-sorpresa .tm-f{color:#fff;font-weight:800;font-size:clamp(22px,6vw,44px);text-shadow:0 2px 12px #000}',
    '@keyframes tm-in{from{opacity:0}to{opacity:1}}',
    '@keyframes tm-pop{from{transform:scale(.1) rotate(-25deg)}to{transform:scale(1) rotate(0)}}',
    '@media (prefers-reduced-motion:reduce){#tm-caen{display:none!important}#tm-sorpresa .tm-g{animation:none}}'
  ].join('\n');
  var stBase = document.createElement('style'); stBase.id = 'tm-base'; stBase.textContent = base; (document.head || root).appendChild(stBase);
  var stTema = document.createElement('style'); stTema.id = 'tm-css'; (document.head || root).appendChild(stTema);

  var meta = null, metaOriginal = null;
  function cssDe(t) {
    if (!t.c) return '';
    var c = t.c;
    return 'html.tema-on{--navy:' + c.navy + ';--navy-2:' + c.navy2 + ';--navy-ink:' + c.ink + ';--blue:' + c.blue + ';--blue-bg:' + c.blueBg + ';--bg:' + c.bg + ';--surface:' + c.surface + ';--line:' + c.line + ';--line-2:' + c.line2 + ';--field:' + c.field + '}\n' +
      'html.tema-on .band{background:' + t.band + '}\n' +
      'html.tema-on .head h1::after{content:" ' + t.emoji + '"}\n' +
      'html.tema-on body{background-image:radial-gradient(circle at 12% 0,rgba(255,255,255,.35),transparent 42%);background-attachment:fixed}';
  }
  function banderines(cols) {
    var n = cols.length, w = 24 * n;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="14" viewBox="0 0 ' + w + ' 14"><rect width="' + w + '" height="2" fill="#3b3b3b"/>' +
      cols.map(function (c, i) { var x = i * 24; return '<path d="M' + x + ' 2h24v10l-4-3-4 3-4-3-4 3-4-3-4 3z" fill="' + c + '" stroke="#00000022" stroke-width=".6"/>'; }).join('') + '</svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  var papel, caen, fab;
  function montar() {
    if (fab || !document.body) return;
    papel = document.createElement('div'); papel.id = 'tm-papel'; papel.setAttribute('aria-hidden', 'true');
    caen = document.createElement('div'); caen.id = 'tm-caen'; caen.setAttribute('aria-hidden', 'true');
    fab = document.createElement('button'); fab.id = 'tm-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Sorpresa de temporada');
    fab.onclick = function () { sorpresa(buscar(leerId())); };
    document.body.appendChild(papel); document.body.appendChild(caen); document.body.appendChild(fab);
    decorar(buscar(leerId()));
  }
  function decorar(t) {
    if (!fab) return;
    fab.textContent = t.emoji;
    if (t.bandera) papel.style.backgroundImage = banderines(t.bandera);
    caen.innerHTML = '';
    var sim = t.caen || [];
    for (var i = 0; sim.length && i < 14; i++) {
      var s = document.createElement('span'); s.textContent = sim[i % sim.length];
      s.style.left = ((i * 7.3 + Math.random() * 6) % 98) + 'vw';
      s.style.fontSize = (14 + Math.random() * 12) + 'px';
      s.style.animationDuration = (10 + Math.random() * 9) + 's';
      s.style.animationDelay = (-Math.random() * 18) + 's';
      s.style.setProperty('--dx', ((Math.random() * 16) - 8) + 'vw');
      caen.appendChild(s);
    }
  }
  function sonido() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      var c = new Ctx(), o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(330, c.currentTime); o.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.7);
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.85);
      setTimeout(function () { try { c.close(); } catch (e) {} }, 1200);
    } catch (e) {}
  }
  function sorpresa(t) {
    if (document.getElementById('tm-sorpresa') || !t.frases) return;
    var o = document.createElement('div'); o.id = 'tm-sorpresa';
    o.innerHTML = '<div class="tm-g"></div><div class="tm-f"></div>';
    o.querySelector('.tm-g').textContent = t.emoji;
    o.querySelector('.tm-f').textContent = t.frases[Math.floor(Math.random() * t.frases.length)];
    var quitar = function () { if (!o.parentNode) return; o.classList.add('tm-fuera'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 420); };
    o.onclick = quitar; document.body.appendChild(o);
    if (t.sonido) { try { if (navigator.vibrate) navigator.vibrate([180, 80, 260]); } catch (e) {} sonido(); }
    setTimeout(quitar, 2600);
  }

  function aplicar(id, opc) {
    var t = buscar(id);
    if (!opc || opc.guardar !== false) { try { localStorage.setItem(KEY, t.id); } catch (e) {} }
    stTema.textContent = cssDe(t);
    root.classList.toggle('tema-on', !!t.c);
    if (!meta) { meta = document.querySelector('meta[name="theme-color"]'); if (meta) metaOriginal = meta.getAttribute('content'); }
    if (meta) meta.setAttribute('content', t.c ? t.c.navy : (metaOriginal || '#0b2c55'));
    decorar(t);
  }

  var enlazado = false;
  function sincronizar(sb) {
    var ir = function () {
      try {
        Promise.resolve(sb.rpc('tema_actual')).then(function (r) {
          if (r && !r.error) aplicar(typeof r.data === 'string' && r.data ? r.data : 'normal');
        }).catch(function () {});
      } catch (e) {}
    };
    ir();
    if (enlazado) return; enlazado = true;
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ir(); });
    setInterval(ir, 10 * 60 * 1000);
  }

  window.SISERO_TEMA = { lista: TEMAS, actual: leerId, aplicar: aplicar, sincronizar: sincronizar };
  aplicar(leerId(), { guardar: false });          // aplica el último tema conocido de inmediato (sin parpadeo)
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
