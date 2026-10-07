import '@fontsource-variable/inter';
import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/jetbrains-mono/latin-500';
import '@fontsource/jetbrains-mono/latin-600';
import './styles/main.css';

import * as THREE from 'three';
import { profile, stops, stopById } from './content.js';
import { createUI } from './ui/ui.js';
import { Minimap } from './ui/minimap.js';
import { createEngine, detectQuality } from './engine.js';
import { blendPalette } from './core/theme.js';
import { Input } from './core/input.js';
import { EngineAudio } from './core/audio.js';
import { storage, isTouchDevice, prefersReducedMotion, clamp } from './core/util.js';
import { createKit } from './world/kit.js';
import { buildCity } from './world/city.js';
import { buildChicago } from './world/chicago.js';
import { buildLandmarks } from './world/landmarks.js';
import { createSky } from './world/sky.js';
import { createBatmobile } from './world/batmobile.js';
import { createTraffic } from './world/traffic.js';
import { createEffects } from './world/effects.js';
import { LANE } from './world/layout.js';
import { Vehicle } from './game/vehicle.js';
import { CameraRig } from './game/cameraRig.js';
import { Autopilot, planRoute, nearestEdge, closestOnRoute, graph } from './game/navigation.js';
import { createRouteArrows } from './world/routeArrows.js';

