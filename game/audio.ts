import { useSyncExternalStore } from 'react';
import type { PowerKind } from '@/models/powers';
import {
  DEFAULT_KEY_SOUND, keySoundById, type KeySound, type KeySoundId,
} from './keyProfiles';

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

/**
 * One noise burst, confined to a band. See burst().
 *
 * Both edges are named rather than implied by a single cutoff, because the
 * character of a keyswitch is defined as much by what is *absent* as by what is
 * there — a creamy board is one with the sub-300Hz boom and the 5kHz-and-up
 * spike both taken away.
 */
interface Burst {
  at: number;
  duration: number;
  /** Rolled off below this. Deep thock lives under here. */
  low: number;
  /** Rolled off above this. Harsh clack lives over here. */
  high: number;
  /** Where the energy concentrates, between the two edges. */
  centre: number;
  /**
   * How tightly it concentrates there.
   *
   * Around 0.7 the band is wide enough to span roughly an octave and a half;
   * push it up and the sound narrows towards a single ringing note.
   */
  q?: number;
  gain: number;
  attack?: number;
}

/** One oscillator's worth of a layered sound. See voice(). */
interface Voice {
  /** When to start, on the audio clock — shared between layers so they strike together. */
  at: number;
  freq: number;
  /** Slide to this by the end. Omit for a steady pitch. */
  to?: number;
  duration: number;
  type?: Wave;
  gain?: number;
  /**
   * Fade-in, in seconds.
   *
   * Zero means the sound starts at full volume on its first sample, which the
   * ear hears as a click. That transient is the entire character of a clack or
   * an impact, and the entire thing a thock or a hover note has to avoid.
   */
  attack?: number;
}

const MUTE_KEY = 'keymania.muted';
/** Which keyboard the player types on. Their choice, remembered. */
const SOUND_KEY = 'keymania.keysound';
const MASTER_GAIN = 0.32;
const VOLUME_KEY = 'keymania.volume';

/**
 * How loud, as a fraction of the master gain.
 *
 * A separate control from the mute, because they answer different questions:
 * mute is "not now", volume is "this is my level". Folding them into one
 * slider that reaches zero would lose the distinction — somebody who slides
 * to silence and back expects their level returned, not remembered as muted.
 */
