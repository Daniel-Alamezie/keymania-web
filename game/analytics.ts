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
  /** They cared enough about the game to make it theirs. */
  | { name: 'character_saved'; character: string };

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
