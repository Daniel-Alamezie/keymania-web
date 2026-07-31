'use client';

import { useEffect } from 'react';

/**
 * How long a panel ignores the spacebar after it appears.
 *
 * **The single most important number in this file.** Space is the key this game
 * is played with — it commits every word — so at the instant a duel or a run
 * ends, the player's hands are on it and quite possibly still moving. A result
 * screen that accepted space immediately would restart the game out of a
 * keystroke aimed at the word that just killed them, and they would never see
 * the result they were trying to read.
 *
 * Long enough to outlast a trailing keypress and short enough that nobody
 * deliberately reaching for the button notices it is there.
 */
export const CONFIRM_ARM_MS = 500;

/**
 * What the spacebar means in a duel, given what is on screen.
 *
 * A pure function rather than a condition buried in the component, because the
 * rule that matters most cannot be tested any other way here — this repo has no
 * DOM test setup, so a hook cannot be exercised, but the decision it depends on
 * can.
 *
 * That rule is `null` while a duel is being played. Space is how a word is
 * thrown; a shortcut that took it mid-duel would not be a small annoyance, it
 * would make the game unplayable. Everything else on this list is a
 * convenience, and that one is a safety property.
 */
export type ConfirmTarget = 'start' | 'rematch' | 'playAgain' | 'dismiss' | null;

export function confirmTarget(view: {
  phase: string;
  isMulti: boolean;
  /** The forfeit confirmation, which opens on top of a live duel. */
  confirmQuit: boolean;
  /** A rematch has been requested and the room has not answered. */
  asked: boolean;
}): ConfirmTarget {
  // Answered first, because it sits above whatever it interrupted. The duel's
  // own key handler already ignores everything while this is open, so there is
  // no chance of a space both dismissing it and throwing a word.
  if (view.confirmQuit) return 'dismiss';
  if (view.phase === 'idle') return view.isMulti ? null : 'start';
  if (view.phase === 'over') {
    if (!view.isMulti) return 'rematch';
    // Already asked: the button is disabled and so is the key. A second request
    // into the same wait achieves nothing.
    return view.asked ? null : 'playAgain';
  }
  // Playing, counting down, finishing. Nothing to confirm, and during play the
  // key belongs to the game.
  return null;
}

/**
 * Space confirms whatever a panel is offering.
 *
 * The game is already played entirely with one hand on the spacebar, so asking a
 * player to leave the keyboard, find a button and come back is a worse ending
 * to every duel than it needs to be. This makes the primary action of a panel —
 * Fight Rookie, Rematch, Play again, Go again — reachable without moving.
 *
 * Deliberately a global listener rather than autofocusing the button. Focus is
 * lost the moment anybody clicks anywhere, and a shortcut that stops working
 * because you clicked the background is worse than no shortcut: it teaches the
 * key does not work and then it does.
 *
 * Enter works too, because a dialog that takes space and refuses enter is
 * surprising in the other direction.
 */
export function useConfirmKey(onConfirm: (() => void) | null | undefined): void {
  useEffect(() => {
    if (!onConfirm) return;

    let armed = false;
    const arm = setTimeout(() => { armed = true; }, CONFIRM_ARM_MS);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') return;
      // A shortcut, not a chord. Ctrl+Space and friends belong to the browser.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // A held key would fire this dozens of times.
      if (event.repeat) return;
      if (!armed) {
        // Still swallowed while disarmed, or the page scrolls under a dialog
        // that is deliberately ignoring the key.
        event.preventDefault();
        return;
      }

      /**
       * Anything already focusable handles its own keys.
       *
       * A focused button fires on space natively, so acting here as well would
       * run the action twice — starting two duels, or sending two rematch
       * requests. Leaving it to the browser also means whatever the player
       * tabbed to is what activates, which is the behaviour they asked for by
       * tabbing to it.
       */
      const active = document.activeElement;
      if (
        active instanceof HTMLButtonElement
        || active instanceof HTMLAnchorElement
        || active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || (active instanceof HTMLElement && active.isContentEditable)
      ) return;

      // Space scrolls a page by default, which is exactly the wrong thing to do
      // underneath a dialog somebody is answering.
      event.preventDefault();
      onConfirm();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arm);
      window.removeEventListener('keydown', onKey);
    };
  }, [onConfirm]);
}
