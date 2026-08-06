'use client';

import posthog from 'posthog-js';
import type { Difficulty } from '@/models/bot';

/**
 * What the game reports about itself.
 *
 * Deliberately a short, closed list. Analytics rots by accretion: somebody adds
 * an event for a question they had once, nobody removes it, and a year later
 * nothing in the dashboard is trustworthy because half of it measures things
 * that have since changed meaning. Every event here answers a question worth
 * *acting* on before a launch — and if one stops earning its place, delete it.
 *
 * The union is the point. Stringly-typed `capture('duel_startd', …)` is a typo
 * that silently produces a second event nobody notices for a month; this makes
 * it a compile error.
 */
export type GameEvent =
  /** Somebody committed to a duel. The denominator for everything else. */
  | { name: 'duel_started'; mode: 'bot' | 'human'; difficulty: Difficulty; touch: boolean }
  /**
   * They played it to the end. Carries the figures that say whether it was any
   * good — a duel finished at 20wpm and 60% accuracy is a different signal from
   * one finished at 70 and 97.
   */
  | {
      name: 'duel_finished';
      mode: 'bot' | 'human';
      won: boolean;
      wpm: number;
      accuracy: number;
      seconds: number;
    }
  /**
   * They left mid-duel. The strongest negative signal the game produces: it
   * means the thing was not worth finishing, and `at_word` says how long that
   * took to become obvious.
   */
  | { name: 'duel_abandoned'; mode: 'bot' | 'human'; at_word: number }
  /** They chose to go again. The strongest positive signal, for the same reason. */
  | { name: 'rematch_taken'; mode: 'bot' | 'human' }
  /** They needed the instructions, and how far they read. */
  | { name: 'guide_opened' }
  /** The subreddit link on the menu, so we can see whether it is found. */
  | { name: 'community_opened' }
  /** They cared enough about the game to make it theirs. */
  | { name: 'character_saved'; character: string }
  /**
   * The four below exist to answer one question: **where do the visitors go?**
   *
   * A launch put 121 people on the page and 15 of them into a ranked duel, and
   * nothing recorded a single step in between. Every explanation for that gap
   * was equally consistent with the data, and they have opposite fixes — if
   * nobody presses the sign-in button, the wall is in the wrong place; if they
   * press it and never come back, the wall is fine and the round trip is broken;
   * if they come back and abandon the queue, neither is the problem and matching
   * is. Guessing wrong costs a week building the wrong thing.
   *
   * So each of these is one edge of that funnel, and they only earn their place
   * together. Individually they are trivia.
   */
  /**
   * They pressed a sign-in button. `from` is which wall they hit, because the
   * game has five and they are not equally important.
   */
  | { name: 'signin_started'; from: SignInSource }
  /**
   * They came back with a session. The other half of the round trip.
   *
   * Without this, "never clicked sign in" and "clicked it and was lost at the
   * identity provider" are the same shape in the data, and they are the two most
   * different problems on the list.
   */
  | { name: 'signin_returned'; from: SignInSource; seconds: number }
  /**
   * They asked for a duel. Note this is not `duel_started`, which fires when one
   * actually begins — the gap between the two is the queue, and until now the
   * queue was invisible.
   */
  | { name: 'quick_play_started' }
  /**
   * They left the queue without getting a duel, and why.
   *
   * `session_expired` is the one worth watching: it is a player who did
   * everything right, pressed the button, and was told to sign in again. That
   * failure is invisible from the outside and looks like a broken game from the
   * inside.
   */
  | { name: 'queue_left'; seconds: number; reason: 'cancelled' | 'session_expired' }
  /**
   * A message handler threw while processing a server message.
   *
   * Diagnostics rather than product analytics, and it earns its place in this
   * closed union the same way everything else does: it answers a question
   * worth acting on. A crashing handler is a frozen duel on a live socket —
   * no damage renders, typing still sends, and without this event the only
   * evidence is a player's screenshot. Two of those arrived before it existed.
   */
  /* ---------------------------------------------------------------- learn
   *
   * The path exists to answer one question -- does an on-ramp keep the
   * players who currently bounce off ranked duels -- and it cannot be
   * answered by whether anybody clicked Learn. It is answered by where they
   * stop. So these are shaped as a funnel with the drop-out points named,
   * not as a scatter of clicks:
   *
   *   learn_opened -> learn_tutorial (started/finished) -> learn_lesson
   *   (started/finished) -> learn_boss (won/lost) -> learn_module_completed
   *
   * Every one carries the module, because "people give up" is not actionable
   * and "people give up on numbers" is. `signed_in` rides along on the
   * entry points: a guest walking the path is the population this was built
   * for, and their behaviour is the whole hypothesis.
   */
  | { name: 'learn_opened'; signed_in: boolean; modules_passed: number }
  | { name: 'learn_tutorial'; step: 'started' | 'finished' | 'skipped' }
  | {
      name: 'learn_lesson';
      module: string;
      /** Index within the module, so a drop-out has a position. */
      lesson: number;
      step: 'started' | 'finished';
      /** Only on finish. Rounded: this is a distribution, not a score. */
      accuracy?: number;
    }
  /**
   * The gate, and the most important number here. If people pile up against
   * 95% and stop, the gate is wrong; if they clear it in a retry or two, it
   * is doing its job. Nothing else tells us which.
   */
  | { name: 'learn_boss_blocked'; module: string; accuracy: number }
  | {
      name: 'learn_boss';
      module: string;
      result: 'won' | 'lost' | 'left';
      /** The player's speed, against the module's calibrated boss pace. */
      wpm: number;
      boss_wpm: number;
    }
  | { name: 'learn_module_completed'; module: string; stars: number; granted: number }
  /**
   * The warm-up, which is the one mode with no result to report.
   *
   * Nothing here is a score, and none of it may be read as one — there is
   * deliberately no wpm, because a figure earned with no clock and no opponent
   * is not comparable to one earned under both, and publishing it would invite
   * exactly that comparison. What these answer is narrower and more useful:
   * whether a mode with nothing at stake is somewhere people actually spend
   * time, and whether the streak is a thing they chase.
   *
   * A session with `words` near zero is somebody who opened it and left, which
   * is a different failure from one who typed for four minutes and never got
   * past a streak of three.
   */
  | { name: 'warmup_started' }
  | { name: 'warmup_finished'; words: number; best_streak: number; accuracy: number }
  | { name: 'handler_crashed'; messageType: string; error: string };

