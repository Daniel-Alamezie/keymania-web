import { useSyncExternalStore } from 'react';

/**
 * Procedural sound effects, synthesised with the Web Audio API.
 *
 * Nothing is loaded from disk — every sound is generated from oscillators and
 * noise buffers. That keeps the repo asset-free and lets each effect be tuned
 * by changing numbers rather than re-recording audio.
 *
 * The AudioContext is created lazily on first use because browsers block audio
 * until a user gesture (here, clicking a difficulty to start a duel).
 */

type Wave = OscillatorType;

const MUTE_KEY = 'keymania.muted';
const MASTER_GAIN = 0.32;

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.isEnabled() ? MASTER_GAIN : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /**
   * Whether sound plays, remembered between visits.
   *
   * This used to be React state inside the duel, which meant it reset every
   * time one started — muting was a per-duel chore rather than a preference.
   * It lives here because the audio engine is the thing that actually owns it,
   * and because the menu, the lobby and the duel all need to agree.
   */
  private hydrated = false;
  private listeners = new Set<() => void>();

  private hydrate() {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    try {
      // Absent means on: a game should make noise until told otherwise.
      this.enabled = localStorage.getItem(MUTE_KEY) !== 'muted';
    } catch {
      /* private mode — the preference simply will not survive the visit */
    }
    if (this.master) this.master.gain.value = this.enabled ? MASTER_GAIN : 0;
  }

  setEnabled(on: boolean) {
    this.hydrated = true;
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? MASTER_GAIN : 0;
    try {
      localStorage.setItem(MUTE_KEY, on ? 'on' : 'muted');
    } catch {
      /* nothing to persist to */
    }
    this.listeners.forEach((notify) => notify());
  }

  toggle() {
    this.setEnabled(!this.isEnabled());
  }

  isEnabled() {
    this.hydrate();
    return this.enabled;
  }

  /** For useSyncExternalStore — see useSoundEnabled below. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  /** A pitched blip with an exponential decay. */
  private tone(freq: number, duration: number, type: Wave = 'square', gain = 0.5, slideTo?: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    env.gain.setValueAtTime(gain, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(env).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Filtered white noise — the basis of whooshes and impacts. */
  private hiss(duration: number, filterFrom: number, filterTo: number, gain = 0.5) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    if (!this.noise) {
      const length = ctx.sampleRate * 0.6;
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFrom, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(filterTo, ctx.currentTime + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter).connect(env).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + duration);
  }

  /** Every correct keystroke: a short, dry click. Pitch rises with the combo. */
  key(combo: number) {
    this.tone(520 + Math.min(combo, 12) * 22, 0.035, 'square', 0.18);
  }

  /** SPACE committing a word — the blade is forged and thrown. */
  throwBlade(tier: number) {
    this.tone(300 + tier * 60, 0.09, 'sawtooth', 0.2, 780 + tier * 90);
    this.hiss(0.18, 900, 2600, 0.22);
  }

  /** A blade landing. Heavier blades hit lower and longer. */
  impact(tier: number) {
    this.tone(150 - tier * 8, 0.16 + tier * 0.02, 'square', 0.42, 46);
    this.hiss(0.14, 1800, 260, 0.36);
  }

  /** Forging a bigger blade — a short rising arpeggio. */
  tierUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.11, 'square', 0.24), i * 55),
    );
  }

  /** A typo: a flat, ugly buzz that breaks the rhythm on purpose. */
  miss() {
    this.tone(150, 0.14, 'sawtooth', 0.28, 88);
  }

  /**
   * The swell under the finishing beat, before the result lands.
   *
   * A slow tone bed rather than a hit: it fills the hold while the loser falls
   * and the arena drains, so the silence between the killing blow and the
   * banner is charged rather than empty. Winning rises, losing sinks.
   */
  finishSwell(won: boolean) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = won ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(won ? 110 : 150, now);
    // Lifting into the victory fanfare, or sagging away under the defeat sting.
    osc.frequency.exponentialRampToValueAtTime(won ? 330 : 55, now + 1.7);

    // Fades in rather than starting at full volume — a hard onset would read as
    // a second impact right after the killing blow.
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(won ? 0.22 : 0.3, now + 0.9);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + 1.9);

    // A low thud on the moment of the blow itself.
    this.tone(won ? 196 : 98, 0.5, 'sine', 0.45);
  }

  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.18, 'square', 0.3), i * 105),
    );
  }

  defeat() {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.28, 'triangle', 0.3), i * 150),
    );
  }
}

export const audio = new GameAudio();

/**
 * Whether sound is on, for React.
 *
 * Read through useSyncExternalStore rather than useState because the
 * preference lives in localStorage, which does not exist during server
 * rendering. The server snapshot is `true` — sound on — so a muted player sees
 * the icon correct itself once, on the first client render, rather than the
 * page failing to hydrate.
 */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(audio.subscribe, () => audio.isEnabled(), () => true);
}