const html = document.documentElement;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function boot() {
  const isTouch = isTouchDevice();
  const reduced = prefersReducedMotion();
  const ui = createUI({ isTouch });

  // Theme state lives on <html data-theme>; set early by the inline script.
  let theme = html.dataset.theme === 'day' ? 'day' : 'night';
  ui.syncTheme(theme);

  if (!webglAvailable()) {
    html.classList.add('no-webgl');
    ui.on('theme', (t) => {
      theme = t;
      html.dataset.theme = t;
      storage.set('theme', t);
      ui.syncTheme(t);
    });
    return;
  }

  ui.progress(0.05, 'Loading type…');
  await Promise.race([document.fonts.ready, wait(2500)]);
  await Promise.race([Promise.all(['800 20px "Big Shoulders Display"', '900 20px "Big Shoulders Display"', '600 20px "JetBrains Mono"'].map((f) => document.fonts.load(f))), wait(2500)]).catch(() => {});

  // ------------------------------------------------------------------ engine + world
  const quality = new URLSearchParams(location.search).get('quality') || detectQuality();
  const engine = createEngine(document.getElementById('stage'), document.getElementById('labels'), quality);
  const { scene, camera, renderer, tier } = engine;
  camera.position.set(260, 140, 260);

  ui.progress(0.15, 'Raising the skyline…');
  await nextFrame();
  const kit = createKit(renderer);
  const city = buildCity(scene, kit, renderer);
  ui.progress(0.4, 'Laying the L tracks…');
  await nextFrame();
  const chicago = buildChicago(scene, kit, { renderer, addAviation: city.addAviation });
  ui.progress(0.55, 'Lighting the landmarks…');
  await nextFrame();
  const landmarks = await buildLandmarks(scene, kit, { profile, addAviation: city.addAviation });
  const meshes = kit.finalize(scene);
  ui.progress(0.7, 'Fuelling the car…');
  await nextFrame();

  const sky = createSky();
  scene.add(sky.mesh);
  scene.fog = new THREE.FogExp2('#0e141e', 0.003);

  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = tier.shadows > 0;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(tier.shadows, tier.shadows);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -95;
    sc.right = sc.top = 95;
    sc.near = 10;
    sc.far = 900;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.5;
    sun.shadow.radius = 3;
  }
  scene.add(sun, sun.target);

  const batmobile = createBatmobile();
  scene.add(batmobile.root);
  const traffic = createTraffic(scene, graph, tier.traffic);
  const arrows = createRouteArrows(scene);
  const guide = { id: null, route: null, idx: 0 }; // route to the next tour stop when driving yourself
  const effects = createEffects(scene, { tall: city.tall, rainCount: reduced ? 0 : tier.rain });

  // Environment reflections: a cube capture of the city, PMREM-filtered.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const envCam = new THREE.CubeCamera(1, 3000, envRT);
  envCam.position.set(0, 46, 37);
  scene.add(envCam);
  let envTex = null;
  function captureEnvironment() {
    batmobile.root.visible = false;
    sky.update(clock.t, envCam);
    envCam.update(renderer, scene);
    const next = pmrem.fromCubemap(envRT.texture).texture;
    envTex?.dispose();
    envTex = next;
    scene.environment = envTex;
    chicago.bean.visible = false;
    chicago.beanCam.update(renderer, scene);
    chicago.bean.visible = true;
    batmobile.root.visible = true;
  }

  // ------------------------------------------------------------------ game state
  const car = new Vehicle();
  const rig = new CameraRig(camera, { reducedMotion: reduced });
  const autopilot = new Autopilot();
  const input = new Input({ stage: document.getElementById('stage'), joy: document.getElementById('joy'), touchButtons: document.querySelectorAll('.tbtn') });
  const audio = new EngineAudio();
  const minimap = new Minimap(document.getElementById('minimap'), document.getElementById('bigmap'), landmarks.list);
  const clock = { t: 0, last: performance.now() };
  const state = {
    mode: 'intro', // intro | swoop | drive | panel
    current: null, // id of the open panel
    target: null, // autopilot destination id
    tour: null, // { index }
    near: null,
    dwell: 0,
    dismissed: null,
    hint: true,
  };

  const visited = new Set(storage.get('visited', []));
  for (const lm of landmarks.list) lm.visited = visited.has(lm.id);

  function placeAtStop(id) {
    const lm = landmarks.byId[id];
    const sx = lm.streetDir.x;
    const sz = lm.streetDir.y;
    const heading = Math.atan2(sx, sz);
    // right-hand lane relative to that heading
    car.place(lm.pad.x - Math.cos(heading) * LANE, lm.pad.z + Math.sin(heading) * LANE, heading);
  }
  placeAtStop('hq');
  const deep = location.hash.slice(1);
  let deepStop = stopById[deep] ? deep : null; // consumed by the first start

  // ------------------------------------------------------------------ theme
  const themeCtl = { n: theme === 'night' ? 1 : 0, target: theme === 'night' ? 1 : 0, settled: true };
  const palette = {};
  function applyTheme(n) {
    const p = blendPalette(n, palette);
    scene.fog.color.copy(p.fog);
    scene.fog.density = p.fogDensity;
    hemi.color.copy(p.hemiSky);
    hemi.groundColor.copy(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    sun.color.copy(p.lightColor);
    sun.intensity = p.lightIntensity;
    scene.environmentIntensity = p.envIntensity;
    sky.apply(p);
    engine.setLook(p);
    city.onTheme(p);
    chicago.onTheme(p);
    landmarks.onTheme(p);
    effects.onTheme(p);
    traffic.setNight(n);
    batmobile.setNight(n);
  }
  function setTheme(t) {
    if (t !== 'day' && t !== 'night') return;
    theme = t;
    html.dataset.theme = t;
    storage.set('theme', t);
    themeCtl.target = t === 'night' ? 1 : 0;
    themeCtl.settled = false;
    ui.syncTheme(t);
    minimap.setTheme(t);
    if (state.mode !== 'intro') ui.toast(t === 'night' ? '<b>Gotham by night.</b> Watch for the signal in the sky.' : '<b>Chicago by day.</b>', 2200);
  }
  applyTheme(themeCtl.n);
  minimap.setTheme(theme);

  // ------------------------------------------------------------------ labels
  for (const lm of landmarks.list) ui.addLabel(lm, () => travelTo(lm.id));
  ui.setLabelsVisible(false);

  // ------------------------------------------------------------------ warm up
  ui.progress(0.85, 'Compiling shaders…');
  await nextFrame();
  sky.update(0, camera);
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }
  captureEnvironment();
  ui.progress(1, 'Ready');
  ui.ready();
  if (deepStop) ui.setTourLabel(`Continue to ${stopById[deepStop].label}`);

  // ------------------------------------------------------------------ flow helpers
  const isDesktopPanel = () => window.innerWidth > 720;
  const panelShift = () => (isDesktopPanel() ? Math.min(540, window.innerWidth * 0.44) * 0.5 : 0);

  function markVisited(id) {
    const lm = landmarks.byId[id];
    if (lm.visited) return;
    lm.visited = true;
    visited.add(id);
    storage.set('visited', [...visited]);
    if (visited.size === stops.length) {
      setTimeout(() => {
        ui.toast('<b>You’ve seen every stop.</b> Thanks for the ride. Light the signal anytime: <a href="mailto:' + profile.email + '">' + profile.email + '</a>', 7000);
        landmarks.extras.batSignal?.flash();
      }, 900);
    }
  }

  function navLabels(id) {
    const i = stops.findIndex((s) => s.id === id);
    const prev = stops[(i - 1 + stops.length) % stops.length];
    const next = stops[(i + 1) % stops.length];
    let nextLabel = `Drive to ${next.label}`;
    if (state.tour && i === stops.length - 1) nextLabel = 'Finish the tour';
    return { index: i, total: stops.length, prevLabel: prev.label, nextLabel };
  }

  function openStop(id) {
    const lm = landmarks.byId[id];
    const stop = stopById[id];
    autopilot.stop();
    ui.showAutopilot(null);
    ui.showPrompt(null);
    state.mode = 'panel';
    state.current = id;
    state.target = null;
    state.dwell = 0;
    rig.showLandmark(lm);
    rig.viewShiftTarget = panelShift();
    ui.openPanel(stop, navLabels(id));
    markVisited(id);
    if (state.tour) {
      state.tour.index = stops.findIndex((s) => s.id === id);
      state.tour.arrived = state.tour.index; // guidance now points at the stop after this one
      ui.showTour(state.tour.index, stops.length);
    }
    history.replaceState(null, '', `#${id}`);
    audio.blip(id === 'signal' ? 520 : 760);
    if (id === 'signal') landmarks.extras.batSignal?.flash();
  }

  function closeStop({ silent = false } = {}) {
    if (state.mode !== 'panel') return;
    state.dismissed = state.current;
    state.current = null;
    state.mode = 'drive';
    rig.endShowcase();
    rig.viewShiftTarget = 0;
    ui.closePanel();
    if (!silent) history.replaceState(null, '', location.pathname + location.search);
  }

  function travelTo(id, { teleport = false } = {}) {
    if (state.mode === 'intro' || state.mode === 'swoop' || state.teleporting) return;
    ui.closeOverlay();
    const lm = landmarks.byId[id];
    const already = Math.hypot(car.x - lm.pad.x, car.z - lm.pad.z) < 9;
    if (state.mode === 'panel') closeStop({ silent: true });
    if (state.tour) {
      // keep the tour bar pointing at where we're headed
      state.tour.index = stops.findIndex((s) => s.id === id);
      ui.showTour(state.tour.index, stops.length);
    }
    if (already) return openStop(id);
    if (teleport || reduced) return teleportTo(id);
    const route = planRoute(car.x, car.z, car.heading, lm.pad.x, lm.pad.z);
    autopilot.start(route);
    state.target = id;
    state.dismissed = null;
    ui.showAutopilot(stopById[id], route.length);
  }

  async function teleportTo(id) {
    if (state.teleporting) return;
    state.teleporting = true;
    autopilot.stop();
    ui.showAutopilot(null);
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    await wait(360);
    placeAtStop(id);
    const goal = rig.chaseTarget(car);
    rig.pos.copy(goal.pos);
    rig.look.copy(goal.look);
    camera.position.copy(goal.pos);
    openStop(id);
    rig.pos.copy(landmarks.byId[id].framePos);
    rig.look.copy(landmarks.byId[id].frameTarget);
    await wait(80);
    fade.classList.remove('on');
    state.teleporting = false;
  }

  function cancelAutopilot(reason) {
    if (!autopilot.active) return;
    autopilot.stop();
    state.target = null;
    ui.showAutopilot(null);
    if (reason === 'manual') ui.toast(`You have the wheel. ${driveHint()}`, 4500);
  }

  function startTour() {
    if (state.mode === 'intro' || state.mode === 'swoop') return;
    state.tour = { index: 0 };
    ui.showTour(0, stops.length);
    travelTo(stops[0].id);
  }

  function endTour(msg) {
    state.tour = null;
    ui.showTour(null);
    if (msg) ui.toast(msg, 5000);
  }

  function resetCar() {
    const p = nearestEdge(car.x, car.z);
    const A = graph.nodes[p.e.a];
    const B = graph.nodes[p.e.b];
    let heading = Math.atan2(B.x - A.x, B.z - A.z);
    if (Math.cos(heading - car.heading) < 0) heading += Math.PI;
    car.place(p.x - Math.cos(heading) * LANE, p.z + Math.sin(heading) * LANE, heading);
  }

  const driveHint = () =>
    isTouch
      ? 'Drag on the left to drive · hold <b>BOOST</b> or <b>DRIFT</b> · tap a label to go there'
      : '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive · <kbd>Shift</kbd> boost · <kbd>Space</kbd> drift · follow the light beams';

  // Home screen → the city. Every visit starts as the guided tour; visitors can take the wheel anytime.
  function begin() {
    if (state.mode !== 'intro') return;
    state.mode = 'swoop';
    ui.hideIntro();
    minimap.resize(); // the HUD is visible now, so size the minimap to its real CSS size
    ui.setLabelsVisible(true);
    const target = deepStop;
    deepStop = null;
    ui.setTourLabel('Take the guided tour');
    // the tour starts at HQ, so bring the car home while the camera is still up over the skyline
    if (!target && Math.hypot(car.x - landmarks.byId.hq.pad.x, car.z - landmarks.byId.hq.pad.z) > 9) placeAtStop('hq');
    rig.swoopTo(car, 2.8, () => {
      state.mode = 'drive';
      input.enabled = true;
      state.tour = { index: target ? stops.findIndex((s) => s.id === target) : 0 };
      ui.showTour(state.tour.index, stops.length);
      if (target) travelTo(target, { teleport: true });
      else openStop('hq');
    });
  }

  // The city → home screen: rise back over the skyline and fade the intro in.
  function goHome() {
    if (state.mode === 'intro' || state.mode === 'swoop' || state.teleporting) return;
    ui.closeOverlay();
    if (state.mode === 'panel') closeStop({ silent: true });
    autopilot.stop();
    state.target = null;
    ui.showAutopilot(null);
    state.tour = null;
    ui.showTour(null);
    ui.showPrompt(null);
    input.enabled = false;
    input.keys.clear();
    state.mode = 'intro';
    state.near = null;
    state.dismissed = null;
    ui.setLabelsVisible(false);
    ui.showIntro();
    rig.flyToOrbit(2.6);
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ------------------------------------------------------------------ UI events
  ui.on('start', begin);
  ui.on('home', goHome);
  ui.on('enter3d', () => state.mode === 'intro' && begin()); // "Explore in 3D" from the classic view
  ui.on('theme', setTheme);
  ui.on('travel', (id) => travelTo(id));
  ui.on('tour', () => (state.tour ? endTour(`Tour ended. You’re driving: ${driveHint()}`) : startTour()));
  // Tour bar: jump to any stop, or step to the previous / next one.
  function tourGo(k) {
    if (!state.tour || state.mode === 'intro' || state.mode === 'swoop' || state.teleporting) return;
    travelTo(stops[clamp(k, 0, stops.length - 1)].id);
  }
  ui.on('tourGo', tourGo);
  ui.on('tourStep', (dir) => {
    if (!state.tour) return;
    const here = state.current || state.target;
    const base = here ? stops.findIndex((s) => s.id === here) : state.tour.index;
    tourGo(base + dir);
  });
  ui.on('exitTour', () => endTour(`Tour ended. You’re driving: ${driveHint()}`));
  ui.on('skip', () => state.target && teleportTo(state.target));
  ui.on('takeWheel', () => cancelAutopilot('manual'));
  ui.on('closePanel', () => closeStop());
  ui.on('panelNav', (dir) => {
    if (state.mode !== 'panel') return; // ignore clicks while the panel slides away
    const i = stops.findIndex((s) => s.id === state.current);
    if (state.tour && dir > 0 && i === stops.length - 1) {
      closeStop();
      endTour('<b>Tour complete.</b> The city is yours. Press <kbd>M</kbd> for the map anytime.');
      return;
    }
    const next = stops[(i + dir + stops.length) % stops.length];
    travelTo(next.id);
  });
  ui.on('interact', () => interact());
  ui.on('map', () => toggleMap());
  ui.on('help', () => (ui.overlayOpen('help') ? ui.closeOverlay() : ui.openOverlay('help')));
  ui.on('sound', async (on) => {
    ui.setSound(on);
    await audio.setEnabled(on);
    if (on) audio.blip(660);
  });
  ui.on('classic', (open) => {
    audio.suspend(open);
    if (!open) clock.last = performance.now();
  });
  document.addEventListener('visibilitychange', () => audio.suspend(document.hidden || ui.classicOpen));

  input.on('interact', () => interact());
  input.on('map', () => state.mode !== 'intro' && toggleMap());
  input.on('theme', () => setTheme(theme === 'day' ? 'night' : 'day'));
  input.on('camera', () => state.mode === 'drive' && rig.cyclePreset());
  input.on('reset', () => state.mode === 'drive' && (cancelAutopilot(), resetCar()));
  input.on('help', () => state.mode !== 'intro' && (ui.overlayOpen('help') ? ui.closeOverlay() : ui.openOverlay('help')));
  input.on('tour', () => state.mode !== 'intro' && (state.tour ? endTour(`Tour ended. You’re driving: ${driveHint()}`) : startTour()));
  input.on('home', () => goHome());
  input.on('escape', () => {
    if (ui.overlayOpen()) return ui.closeOverlay();
    if (ui.classicOpen) return ui.closeClassic();
    if (state.mode === 'panel') return closeStop();
    if (autopilot.active) return cancelAutopilot('manual');
  });
  input.on('driveKey', () => {
    if (state.mode === 'panel') closeStop();
    if (autopilot.active) cancelAutopilot('manual');
    state.hint = false;
  });
  input.on('drag', (dx, dy) => state.mode === 'drive' && rig.onDrag(dx, dy));
  input.on('dragEnd', () => rig.onDragEnd());
  input.on('zoom', (d) => state.mode === 'drive' && rig.onZoom(d));

  function interact() {
    if (state.mode === 'panel') return closeStop();
    if (state.mode !== 'drive' || ui.overlayOpen()) return;
    if (state.near) openStop(state.near);
  }

  let mapHit = null;
  function toggleMap() {
    if (ui.overlayOpen('map')) return ui.closeOverlay();
    ui.openOverlay('map');
    requestAnimationFrame(() => (mapHit = minimap.drawBig(car, autopilot.route, accent())));
  }
  document.getElementById('bigmap').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const lm = mapHit?.(e.clientX - r.left, e.clientY - r.top);
    if (lm) {
      ui.closeOverlay();
      travelTo(lm.id);
    }
  });

  const accent = () => (theme === 'day' ? '#08679a' : '#ffd23f');

  // Sound is opt-in on every visit; drop the preference older versions stored.
  try {
    localStorage.removeItem('sound');
  } catch {
    /* storage unavailable */
  }

  // ------------------------------------------------------------------ loop
  const ctx = { dt: 0, camera, pixelHeight: renderer.domElement.height };
  const neutral = { throttle: 0, steer: 0, handbrake: true, boost: false, any: false };
  let labelTimer = 0;
  let beanTimer = 0;
  let apTimer = 0;
  const obstacles = traffic.cars.map((c) => ({ x: c.x, z: c.z, r: 2.1 }));

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;
    if (ui.classicOpen || document.hidden) return;
    clock.t += dt;
    const t = clock.t;
    ctx.dt = dt;
    ctx.pixelHeight = renderer.domElement.height;

    // theme transition
    if (!themeCtl.settled) {
      const speed = reduced ? 4 : 0.45;
      themeCtl.n = clamp(themeCtl.n + Math.sign(themeCtl.target - themeCtl.n) * dt * speed, 0, 1);
      applyTheme(themeCtl.n);
      if (themeCtl.n === themeCtl.target) {
        themeCtl.settled = true;
        captureEnvironment();
      }
    }

    // driving input
    let drive = input.drive;
    if (state.mode === 'drive') {
      if (autopilot.active) {
        const r = autopilot.update(car, dt, traffic.cars);
        drive = r.input;
        if (r.done) openStop(state.target);
        else if (r.stuck) teleportTo(state.target);
      }
    } else drive = neutral;

    traffic.cars.forEach((c, k) => {
      obstacles[k].x = c.x;
      obstacles[k].z = c.z;
    });
    car.update(drive, dt, obstacles);
    if (car.impact > 5) rig.bump(Math.min(0.8, car.impact / 25));

    batmobile.root.position.set(car.x, 0, car.z);
    batmobile.root.rotation.y = car.heading;
    batmobile.update({ dt, speed: car.speed, steer: car.steer, accel: car.accel, lateral: car.lateral, boost: car.boosting, braking: car.braking || (drive.throttle < 0 && car.speed > 0.5) });

    traffic.update(dt, state.mode === 'intro' ? null : { x: car.x, z: car.z }, t);
    city.update(t);
    chicago.update(t, ctx);
    landmarks.update(t, dt, camera.position, state.mode === 'intro' ? null : car, state.current);
    landmarks.extras.batSignal?.update(dt);
    effects.update(t, ctx);
    rig.update(dt, t, car, { boosting: car.boosting, viewport: engine.viewport });
    sky.update(t, camera);

    // shadows follow the car (snapped to texels to avoid shimmering)
    if (sun.castShadow) {
      const focus = state.mode === 'intro' ? rig.look : batmobile.root.position;
      const step = 190 / tier.shadows;
      const fx = Math.round(focus.x / step) * step;
      const fz = Math.round(focus.z / step) * step;
      sun.target.position.set(fx, 0, fz);
      sun.position.set(fx + palette.lightDir.x * 400, palette.lightDir.y * 400, fz + palette.lightDir.z * 400);
    } else sun.position.copy(palette.lightDir).multiplyScalar(400);

    // GPS guidance: chevrons on the road toward the autopilot target, or toward the next tour
    // stop when you've taken the wheel. The manual route re-plans only if you leave it.
    let gId = null;
    let gRoute = null;
    let gIdx = 0;
    if (state.mode === 'drive') {
      if (autopilot.active) {
        gId = state.target;
        gRoute = autopilot.route;
        gIdx = autopilot.idx;
      } else if (state.tour) {
        const k = state.tour.arrived === state.tour.index ? state.tour.index + 1 : state.tour.index;
        if (k < stops.length) gId = stops[k].id;
      }
    }
    if (gId && !gRoute) {
      const lm = landmarks.byId[gId];
      let off = Infinity;
      if (guide.route && guide.id === gId) [guide.idx, off] = closestOnRoute(guide.route, car.x, car.z, guide.idx);
      if (guide.id !== gId || off > 9) {
        guide.route = planRoute(car.x, car.z, car.heading, lm.pad.x, lm.pad.z);
        guide.id = gId;
        guide.idx = 0;
      }
      gRoute = guide.route;
      gIdx = guide.idx;
    }
    const gLm = gId ? landmarks.byId[gId] : null;
    const atGoal = gLm && Math.hypot(car.x - gLm.pad.x, car.z - gLm.pad.z) < 10;
    arrows.update(dt, gRoute, gIdx, gLm?.stop.color, !!gRoute && !atGoal, themeCtl.n);

    // proximity → prompt / auto-open
    if (state.mode === 'drive' && !autopilot.active) {
      let near = null;
      for (const lm of landmarks.list) if (Math.hypot(car.x - lm.pad.x, car.z - lm.pad.z) < 8.5) near = lm.id;
      if (state.dismissed && state.dismissed !== near) state.dismissed = null;
      state.near = near;
      ui.showPrompt(near && near !== state.dismissed ? stopById[near] : null);
      if (near && near !== state.dismissed && Math.abs(car.speed) < 2.5 && drive.throttle <= 0) {
        state.dwell += dt;
        if (state.dwell > 0.7) openStop(near);
      } else state.dwell = 0;
    } else if (state.mode !== 'panel') ui.showPrompt(null);

    // HUD
    ui.speedo(car.speed, car.boostTank);
    if ((apTimer -= dt) <= 0) {
      apTimer = 0.25;
      if (autopilot.active) ui.showAutopilot(stopById[state.target], autopilot.remaining);
      else if (state.mode === 'drive' && gRoute) ui.showAutopilot(stopById[gId], gRoute.length - gRoute.cum[gIdx], { manual: true });
      else if (state.mode === 'drive') ui.showAutopilot(null);
    }
    if (state.mode !== 'intro') minimap.draw(car, gRoute, accent());
    if ((labelTimer -= dt) <= 0) {
      labelTimer = 0.15;
      if (state.mode !== 'intro') ui.updateLabels(landmarks.list, camera.position, state.mode === 'panel');
    }
    // Cloud Gate reflects the city (and you) when you're nearby
    if ((beanTimer -= dt) <= 0) {
      beanTimer = 0.2;
      if (engine.quality !== 'low' && camera.position.distanceTo(chicago.bean.position) < 260) {
        chicago.bean.visible = false;
        chicago.beanCam.update(renderer, scene);
        chicago.bean.visible = true;
      }
    }

    audio.update({ speed: car.speed, throttle: drive.throttle, boost: car.boosting, night: themeCtl.n, idle: state.mode !== 'drive' });
    engine.adapt(dt);
    engine.render(t);
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    minimap.resize();
    if (state.mode === 'panel') rig.viewShiftTarget = panelShift();
    if (ui.overlayOpen('map')) mapHit = minimap.drawBig(car, autopilot.route, accent());
  });

  // testing hook (dev server or ?debug)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug'))
    window.__city = { state, car, rig, travelTo, teleportTo, setTheme, openStop, closeStop, begin, startTour, goHome, landmarks, engine, autopilot };
}

boot().catch((err) => {
  console.error(err);
  html.classList.add('no-webgl');
});