/**
 * Which sign-in wall somebody hit.
 *
 * A closed union rather than a free string, and required rather than optional,
 * so a new sign-in button cannot be added without saying where it is. The
 * alternative is the failure this file already warns about: analytics that has
 * to be remembered at every call site is analytics that ends up half-wired.
 */
export type SignInSource =
  /** The primary button on the menu. The one that matters most. */
  | 'play'
  /** The survival panel. */
  | 'survival'
  | 'weekly'
  /** The small link in the corner, pressed by somebody who went looking. */
  | 'account_bar'
  /**
   * The same corner on a phone, where the bar folds into one key.
   *
   * Its own value rather than sharing `account_bar`, because the two are
   * different offers: the desktop bar shows Sign in beside a full row of
   * controls, and this one is the only thing in the corner at all. If the
   * phone layout converts worse, that is worth being able to see rather than
   * having it averaged into the desktop figure.
   */
  | 'menu_key'
  /**
   * The feedback box, opened by somebody signed out.
   *
   * Worth its own value rather than folding into the others: this is a player
   * who had something to say and met an account requirement on the way to
   * saying it. If they drop here, the requirement is costing reports.
   */
  | 'feedback'
  | 'profile'
  | 'public_profile';

// `challenge_earned` is deliberately absent. Noticing one *complete* means
// diffing the challenge list across two profile loads, which is the unlock
// moment that has not been built yet — and an event in this union that nothing
// emits is a promise the dashboard does not keep.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let started = false;

/**
 * Start PostHog, if there is anything to start it with.
 *
 * No key means every function here is a no-op — so a fork, a preview branch, or
 * anybody running this locally reports nothing at all, without a single `if` at
 * a call site. That is deliberate: analytics that has to be remembered at every
 * call site is analytics that ends up half-wired.
 */
export function startAnalytics(): void {
  if (started || !KEY || typeof window === 'undefined') return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,

    /**
     * Anonymous visitors do not get a stored person.
     *
     * The costly default is `always`, which creates a person profile for every
     * visitor who ever loads the page — on a Reddit launch that is thousands of
     * profiles for people who bounced in four seconds. `identified_only` still
     * records their *events*, so funnels and bounce rates are unaffected; it
     * only skips building a durable person for somebody who never signed in.
     */
    person_profiles: 'identified_only',

    /**
     * Replays, masked by default.
     *
     * Worth having for a launch — a replay shows why somebody left in a way no
     * event can. But this game puts other people's names on screen, so those
     * are masked while the game itself stays watchable.
     */
    session_recording: {
      /**
       * Inputs always, and named surfaces on top.
       *
       * Masking *all* text was the first instinct and the wrong trade: a replay
       * of a typing game with the words blanked out shows nothing worth
       * watching, which defeats the reason for having replays at a launch.
       * Inputs are masked by default — that covers the name and handle fields —
       * and anything else carrying another person's data is marked
       * `ph-no-capture` in the markup, which is currently the friends list.
       */
      maskAllInputs: true,
      maskTextSelector: '.ph-no-capture',
    },

    // Page views are sent by hand from the provider, because the App Router
    // changes route without a reload and the automatic version misses it.
    capture_pageview: false,
  });
}

/** Record something the player did. Silent when analytics is not configured. */
export function track({ name, ...properties }: GameEvent): void {
  if (!started) return;
  posthog.capture(name, properties);
}

/**
 * Whether this browser has an account, stamped on every event from here on.
 *
 * A super property rather than a field on each event, and rather than a
 * `menu_viewed` event invented to carry it. The question is not "did they see
 * the menu" — the page *is* the menu — it is "which of these numbers are about
 * people who cannot play a ranked duel yet", and that applies to `$pageview`
 * just as much as to anything the game sends. Registering it once answers that
 * for events that already exist and for every event added later.
 *
 * Only called once the session is resolved. The account hook returns an
 * optimistic guess from localStorage before Kinde answers, and stamping a guess
 * onto events would quietly mislabel the very population being counted.
 */
export function setSignedIn(signedIn: boolean): void {
  if (!started) return;
  posthog.register({ signed_in: signedIn });
}

/**
 * Tie events to an account, by opaque id only.
 *
 * The Kinde `sub` and nothing else — no email, no display name, no handle.
 * Following one player across two devices is a fair question to ask of
 * analytics; keeping a copy of who they are in a third-party tool that does
 * not need it is not, and this service already holds the minimum it can.
 */
export function identify(userId: string): void {
  if (!started) return;
  posthog.identify(userId);
}

/** Forget them on sign-out, so the next person on this browser is not them. */
export function resetIdentity(): void {
  if (!started) return;
  posthog.reset();
}

export function trackPageView(url: string): void {
  if (!started) return;
  posthog.capture('$pageview', { $current_url: url });
}
