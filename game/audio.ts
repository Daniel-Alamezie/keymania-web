import { useSyncExternalStore } from 'react';
import type { PowerKind } from '@/models/powers';

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
/** Shortest gap between two hover blips, in seconds. */
const HOVER_GAP = 0.07;

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** On the audio clock, not Date.now() — see hover(). */
  private lastHoverAt = -1;
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

  /**
   * Wake the audio engine on a real user gesture.
   *
   * Browsers only allow an AudioContext to start from a genuine interaction,
   * and hovering is explicitly not one — the spec grants activation for clicks,
   * keys and taps, never for mouse movement. Without this, hover sounds would
   * stay silent until the player's first *duel*, since nothing else on the menu
   * makes a noise. One cheap pointerdown gets the engine running so the rest of
   * the session has sound.
   */
  unlock() {
    this.ensure();
  }

  /** Every correct keystroke: a short, dry click. Pitch rises with the combo. */
  key(combo: number) {
    this.tone(520 + Math.min(combo, 12) * 22, 0.035, 'square', 0.18);
  }

  /**
   * Passing over something you can click.
   *
   * Built by hand rather than through tone() because tone() starts at full
   * volume on the first sample. That instant onset is a percussive click — it
   * is exactly what a keystroke and an impact want, and exactly what "soft"
   * cannot have. A 14ms fade-in removes the transient while staying far too
   * short to feel laggy.
   *
   * The design test for a hover sound is not whether it is pleasant once. It is
   * whether it is still pleasant the four hundredth time, so this is restrained
   * on purpose: a pure sine with no harmonics to fatigue the ear, a small rise
   * to read as inviting rather than as a confirmation, and a gain of 0.07 —
   * under half a keystroke, a fifth of a blade landing. It should sit under the
   * game rather than in it.
   */
  hover() {
    // Never the thing that boots the engine. An ambient sound has no business
    // constructing an AudioContext, and one made outside a gesture would only
    // sit there suspended and log a warning.
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    // Sweeping across a row of buttons fires one of these per button. Without a
    // floor between them a flick of the wrist becomes a machine gun, while a
    // gap this short still sounds every control you move to deliberately.
    const at = ctx.currentTime;
    if (at - this.lastHoverAt < HOVER_GAP) return;
    this.lastHoverAt = at;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, at);
    osc.frequency.exponentialRampToValueAtTime(840, at + 0.07);

    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.07, at + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);

    osc.connect(env).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.1);
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
   * Claiming a charged word.
   *
   * Two layers. A rising sparkle plays for all three, so the moment reads as
   * "claimed" instantly whichever power it was — during a duel the ear needs to
   * know something good happened before it needs to know what. Underneath it,
   * each power has its own voice, so a player who has heard them a few times
   * knows what they picked up without looking away from the text.
   *
   * Deliberately the loudest thing in the stream. Keystrokes sit at 0.18 and a
   * blade landing at 0.42; this has to beat both, or the payoff for taking a
   * risk is quieter than the routine.
   */
  claimPower(kind: PowerKind) {
    [880, 1175, 1568].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.09, 'square', 0.17), i * 42),
    );

    if (kind === 'ward') {
      // Something closing over you: low, round, settling rather than spiking.
      this.tone(220, 0.34, 'triangle', 0.3, 330);
      this.hiss(0.3, 400, 1500, 0.14);
    } else if (kind === 'surge') {
      // The zap it looks like — a hard upward sweep with bright air on top.
      this.tone(180, 0.24, 'sawtooth', 0.28, 1500);
      this.hiss(0.16, 2200, 5200, 0.2);
    } else {
      // Mend is warm and unhurried: a major triad on sines, no edge to it.
      [392, 523, 659].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.22, 'sine', 0.32), i * 72),
      );
    }
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