const DEFAULT_VOLUME = 1;
/** Shortest gap between two hover blips, in seconds. */
const HOVER_GAP = 0.07;

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** On the audio clock, not Date.now() — see hover(). */
  private lastHoverAt = -1;
  private keySound: KeySoundId = DEFAULT_KEY_SOUND;
  private enabled = true;
  private volume = DEFAULT_VOLUME;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level();
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
      const saved = localStorage.getItem(SOUND_KEY);
      // Validated rather than trusted: a profile removed in a later release
      // would otherwise leave somebody with a keyboard that makes no sound.
      if (saved) this.keySound = keySoundById(saved).id;
      /**
       * Absent is not zero, and this is the whole reason the raw string is
       * read first. `Number(null)` is 0, which passes every range check a
       * volume needs — so the obvious spelling silently set every first-time
       * player's volume to nothing, and the slider opened at 0 with no
       * explanation. Same shape as the mistake `typeof x === 'number'` exists
       * to prevent elsewhere in this codebase: zero is a real level somebody
       * may have chosen, so it can never double as "unset".
       */
      const stored = localStorage.getItem(VOLUME_KEY);
      if (stored !== null) {
        const level = Number(stored);
        // Validated rather than trusted: a hand-edited or corrupted value must
        // not be able to make the game silent with no visible cause.
        if (Number.isFinite(level) && level >= 0 && level <= 1) this.volume = level;
      }
    } catch {
      /* private mode — the preference simply will not survive the visit */
    }
    if (this.master) this.master.gain.value = this.level();
  }

  /**
   * The gain actually applied: mute wins, then volume scales.
   *
   * One function rather than the same ternary at four call sites, which is
   * how the mute and the volume would eventually disagree about who is in
   * charge of silence.
   */
  private level() {
    return this.isEnabled() ? MASTER_GAIN * this.volume : 0;
  }

  setEnabled(on: boolean) {
    this.hydrated = true;
    this.enabled = on;
    if (this.master) this.master.gain.value = this.level();
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

  /**
   * Set the level, 0 to 1, and remember it.
   *
   * Clamped rather than trusted, and deliberately does NOT unmute: a player
   * dragging the slider while muted is setting the level they want to hear
   * when they come back, and silently unmuting would be the game overruling a
   * choice they made on purpose. The settings sheet says so beside the slider.
   */
  setVolume(next: number) {
    this.hydrate();
    this.volume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_VOLUME));
    if (this.master) this.master.gain.value = this.level();
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      /* nothing to persist to */
    }
    this.listeners.forEach((notify) => notify());
  }

  getVolume() {
    this.hydrate();
    return this.volume;
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

  /**
   * One oscillator with an envelope, startable at a chosen moment.
   *
   * tone() reads ctx.currentTime itself, which is fine for a sound made of a
   * single voice but useless for layering — two calls a microsecond apart start
   * at measurably different times, and the smear is audible on a sharp
   * transient. Everything built from stacked partials goes through here so the
   * layers share one `at` and strike together.
   */
  private voice({ at, freq, to, duration, type = 'square', gain = 0.5, attack = 0 }: Voice) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + duration);

    if (attack > 0) {
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(gain, at + attack);
    } else {
      // No fade at all: the onset is the sound. This is the difference between
      // a clack and a thock more than any frequency is.
      env.gain.setValueAtTime(gain, at);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(env).connect(this.master);
    osc.start(at);
    osc.stop(at + duration + 0.01);
  }

  /**
   * A noise burst with both edges named and a centre of mass between them.
   *
   * `tick` is a single filter, which can shape one side of a sound or ring at a
   * point, but cannot say "energy here, nothing outside". That is exactly what a
   * creamy switch is: a tightly concentrated band with the deep thock rolled
   * off below and the harsh clack rolled off above. Three stages in series say
   * it directly — a floor, a peak, and a ceiling.
   */
  private burst({ at, duration, low, high, centre, q = 0.7, gain, attack = 0 }: Burst) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);

    const floor = ctx.createBiquadFilter();
    floor.type = 'highpass';
    floor.frequency.setValueAtTime(low, at);

    const peak = ctx.createBiquadFilter();
    peak.type = 'bandpass';
    peak.frequency.setValueAtTime(centre, at);
    peak.Q.setValueAtTime(q, at);

    const ceiling = ctx.createBiquadFilter();
    ceiling.type = 'lowpass';
    ceiling.frequency.setValueAtTime(high, at);

    const env = ctx.createGain();
    if (attack > 0) {
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(gain, at + attack);
    } else {
      env.gain.setValueAtTime(gain, at);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    src.connect(floor).connect(peak).connect(ceiling).connect(env).connect(this.master);
    src.start(at);
    src.stop(at + duration);
  }

  /** White noise, generated once and reused by every noise-based effect. */
  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = ctx.sampleRate * 0.6;
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  /**
   * A brief noise burst with the highs rolled off — the sound of two pieces of
   * plastic meeting.
   *
   * Lowpass, where hiss() is bandpass, and that is the whole difference between
   * a thock and a clack. Clacky boards are loud from 3kHz up; thocky ones have
   * that energy damped away, leaving the body of the sound and none of the
   * spike. Everything tactile in this game is shaped by where this cutoff sits.
   */
  private tick(
    at: number,
    duration: number,
    cutoff: number,
    gain: number,
    // Highpass keeps everything above the cutoff instead of everything below,
    // turning the same burst from a thock into a clack.
    type: BiquadFilterType = 'lowpass',
    /**
     * Resonance, for bandpass bursts.
     *
     * How hard the filter rings at its cutoff. Around 1 the result is just
     * filtered static; push it up and the noise starts to take on the character
     * of a hollow object being struck — without ever acquiring a pitch you
     * could hum. That is the whole trick to a mechanical sound.
     */
    q = 1,
  ) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const shape = ctx.createBiquadFilter();
    shape.type = type;
    shape.Q.setValueAtTime(q, at);
    shape.frequency.setValueAtTime(cutoff, at);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(shape).connect(env).connect(this.master);
    src.start(at);
    src.stop(at + duration);
  }

  /** Filtered white noise — the basis of whooshes and impacts. */
  private hiss(duration: number, filterFrom: number, filterTo: number, gain = 0.5) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    this.noiseBuffer(ctx);
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

  /**
   * The note a blade of this tier rings at.
   *
   * Shared by the throw and the landing on purpose: it is one object, and an
   * object does not change pitch between leaving your hand and arriving. Having
   * both read it from here is what makes a hit sound like the arrival of the
   * thing you heard thrown, rather than an unrelated noise that happens after
   * it. Heavier blades ring lower, so the tier is audible at both ends.
   */
  private bladeRoot(tier: number): number {
    return 1320 - tier * 105;
  }

  /**
   * A few percent either side of nominal, different on every call.
   *
   * Any sound a player hears hundreds of times in a session needs this. Two
   * identical playbacks are something the ear notices and starts to file as
   * artificial — not consciously, but it is the difference between a sound
   * wearing well over an hour and grating after ten minutes. The keystroke got
   * this treatment and the combat sounds did not, which was an oversight: a
   * duel is nothing but throws and landings.
   */
  private jitter(spread = 0.06): number {
    return 1 - spread + Math.random() * spread * 2;
  }

  /**
   * Every correct keystroke: a lubed switch in a well-damped case.
   *
   * The one sound a player hears thousands of times a session, so it is the one
   * worth the most care — and the one this file has got wrong twice.
   *
   * It began as a 520Hz square, a chiptune blip. That became a dull contact
   * over a pitched body falling from 210Hz to 132Hz, which was a genuine
   * improvement and still the wrong target: that is a *deep thock*, the boom of
   * a heavy case, and it is a different character entirely from creamy. Chasing
   * "creamier" by going lower and softer was walking away from the answer.
   *
   * Creamy is a band, and a narrow one. Energy concentrated between roughly
   * 1kHz and 4kHz — the "tac" a lubed switch makes — with the deep thock below
   * 300Hz and the harsh clack above 5kHz both rolled off. It is defined as much
   * by what is filtered out as by what is left in, which is why the two edges
   * are named explicitly rather than implied by a single cutoff.
   *
   * Two layers now, both noise. No oscillator at all: a keyswitch has no pitch,
   * and every time this file has reached for one the result read as electronic.
   * The character comes from where the energy sits, not from a note.
   */
  key(combo: number, sound: KeySound = this.profile()) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const at = ctx.currentTime;

    // No two presses on a real board are identical — different keys, different
    // positions on the plate. Without this jitter the ear picks up on a single
    // sample looping within a few words, which is what made the old blip feel
    // synthetic more than its waveform did.
    const vary = this.jitter(0.07);

    /**
     * One path, whichever keyboard is chosen.
     *
     * The profiles differ only in numbers — where the band sits, how hard its
     * edges are cut, whether there is any weight underneath. Branching per
     * character would let them drift apart; this way a change to how a
     * keystroke is *built* reaches all of them at once.
     */
    const { body, tac, thump } = sound;

    this.burst({
      at,
      duration: body.duration,
      low: body.low,
      high: body.high,
      centre: body.centre * vary,
      q: body.q,
      gain: body.gain,
      attack: body.attack,
    });

    // The combo nudges the tac upward *inside* the band rather than opening a
    // filter outward, and is capped: typing harder brightens the sound without
    // summoning back the top end a profile was built to exclude.
    if (tac) {
      this.tick(
        at,
        tac.duration,
        Math.min(tac.cap, tac.centre + Math.min(combo, 12) * tac.lift) * vary,
        tac.gain,
        'bandpass',
        tac.q,
      );
    }

    // The only pitched layer any profile has, and only where the character
    // genuinely wants a case under it.
    if (thump) {
      this.voice({
        at,
        freq: thump.freq * vary,
        to: thump.to * vary,
        duration: thump.duration,
        type: 'triangle',
        gain: thump.gain,
        attack: thump.attack,
      });
    }
  }

  /** The keyboard the player has chosen. */
  profile(): KeySound {
    this.hydrate();
    return keySoundById(this.keySound);
  }

  setKeySound(id: KeySoundId) {
    this.hydrated = true;
    this.keySound = id;
    try {
      localStorage.setItem(SOUND_KEY, id);
    } catch {
      /* nothing to persist to */
    }
    this.listeners.forEach((notify) => notify());
  }

  /**
   * A few presses, for auditioning a keyboard.
   *
   * More than one because a single press hides the two things worth hearing:
   * the per-press jitter, and how the tac brightens as a combo builds. Scheduled
   * on the audio clock rather than with setTimeout so the run is evenly spaced
   * however busy the main thread is.
   */
  demo(id: KeySoundId) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const sound = keySoundById(id);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.key(i * 2, sound), i * 105);
    }
  }

  /**
   * Pressing a button — a typebar hitting paper.
   *
   * The first attempt put a 1150Hz square at the centre of this, and a clear
   * pitch is exactly what stops a sound reading as mechanical. A note sounds
   * electronic no matter how bright it is or how fast it decays; nothing struck
   * in the physical world produces one. That partial is gone, and what is left
   * is entirely noise plus a knock too short to have a pitch at all.
   *
   * Three events a couple of milliseconds apart, which is what makes a
   * typewriter sound like a machine rather than a click: the hammer, the hollow
   * body it is mounted in, and the weight of the whole thing moving.
   */
  click() {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const at = ctx.currentTime;

    // The strike. Bright, broadband, and over in nine milliseconds.
    this.tick(at, 0.009, 2000, 0.3, 'highpass');

    // The body of the machine. A resonant bandpass is the important part here —
    // at Q of 1 this is just static, but wound up it rings like something hollow
    // being hit, while never settling on a note you could hum. That is the
    // difference between a mechanical sound and an electronic one.
    this.tick(at + 0.002, 0.038, 760, 0.34, 'bandpass', 3.4);

    // Weight underneath. Deliberately under 45ms: a tone this short is heard as
    // a knock rather than as a pitch, which is precisely where the last version
    // went wrong — 35ms of 1150Hz was still long enough to register as a beep.
    this.voice({ at, freq: 200, to: 92, duration: 0.042, type: 'triangle', gain: 0.22 });
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

  /**
   * SPACE committing a word — the blade is forged and thrown.
   *
   * This was a rising sawtooth, which buzzes rather than rings. Steel sounds
   * the way it does because a struck metal object's partials are *inharmonic* —
   * they sit at fractional multiples of the root instead of whole ones. Whole
   * multiples are what make a violin sound like a note; fractional ones are
   * what make a bell sound like a bell. 2.76 is the classic first ratio, and
   * two partials at that spacing is all it takes to stop reading as a
   * synthesiser and start reading as metal.
   *
   * Everything rises, because the blade is leaving.
   */
  throwBlade(tier: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const at = ctx.currentTime;

    /**
     * Fixed pitch, for the life of the sound.
     *
     * The previous version swept these partials upward and it came out a
     * cartoon jump, because a rising pitched tone *is* a cartoon jump. A struck
     * object's note is set by its dimensions and nothing else — a bell, a bar,
     * a blade all ring at their own pitch and simply decay. The things that
     * sweep are springs and sirens. Getting the partial ratios right bought
     * nothing while the sweep was still there.
     *
     * Heavier blades ring lower, so the tier is audible before it is visible.
     */
    const vary = this.jitter();
    const root = this.bladeRoot(tier) * vary;
    const ring = 0.16 + tier * 0.03;

    // 1 : 2.76 : 5.40 — the mode ratios of a struck circular plate. Each
    // partial decays faster than the one below it, which is what stops a stack
    // of sines sounding like an organ chord and makes it sound like metal.
    this.voice({ at, freq: root, duration: ring, type: 'triangle', gain: 0.15 });
    this.voice({ at, freq: root * 2.76, duration: ring * 0.6, type: 'sine', gain: 0.085 });
    this.voice({ at, freq: root * 5.4, duration: ring * 0.3, type: 'sine', gain: 0.045 });

    // The effort behind the throw, low and gone quickly. Without it the sound
    // is a ting with nothing pushing it.
    this.voice({ at, freq: 170 * vary, to: 95, duration: 0.075, type: 'triangle', gain: 0.22 });

    // Every bit of movement lives here now. The tone is the blade; the noise is
    // the blade leaving.
    this.hiss(0.17, 620, 2900, 0.17);
  }

  /**
   * A blade landing. Heavier blades hit lower and longer.
   *
   * The punch is almost entirely the *speed* of the pitch drop. A tone falling
   * from 300Hz to 48Hz inside 90ms is read by the ear as force rather than as a
   * change of note, which is why a hit lands harder than a low tone of the same
   * volume ever does. Slow that ramp down and it stops being an impact and
   * starts being a sad trombone.
   *
   * Three layers: the crack of contact, the punch, and a tail underneath it so
   * the hit has somewhere to fall rather than simply stopping.
   */
  impact(tier: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.enabled) return;
    const at = ctx.currentTime;

    /**
     * The contact: short, and resonant rather than broadband.
     *
     * This is where the old version went wrong. It ran a 35ms noise burst at
     * 0.32 *and* a 150ms hiss at 0.3 — more energy in noise than in everything
     * pitched, and a tail three times longer than the punch it was supposed to
     * be decorating. Two overlapping washes of static do not add up to an
     * impact; they add up to static. A resonant bandpass rings like something
     * being hit, where broadband noise just hisses.
     */
    const vary = this.jitter();

    this.tick(at, 0.019, (1700 - tier * 130) * vary, 0.24, 'bandpass', 2.2);

    /**
     * The blade, arriving.
     *
     * The same root the throw rang at, so the hit is audibly the landing of
     * that specific object rather than a drum that happens to follow it. Much
     * shorter and quieter than in flight, because this one is being stopped by
     * something rather than ringing freely — a blade that sang as loudly on
     * arrival would sound like it had hit a bell.
     */
    const blade = this.bladeRoot(tier) * vary;
    this.voice({ at, freq: blade, duration: 0.045, type: 'sine', gain: 0.075 });
    this.voice({ at, freq: blade * 2.76, duration: 0.022, type: 'sine', gain: 0.036 });

    /**
     * The punch, which should dominate everything else here.
     *
     * It lands on 62Hz rather than the 44 it used to. Below about 60Hz there is
     * nothing left on a laptop or a phone — the end of every hit was being
     * thrown away on most of the hardware this is played on. Triangle rather
     * than sine for the same reason: its odd harmonics put audible energy at
     * 186 and 310Hz, so a small speaker still conveys the drop even when it
     * cannot reproduce the fundamental at all.
     */
    this.voice({
      at,
      freq: (352 - tier * 28) * vary,
      to: 62,
      duration: 0.08 + tier * 0.012,
      type: 'triangle',
      gain: 0.55,
    });

    // Started a beat late and pitched below the punch, so the hit decays into
    // something instead of leaving a hole. Heavier blades ring on noticeably
    // longer, which is most of what separates a big hit from a small one.
    this.voice({
      at: at + 0.008,
      freq: 132 * vary,
      to: 74,
      duration: 0.22 + tier * 0.05,
      type: 'sine',
      gain: 0.32,
    });

    // A breath of air under the hit. Never enough to become the hit.
    this.hiss(0.055, 1100, 320, 0.11);
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

/**
 * The chosen keyboard, for React.
 *
 * Same store and the same reasoning as useSoundEnabled: the preference lives in
 * localStorage, which does not exist during a server render, so the server
 * snapshot is the default and a player who picked something else sees it
 * correct itself on the first client render rather than failing to hydrate.
 */
/**
 * The chosen level, for React. Same store as the mute and the keyboard, so a
 * slider dragged in the settings sheet moves every other reader with it.
 */
export function useVolume(): number {
  return useSyncExternalStore(
    audio.subscribe,
    () => audio.getVolume(),
    () => DEFAULT_VOLUME,
  );
}

export function useKeySound(): KeySoundId {
  return useSyncExternalStore(
    audio.subscribe,
    () => audio.profile().id,
    () => DEFAULT_KEY_SOUND,
  );
}
