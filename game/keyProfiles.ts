/**
 * Keyboard sound profiles.
 *
 * Every character this game can type in, expressed as numbers rather than as
 * code. There is one synthesis path for all of them — a filtered noise band, an
 * optional resonant peak, an optional low body — because the difference between
 * a creamy switch and a clacky one is genuinely just where the energy sits and
 * how hard the edges are cut. Writing them as data rather than as five branches
 * keeps that honest, and means adding a sixth is a paragraph of numbers.
 *
 * Nothing here has an oscillator doing the talking. A keyswitch has no pitch,
 * and the one profile with a pitched layer uses it as weight underneath, never
 * as the voice.
 */

export interface KeySound {
  id: KeySoundId;
  label: string;
  /** One line, for somebody choosing with their ears rather than their eyes. */
  blurb: string;

  /**
   * The body of the press: noise, held between two edges.
   *
   * `low` and `high` are the character. Below the floor is boom, above the
   * ceiling is spike, and which of those you keep is most of what separates
   * these profiles from each other.
   */
  body: {
    low: number;
    high: number;
    centre: number;
    q: number;
    gain: number;
    attack: number;
    duration: number;
  };

  /**
   * A tighter resonance riding on the body — the "tac".
   *
   * What stops a band of noise sounding like a puff of air. `lift` is how far a
   * combo nudges it upward and `cap` is how far that can ever go, so typing
   * harder brightens the sound without escaping the profile's own character.
   */
  tac: {
    centre: number;
    q: number;
    gain: number;
    duration: number;
    lift: number;
    cap: number;
  } | null;

  /**
   * Optional weight underneath, and the only pitched layer any profile has.
   *
   * Present only where the character genuinely calls for a case resonance.
   * Everything below roughly 120Hz is inaudible on the laptop speakers most of
   * this is played through, so none of these go lower than they can be heard.
   */
  thump: {
    freq: number;
    to: number;
    gain: number;
    attack: number;
    duration: number;
  } | null;
}

export type KeySoundId = 'tac' | 'creamy' | 'thock' | 'clack' | 'typewriter';

export const DEFAULT_KEY_SOUND: KeySoundId = 'tac';

export const KEY_SOUNDS: KeySound[] = [
  {
    id: 'tac',
    label: 'Tac',
    blurb: 'Crisp and mid-focused. The default.',
    // Energy held in the 1–4kHz band where a lubed switch speaks, with the
    // boom and the spike both cut away.
    body: { low: 300, high: 5000, centre: 2000, q: 0.75, gain: 0.3, attack: 0.003, duration: 0.055 },
    tac: { centre: 1850, q: 3.4, gain: 0.13, duration: 0.028, lift: 45, cap: 2600 },
    thump: null,
  },
  {
    id: 'creamy',
    label: 'Creamy',
    blurb: 'Rounder and more damped. Nothing sharp anywhere.',
    /**
     * The same shape as Tac with the top pulled down and the onset softened.
     *
     * A ceiling at 3.2kHz rather than 5kHz takes out the last of the edge, and
     * 7ms of attack rather than 3ms removes the click from the front. What is
     * left has no hard surface anywhere in it, which is the whole idea.
     */
    body: { low: 260, high: 3200, centre: 1350, q: 0.9, gain: 0.3, attack: 0.007, duration: 0.072 },
    tac: { centre: 1250, q: 2.6, gain: 0.085, duration: 0.036, lift: 25, cap: 1650 },
    // A little body, because damping the top leaves the sound needing somewhere
    // to sit. Gentle enough that it never becomes the thock profile.
    thump: { freq: 195, to: 155, gain: 0.1, attack: 0.008, duration: 0.062 },
  },
  {
    id: 'thock',
    label: 'Thock',
    blurb: 'Deep and hollow, like a heavy case.',
    // Kept because it is a real character, not a failed attempt at creamy — it
    // was simply the wrong answer to that particular question.
    body: { low: 120, high: 1900, centre: 520, q: 0.8, gain: 0.24, attack: 0.004, duration: 0.05 },
    tac: { centre: 300, q: 2.4, gain: 0.2, duration: 0.06, lift: 0, cap: 300 },
    thump: { freq: 210, to: 132, gain: 0.22, attack: 0.007, duration: 0.1 },
  },
  {
    id: 'clack',
    label: 'Clack',
    blurb: 'Bright and sharp. Everything the others cut out.',
    // No attack at all: the spike is the sound, which is exactly what the other
    // profiles exist to remove.
    body: { low: 700, high: 9000, centre: 3600, q: 0.6, gain: 0.26, attack: 0, duration: 0.034 },
    tac: { centre: 4200, q: 2, gain: 0.15, duration: 0.02, lift: 90, cap: 6200 },
    thump: { freq: 255, to: 180, gain: 0.07, attack: 0, duration: 0.03 },
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    blurb: 'A typebar hitting paper. Mechanical, not electronic.',
    // The button-press construction, applied to the keyboard: a hard strike
    // over a resonant hollow body.
    body: { low: 400, high: 6500, centre: 2500, q: 0.55, gain: 0.22, attack: 0, duration: 0.03 },
    tac: { centre: 760, q: 3.4, gain: 0.3, duration: 0.04, lift: 0, cap: 760 },
    thump: { freq: 200, to: 95, gain: 0.2, attack: 0, duration: 0.045 },
  },
];

export const keySoundById = (id: string): KeySound =>
  KEY_SOUNDS.find((sound) => sound.id === id)
  ?? KEY_SOUNDS.find((sound) => sound.id === DEFAULT_KEY_SOUND)!;
