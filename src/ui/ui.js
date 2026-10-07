import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { profile, stops } from '../content.js';
import { renderStopBody, esc, md, icons } from './templates.js';
import { lineBlocked } from '../game/collision.js';

// DOM side of the experience: intro, HUD, content panel, labels, overlays, classic view.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Darken a stop colour for text on light backgrounds.
function inkFor(hex, theme) {
  if (theme !== 'day') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  const L = Math.min(l, 0.36);
  const S2 = Math.max(s, 0.55);
  const q = L < 0.5 ? L * (1 + S2) : L + S2 - L * S2;
  const p = 2 * L - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(h + 1 / 3))}${to(f(h))}${to(f(h - 1 / 3))}`;
}

export function createUI({ isTouch }) {
  const html = document.documentElement;
  const handlers = {};
  const emit = (name, ...a) => handlers[name]?.forEach((f) => f(...a));
  const on = (name, f) => (handlers[name] ||= []).push(f);
  if (isTouch) html.classList.add('has-touch');

  // ------------------------------------------------------------ intro
  const intro = $('#intro');
  let introTimer = 0;
  const bar = $('.intro-loading .bar i');
  const loadTxt = $('.intro-loading .txt');
  const btnTour = $('#btnTour');
  btnTour.addEventListener('click', () => emit('start'));

  // ------------------------------------------------------------ theme controls
  $$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => emit('theme', b.dataset.themeSet)));
  $$('.js-theme').forEach((b) => b.addEventListener('click', () => emit('theme', html.dataset.theme === 'day' ? 'night' : 'day')));
  function syncTheme(theme) {
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeSet === theme)));
    $$('.js-theme-label').forEach((el) => (el.textContent = theme === 'day' ? 'Day' : 'Night'));
    $$('.js-theme').forEach((b) => b.setAttribute('aria-label', theme === 'day' ? 'Switch to Gotham by night' : 'Switch to Chicago by day'));
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#dbe6ef' : '#05070b');
    if (currentStop) applyStopColor(currentStop);
  }

  // ------------------------------------------------------------ classic view
  const classic = $('#classic');
  const app = $('#app');
  const openClassic = () => {
    html.classList.add('classic-open');
    app.inert = true;
    if (!location.hash.startsWith('#sec-')) history.replaceState(null, '', '#classic');
    classic.focus({ preventScroll: true });
    emit('classic', true);
  };
  const closeClassic = () => {
    html.classList.remove('classic-open');
    app.inert = false;
    history.replaceState(null, '', location.pathname + location.search);
    emit('classic', false);
  };
  // opened from the URL (#classic or a #sec-… section link) before this script ran
  if (html.classList.contains('classic-open')) {
    app.inert = true;
    const target = location.hash.startsWith('#sec-') && document.getElementById(location.hash.slice(1));
    requestAnimationFrame(() => (target ? target.scrollIntoView() : classic.focus({ preventScroll: true })));
  }
  $$('.js-open-classic').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      openClassic();
    }),
  );
  $$('.js-enter-3d').forEach((b) =>
    b.addEventListener('click', () => {
      closeClassic();
      emit('enter3d');
    }),
  );
  // Home = the intro screen. Reachable from the 3D badge, H, and the classic view header.
  $$('.js-home').forEach((b) =>
    b.addEventListener('click', () => {
      if (html.classList.contains('no-webgl')) return classic.scrollTo({ top: 0, behavior: 'smooth' });
      if (html.classList.contains('classic-open')) closeClassic();
      emit('home');
    }),
  );

  // ------------------------------------------------------------ HUD
  const hud = $('#hud');
  const spd = $('.speedo .spd');
  const arc = $('.speedo-arc .fill');
  const boostBar = $('.speedo .boost i');
  const prompt = $('#prompt');
  const ap = $('#autopilot');
  const tourbar = $('#tourbar');
  const toastEl = $('#toast');
  $('#btnTourHud').addEventListener('click', () => emit('tour'));
  $('#btnMap').addEventListener('click', () => emit('map'));
  $('#minimapBtn').addEventListener('click', () => emit('map'));
  $('#btnHelp').addEventListener('click', () => emit('help'));
  // Sound toggles (intro + HUD) share one state; sound always starts off.
  let soundOn = false;
  $$('.js-sound').forEach((b) => b.addEventListener('click', () => emit('sound', !soundOn)));
  prompt.addEventListener('click', () => emit('interact'));
  ap.querySelector('.ap-skip').addEventListener('click', () => emit('skip'));
  ap.querySelector('.ap-stop').addEventListener('click', () => emit('takeWheel'));
  ap.querySelector('.ap-go').addEventListener('click', (e) => emit('travel', e.currentTarget.dataset.stop));
  tourbar.querySelector('.tb-exit').addEventListener('click', () => emit('exitTour'));
  tourbar.querySelector('.tb-prev').addEventListener('click', () => emit('tourStep', -1));
  tourbar.querySelector('.tb-next').addEventListener('click', () => emit('tourStep', 1));
  const tbSteps = tourbar.querySelector('.tb-steps');
  tbSteps.innerHTML = stops
    .map((s, k) => `<li><button type="button" data-i="${k}" data-name="${esc(s.label)}" aria-label="Go to stop ${k + 1}: ${esc(s.label)}"><i></i></button></li>`)
    .join('');
  tbSteps.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) emit('tourGo', Number(b.dataset.i));
  });
  if (isTouch) prompt.querySelector('kbd').textContent = 'TAP';

  let toastTimer = 0;
  function toast(msg, ms = 3800) {
    toastEl.innerHTML = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------ panel
  const panel = $('#panel');
  const pKicker = $('#panelKicker');
  const pTitle = $('#panelTitle');
  const pLede = $('#panelLede');
  const pBody = $('#panelBody');
  const pPhoto = $('.panel-photo', panel);
  const pPrev = $('.panel-prev', panel);
  const pNext = $('.panel-next', panel);
  const pCount = $('.panel-count', panel);
  $('.panel-close', panel).addEventListener('click', () => emit('closePanel'));
  pPrev.addEventListener('click', () => emit('panelNav', -1));
  pNext.addEventListener('click', () => emit('panelNav', 1));
  let currentStop = null;
  let panelOpen = false;

  function applyStopColor(stop) {
    const theme = html.dataset.theme;
    for (const el of [panel, ap, prompt]) {
      el.style.setProperty('--stop', stop.color);
      el.style.setProperty('--stop-ink', inkFor(stop.color, theme));
    }
  }

  function openPanel(stop, { index, total, prevLabel, nextLabel }) {
    currentStop = stop;
    applyStopColor(stop);
    pKicker.textContent = stop.kicker;
    pTitle.textContent = stop.title;
    pLede.innerHTML = stop.lede ? md(stop.lede) : '';
    pBody.innerHTML = renderStopBody(stop);
    pBody.scrollTop = 0;
    if (stop.id === 'hq') {
      pPhoto.hidden = false;
      const img = pPhoto.querySelector('img');
      img.src = profile.avatar;
      img.alt = `Portrait of ${profile.name}`;
    } else pPhoto.hidden = true;
    pPrev.querySelector('span').textContent = prevLabel;
    pPrev.setAttribute('aria-label', `Back to ${prevLabel}`);
    pNext.querySelector('span').textContent = nextLabel;
    pCount.textContent = `${index + 1} / ${total}`;
    panel.hidden = false;
    panel.inert = false;
    document.documentElement.classList.add('panel-open');
    requestAnimationFrame(() => {
      panel.classList.add('open');
      pTitle.focus({ preventScroll: true });
    });
    panelOpen = true;
  }

  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    panel.classList.remove('open');
    panel.inert = true; // no clicks while it slides away
    document.documentElement.classList.remove('panel-open');
    setTimeout(() => {
      if (!panelOpen) panel.hidden = true;
    }, 560);
    if (panel.contains(document.activeElement)) document.activeElement.blur();
  }

  // ------------------------------------------------------------ overlays
  const overlays = { map: $('#mapov'), help: $('#help') };
  const behindOverlay = ['#hud', '#labels', '#panel', '#intro'].map((s) => $(s));
  let lastFocus = null;
  function openOverlay(name) {
    for (const [k, el] of Object.entries(overlays)) if (k !== name) el.hidden = true;
    const el = overlays[name];
    // return focus on close only for keyboard users; mouse users get focus back on the page so Space = drift
    if (!overlayOpen()) lastFocus = document.activeElement?.matches?.(':focus-visible') ? document.activeElement : null;
    el.hidden = false;
    for (const b of behindOverlay) b.inert = true;
    $('.ov-close', el).focus({ preventScroll: true });
  }
  function closeOverlay() {
    let closed = false;
    for (const el of Object.values(overlays))
      if (!el.hidden) {
        el.hidden = true;
        closed = true;
      }
    if (closed) {
      for (const b of behindOverlay) b.inert = b === panel ? !panelOpen : false;
      lastFocus?.focus?.({ preventScroll: true });
    }
    return closed;
  }
  const overlayOpen = (name) => (name ? !overlays[name].hidden : Object.values(overlays).some((el) => !el.hidden));
  for (const el of Object.values(overlays)) {
    $('.ov-close', el).addEventListener('click', closeOverlay);
    el.addEventListener('click', (e) => {
      if (e.target === el) closeOverlay();
    });
  }

  // stop list in the map overlay
  const list = $('#stoplist');
  list.innerHTML = stops
    .map(
      (s, i) => `<li><button type="button" data-stop="${s.id}" style="--c:${s.color}">
        <span class="n">${i + 1}</span>
        <span><b>${esc(s.label)}</b><small>${esc(s.kicker)}</small></span>
        <span class="go">${icons.arrow}</span>
      </button></li>`,
    )
    .join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-stop]');
    if (b) {
      closeOverlay();
      emit('travel', b.dataset.stop);
    }
  });

  // ------------------------------------------------------------ 3D labels
  const labelEls = {};
  function addLabel(lm, onClick) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'lm-label';
    el.style.setProperty('--c', lm.stop.color);
    el.innerHTML = `<span class="dot"></span><span class="name">${esc(lm.stop.label)}</span><span class="dist"></span>`;
    el.setAttribute('aria-label', `Drive to ${lm.stop.label}`);
    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const obj = new CSS2DObject(el);
    lm.anchor.add(obj);
    labelEls[lm.id] = { el, obj, dist: el.querySelector('.dist') };
  }
  function updateLabels(landmarks, camPos, hideId) {
    for (const lm of landmarks) {
      const L = labelEls[lm.id];
      if (!L) continue;
      const d = Math.hypot(camPos.x - lm.pad.x, camPos.z - lm.pad.z);
      const show = d > 34 && !hideId;
      L.obj.visible = show;
      if (!show) continue;
      const hidden = lineBlocked(camPos.x, camPos.y, camPos.z, lm.pad.x, lm.anchor.position.y, lm.pad.z);
      L.el.classList.toggle('occluded', hidden);
      L.el.classList.toggle('far', d > 430 || hidden);
      L.el.classList.toggle('visited', lm.visited);
      L.el.style.opacity = d > 650 ? '0.55' : '1';
      L.dist.textContent = d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`;
    }
  }
  // CSS2DRenderer rewrites each label's display every frame, so toggle the layer instead.
  function setLabelsVisible(v) {
    document.getElementById('labels').classList.toggle('off', !v);
  }

  // ------------------------------------------------------------ escape / keyboard focus helpers
  return {
    on,
    toast,
    syncTheme,
    openClassic,
    closeClassic,
    get classicOpen() {
      return html.classList.contains('classic-open');
    },
    progress(f, text) {
      bar.style.width = `${Math.round(f * 100)}%`;
      if (text) loadTxt.textContent = text;
    },
    ready() {
      btnTour.disabled = false;
      intro.classList.add('ready');
      loadTxt.textContent = 'Ready';
    },
    hideIntro() {
      clearTimeout(introTimer);
      intro.classList.add('out');
      introTimer = setTimeout(() => (intro.hidden = true), 900);
      hud.classList.remove('leaving');
      hud.hidden = false;
    },
    // Back home: fade the HUD out and the intro back in over the skyline.
    showIntro() {
      clearTimeout(introTimer);
      hud.classList.add('leaving');
      introTimer = setTimeout(() => {
        hud.hidden = true;
        hud.classList.remove('leaving');
      }, 450);
      intro.hidden = false;
      void intro.offsetWidth; // restart the fade-in transition
      intro.classList.remove('out');
      btnTour.focus({ preventScroll: true });
    },
    setTourLabel(text) {
      btnTour.querySelector('span').textContent = text;
    },
    get introVisible() {
      return !intro.hidden && !intro.classList.contains('out');
    },
    speedo(speed, boostTank) {
      const v = Math.abs(speed);
      spd.textContent = String(Math.round(v * 3.6));
      arc.style.strokeDashoffset = String(226 * (1 - Math.min(1, v / 70)));
      boostBar.style.setProperty('--b', `${Math.round(boostTank * 100)}%`);
    },
    showPrompt(stop) {
      if (!stop) {
        prompt.hidden = true;
        return;
      }
      applyStopColor(stop);
      prompt.querySelector('b').textContent = stop.label;
      prompt.hidden = false;
    },
    // Autopilot banner, or (manual) the "next stop" guide while you drive yourself on a tour.
    showAutopilot(stop, dist, { manual = false } = {}) {
      if (!stop) {
        ap.hidden = true;
        return;
      }
      applyStopColor(stop);
      ap.classList.toggle('manual', manual);
      ap.querySelector('.ap-prefix').textContent = manual ? 'Next stop: ' : 'Autopilot to ';
      ap.querySelector('.ap-go').dataset.stop = stop.id;
      ap.querySelector('.ap-text b').textContent = stop.label;
      ap.querySelector('.ap-dist').textContent = dist != null ? `${Math.round(dist)} m` : '';
      ap.hidden = false;
    },
    showTour(index, total) {
      if (index == null) {
        tourbar.hidden = true;
        return;
      }
      tourbar.hidden = false;
      tourbar.querySelector('.tb-count').textContent = `${index + 1} / ${total}`;
      tbSteps.querySelectorAll('button').forEach((b, k) => {
        b.className = k < index ? 'done' : k === index ? 'now' : '';
        if (k === index) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      tourbar.querySelector('.tb-prev').disabled = index <= 0;
      tourbar.querySelector('.tb-next').disabled = index >= total - 1;
    },
    setSound(on) {
      soundOn = on;
      $$('.js-sound').forEach((b) => {
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? 'Sound is on. Mute' : 'Sound is off. Turn sound on');
      });
      $$('.js-sound-label').forEach((el) => (el.textContent = on ? 'Sound on' : 'Sound off'));
    },
    openPanel,
    closePanel,
    get panelOpen() {
      return panelOpen;
    },
    openOverlay,
    closeOverlay,
    overlayOpen,
    addLabel,
    updateLabels,
    setLabelsVisible,
    stopList: list,
  };
}
