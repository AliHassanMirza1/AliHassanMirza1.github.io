import { clamp } from './util.js';

// Unified input: keyboard, touch joystick + buttons, gamepad, and mouse-drag camera.

const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

export class Input {
  constructor({ stage, joy, touchButtons }) {
    this.keys = new Set();
    this.handlers = {};
    this.enabled = false;
    this.touch = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, boost: false, drift: false };
    this.pad = { prev: [] };
    this.lastUsed = 'keyboard';
    this._bindKeyboard();
    this._bindTouch(stage, joy, touchButtons);
    this._bindMouse(stage);
  }

  on(name, fn) {
    (this.handlers[name] ||= []).push(fn);
  }

  emit(name, ...args) {
    for (const fn of this.handlers[name] || []) fn(...args);
  }

  _bindKeyboard() {
    const ignore = (e) => {
      const t = e.target;
      if (!t || t === document.body) return false;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return true;
      // let keyboard-focused buttons / links handle Enter & Space themselves
      // (a button that merely kept focus after a mouse click shouldn't eat the drift key)
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && /^(BUTTON|A)$/.test(t.tagName) && t.matches(':focus-visible')) return true;
      return false;
    };
    window.addEventListener('keydown', (e) => {
      // macOS drops keyups while Cmd is held, so release everything rather than let keys stick
      if (e.metaKey) this.keys.clear();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (ignore(e)) return;
      const inPanel = e.target?.closest?.('.panel, .overlay, .classic');
      // let panels scroll, and keep Shift free for Shift+Tab navigation
      if (inPanel && (/^(Arrow|Shift|Page)/.test(e.code) || e.code === 'Space')) return;
      if (e.code === 'Escape') return this.emit('escape');
      if (document.documentElement.classList.contains('classic-open')) return;
      // a modal overlay (map / help) only listens for its own toggles
      if (document.querySelector('.overlay:not([hidden])') && !['KeyM', 'Slash'].includes(e.code)) return;
      if (DRIVE_KEYS.has(e.code)) {
        if (!this.enabled) return;
        e.preventDefault();
        // Shift alone (e.g. typing "?" or Shift+Tab) isn't "taking the wheel"
        if (!this.keys.has(e.code) && !e.code.startsWith('Shift')) this.emit('driveKey', e.code);
        this.keys.add(e.code);
        this.lastUsed = 'keyboard';
        return;
      }
      if (e.repeat) return;
      const map = { KeyE: 'interact', Enter: 'interact', NumpadEnter: 'interact', KeyM: 'map', KeyN: 'theme', KeyC: 'camera', KeyR: 'reset', Slash: 'help', KeyT: 'tour', KeyH: 'home' };
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this.emit(action);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Meta') this.keys.clear();
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  _bindTouch(stage, joy, buttons) {
    const base = joy?.querySelector('.joy-base');
    const knob = joy?.querySelector('.joy-knob');
    const R = 55;
    const setKnob = () => {
      if (!base) return;
      base.style.left = `${this.touch.ox}px`;
      base.style.top = `${this.touch.oy}px`;
      const dx = clamp(this.touch.x - this.touch.ox, -R, R);
      const dy = clamp(this.touch.y - this.touch.oy, -R, R);
      knob.style.left = `${this.touch.ox + dx}px`;
      knob.style.top = `${this.touch.oy + dy}px`;
    };
    stage.addEventListener(
      'touchstart',
      (e) => {
        if (!this.enabled) return;
        for (const t of e.changedTouches) {
          if (t.clientX < window.innerWidth * 0.5 && !this.touch.active) {
            this.touch = { ...this.touch, active: true, id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
            joy?.classList.add('on');
            setKnob();
            this.lastUsed = 'touch';
            this.emit('driveKey', 'touch');
          } else {
            this._camTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
          }
        }
        e.preventDefault();
      },
      { passive: false },
    );
    stage.addEventListener(
      'touchmove',
      (e) => {
        for (const t of e.changedTouches) {
          if (this.touch.active && t.identifier === this.touch.id) {
            this.touch.x = t.clientX;
            this.touch.y = t.clientY;
            setKnob();
          } else if (this._camTouch && t.identifier === this._camTouch.id) {
            this.emit('drag', t.clientX - this._camTouch.x, t.clientY - this._camTouch.y);
            this._camTouch.x = t.clientX;
            this._camTouch.y = t.clientY;
          }
        }
        e.preventDefault();
      },
      { passive: false },
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch.active = false;
          this.touch.id = null;
          joy?.classList.remove('on');
        }
        if (this._camTouch && t.identifier === this._camTouch.id) {
          this._camTouch = null;
          this.emit('dragEnd');
        }
      }
    };
    stage.addEventListener('touchend', end);
    stage.addEventListener('touchcancel', end);

    for (const b of buttons || []) {
      const key = b.dataset.touch;
      const set = (v) => (e) => {
        e.preventDefault();
        this.touch[key] = v;
        b.classList.toggle('on', v);
        if (v) this.emit('driveKey', 'touch');
      };
      b.addEventListener('pointerdown', set(true));
      b.addEventListener('pointerup', set(false));
      b.addEventListener('pointerleave', set(false));
      b.addEventListener('pointercancel', set(false));
    }
  }

  _bindMouse(stage) {
    let down = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = { x: e.clientX, y: e.clientY };
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!down || e.pointerType !== 'mouse') return;
      this.emit('drag', e.clientX - down.x, e.clientY - down.y);
      down = { x: e.clientX, y: e.clientY };
    });
    const up = (e) => {
      if (e.pointerType !== 'mouse' || !down) return;
      down = null;
      this.emit('dragEnd');
    };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => this.emit('zoom', e.deltaY), { passive: true });
  }

  pollGamepad() {
    const pads = navigator.getGamepads?.() || [];
    const gp = [...pads].find(Boolean);
    if (!gp) return null;
    const b = (i) => gp.buttons[i]?.value ?? 0;
    const pressed = (i) => (gp.buttons[i]?.pressed ? 1 : 0);
    const edge = (i, name) => {
      const p = pressed(i);
      if (p && !this.pad.prev[i]) this.emit(name);
      this.pad.prev[i] = p;
    };
    edge(0, 'interact');
    edge(9, 'map');
    edge(3, 'theme');
    edge(8, 'camera');
    const steer = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
    const throttle = b(7) - b(6);
    const active = Math.abs(steer) > 0 || Math.abs(throttle) > 0.05 || pressed(2) || pressed(1);
    if (active) this.lastUsed = 'gamepad';
    return { throttle, steer, boost: !!pressed(2), handbrake: !!pressed(1), active };
  }

  get drive() {
    const k = this.keys;
    let throttle = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let steer = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let handbrake = k.has('Space');
    let boost = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.touch.active) {
      const dx = clamp((this.touch.x - this.touch.ox) / 55, -1, 1);
      const dy = clamp((this.touch.y - this.touch.oy) / 55, -1, 1);
      steer = Math.abs(dx) > 0.12 ? dx : 0;
      throttle = Math.abs(dy) > 0.15 ? -dy : 0;
    }
    if (this.touch.boost) boost = true;
    if (this.touch.drift) handbrake = true;
    const gp = this.pollGamepad();
    if (gp?.active) {
      throttle = gp.throttle || throttle;
      steer = gp.steer || steer;
      boost = boost || gp.boost;
      handbrake = handbrake || gp.handbrake;
    }
    if (!this.enabled) return { throttle: 0, steer: 0, handbrake: false, boost: false, any: false };
    const any = throttle !== 0 || steer !== 0 || handbrake || boost;
    return { throttle, steer, handbrake, boost, any };
  }
}
