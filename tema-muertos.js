/* SISERO · Tema de Día de Muertos (se comparte entre el checador y el panel de administrador).
   - Colores de cempasúchil, morado y magenta, con papel picado arriba y pétalos que caen.
   - Botón flotante 💀 abajo a la izquierda: "¡Susto!" y quitar / poner el tema.
   - Para quitarlo por completo: borra la línea <script src="../tema-muertos.js"> de los index.html. */
(function () {
  'use strict';
  var KEY = 'sisero_tema', root = document.documentElement;
  var leer = function () { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } };
  var guardar = function (on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} };

  // Papel picado (tira de banderitas) como imagen SVG
  var cols = ['#f97316', '#c026d3', '#7c3aed', '#0d9488', '#facc15'];
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="14" viewBox="0 0 120 14"><rect width="120" height="2" fill="#4a1d6b"/>' +
    cols.map(function (c, i) { var x = i * 24; return '<path d="M' + x + ' 2h24v10l-4-3-4 3-4-3-4 3-4-3-4 3z" fill="' + c + '"/><circle cx="' + (x + 12) + '" cy="6" r="2" fill="#fff" fill-opacity=".65"/>'; }).join('') + '</svg>';
  var PAPEL = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';

  var css = [
    /* ---- siempre disponibles: botón flotante y susto ---- */
    '#md-botones{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:9500;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-family:inherit}',
    '#md-fab{width:44px;height:44px;border-radius:50%;border:2px solid #f59e0b;background:#3b1a5a;color:#fff;font-size:22px;line-height:1;display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.3);cursor:pointer;padding:0;opacity:.92}',
    '#md-menu{display:flex;flex-direction:column;gap:6px}',
    '#md-menu button{border:2px solid #f59e0b;background:#3b1a5a;color:#fff;border-radius:999px;padding:9px 14px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.3);text-align:left}',
    '#md-susto{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh;background:radial-gradient(circle,rgba(70,20,100,.97),rgba(12,3,22,.98));animation:md-in .2s ease-out;cursor:pointer;padding:20px;text-align:center}',
    '#md-susto.md-fuera{opacity:0;transition:opacity .4s}',
    '#md-susto .md-cal{font-size:42vmin;line-height:1;animation:md-pop .45s cubic-bezier(.2,1.6,.4,1),md-tiembla .12s .45s 6 alternate;filter:drop-shadow(0 0 28px #f97316)}',
    '#md-susto .md-fra{color:#ffb02e;font-weight:800;font-size:clamp(22px,6vw,44px);text-shadow:0 2px 12px #000}',
    '@keyframes md-in{from{opacity:0}to{opacity:1}}',
    '@keyframes md-pop{from{transform:scale(.1) rotate(-25deg)}to{transform:scale(1) rotate(0)}}',
    '@keyframes md-tiembla{from{transform:translateX(-6px) rotate(-2deg)}to{transform:translateX(6px) rotate(2deg)}}',
    /* ---- solo con el tema puesto ---- */
    'html.muertos{--navy:#3b1a5a;--navy-2:#5b2a86;--navy-ink:#24103a;--blue:#b83280;--blue-bg:#fde7f3;--gray:#4b3a57;--gray-bg:#efe6f3;--bg:#fff3df;--surface:#fffcf6;--ink:#2a1636;--muted:#6b5575;--line:#efd9b4;--line-2:#f5e6cc;--field:#e0c595}',
    'html.muertos body{background-image:radial-gradient(circle at 12% 0,rgba(249,115,22,.12),transparent 42%),radial-gradient(circle at 92% 100%,rgba(192,38,211,.12),transparent 46%);background-attachment:fixed}',
    'html.muertos .band{background:linear-gradient(135deg,#3b1a5a,#6d2a8f 62%,#e8730c)}',
    'html.muertos ::selection{background:#f97316;color:#fff}',
    'html.muertos .head h1::after{content:" 🌼"}',
    '#md-papel{display:none}',
    'html.muertos #md-papel{display:block;position:fixed;top:0;left:0;right:0;height:14px;z-index:9400;pointer-events:none;background:' + PAPEL + ' repeat-x left top/120px 14px}',
    '#md-petalos{display:none}',
    'html.muertos #md-petalos{display:block;position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:9300}',
    '#md-petalos span{position:absolute;top:-40px;opacity:.55;animation:md-caer linear infinite;will-change:transform}',
    '@keyframes md-caer{to{transform:translate3d(var(--dx,0),112vh,0) rotate(360deg)}}',
    '@media (prefers-reduced-motion:reduce){#md-petalos{display:none!important}#md-susto .md-cal{animation:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'md-css'; st.textContent = css; document.head.appendChild(st);

  var meta = document.querySelector('meta[name="theme-color"]'), metaOriginal = meta ? meta.getAttribute('content') : null;
  function aplicar(on) {
    root.classList.toggle('muertos', on);
    if (meta) meta.setAttribute('content', on ? '#3b1a5a' : (metaOriginal || '#0b2c55'));
    var b = document.querySelector('#md-menu [data-a="tema"]');
    if (b) b.textContent = on ? '🌼 Quitar tema' : '💀 Poner tema Día de Muertos';
  }

  function montar() {
    if (document.getElementById('md-botones')) return;
    var papel = document.createElement('div'); papel.id = 'md-papel'; papel.setAttribute('aria-hidden', 'true');
    var pet = document.createElement('div'); pet.id = 'md-petalos'; pet.setAttribute('aria-hidden', 'true');
    var simb = ['🌼', '🌼', '🌼', '💀', '🌼', '🦋', '🕯️', '🌼'];
    for (var i = 0; i < 14; i++) {
      var s = document.createElement('span'); s.textContent = simb[i % simb.length];
      s.style.left = ((i * 7.3 + Math.random() * 6) % 98) + 'vw';
      s.style.fontSize = (14 + Math.random() * 12) + 'px';
      s.style.animationDuration = (10 + Math.random() * 9) + 's';
      s.style.animationDelay = (-Math.random() * 18) + 's';
      s.style.setProperty('--dx', ((Math.random() * 16) - 8) + 'vw');
      pet.appendChild(s);
    }
    var cont = document.createElement('div'); cont.id = 'md-botones';
    cont.innerHTML = '<div id="md-menu" hidden><button type="button" data-a="susto">👻 ¡Susto!</button><button type="button" data-a="tema"></button></div><button type="button" id="md-fab" aria-label="Tema de Día de Muertos">💀</button>';
    document.body.appendChild(papel); document.body.appendChild(pet); document.body.appendChild(cont);
    var menu = cont.querySelector('#md-menu');
    cont.querySelector('#md-fab').onclick = function () { menu.hidden = !menu.hidden; };
    menu.onclick = function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'susto') { menu.hidden = true; susto(); }
      if (a === 'tema') { var on = !root.classList.contains('muertos'); guardar(on); aplicar(on); menu.hidden = true; }
    };
    aplicar(leer());
  }

  var frases = ['¡BUUUU!', '¡Ya llegó la Catrina! 💃', '¡Te toca checar, calaca!', 'Pan de muerto para quien checa a tiempo 🍞', '¡Ánimas del turno, presentes!', '¡No te quedes dormido, que te jalan los pies! 👣'];
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
  function susto() {
    if (document.getElementById('md-susto')) return;
    var o = document.createElement('div'); o.id = 'md-susto';
    o.innerHTML = '<div class="md-cal">💀</div><div class="md-fra"></div>';
    o.querySelector('.md-fra').textContent = frases[Math.floor(Math.random() * frases.length)];
    var quitar = function () { if (!o.parentNode) return; o.classList.add('md-fuera'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 420); };
    o.onclick = quitar; document.body.appendChild(o);
    try { if (navigator.vibrate) navigator.vibrate([180, 80, 260]); } catch (e) {}
    sonido(); setTimeout(quitar, 2600);
  }

  // Aplica el tema desde el principio para que no parpadee, y monta los adornos cuando la página está lista
  root.classList.toggle('muertos', leer());
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
