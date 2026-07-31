import { describe, expect, it } from 'vitest';
import { CONFIRM_ARM_MS, confirmTarget } from '../useConfirmKey';

/**
 * What the spacebar means, given what is on screen.
 *
 * The game is played with a hand on the spacebar, so making it confirm a panel
 * saves a trip to the mouse after every duel. That same fact is what makes the
 * shortcut dangerous, and the rules below are mostly about the danger rather
 * than the convenience.
 *
 * The hook itself cannot be tested here — this repo has no DOM setup — so the
 * decision it acts on is a pure function precisely so the parts that matter are
 * not untestable by construction.
 */

const view = (over: Partial<Parameters<typeof confirmTarget>[0]> = {}) => ({
  phase: 'playing', isMulti: false, confirmQuit: false, asked: false, ...over,
});

describe('confirmTarget', () => {
  /**
   * The rule everything else is subordinate to.
   *
   * Space is how a word is thrown. A shortcut that took it mid-duel would not
   * be an annoyance, it would make the game unplayable — every word committed
   * would also press whatever button happened to be behind the arena.
   */
  it('does nothing at all while a duel is being played', () => {
    expect(confirmTarget(view({ phase: 'playing' }))).toBeNull();
    expect(confirmTarget(view({ phase: 'countdown' }))).toBeNull();
    expect(confirmTarget(view({ phase: 'finishing' }))).toBeNull();
  });

  it('starts a bot duel from the ready panel', () => {
    expect(confirmTarget(view({ phase: 'idle' }))).toBe('start');
  });

  /**
   * A human duel has no ready panel — the server decides when it begins — so
   * there is nothing for the key to start.
   */
  it('has nothing to start in a human duel', () => {
    expect(confirmTarget(view({ phase: 'idle', isMulti: true }))).toBeNull();
  });

  it('goes again from a finished bot duel', () => {
    expect(confirmTarget(view({ phase: 'over' }))).toBe('rematch');
  });

  it('asks for a rematch from a finished human duel', () => {
    expect(confirmTarget(view({ phase: 'over', isMulti: true }))).toBe('playAgain');
  });

  /**
   * Against people, again is a request rather than a decision. Once it has been
   * sent the button is disabled, and the key has to be too — otherwise leaning
   * on the spacebar while waiting sends a request per press.
   */
  it('stops asking once a rematch has been requested', () => {
    expect(confirmTarget(view({ phase: 'over', isMulti: true, asked: true }))).toBeNull();
  });

  /**
   * The forfeit confirmation opens on top of a live duel, so it is the one
   * panel that appears while `phase` still says playing. It has to be answered
   * first, or the key would fall through to "nothing to confirm" and the dialog
   * would be unanswerable by keyboard.
   */
  it('answers the forfeit dialog before the duel underneath it', () => {
    expect(confirmTarget(view({ phase: 'playing', confirmQuit: true }))).toBe('dismiss');
    expect(confirmTarget(view({ phase: 'over', confirmQuit: true }))).toBe('dismiss');
  });
});

describe('the arming delay', () => {
  /**
   * The most important number in the feature.
   *
   * A result screen appears at the exact moment a player's hand is on the
   * spacebar — in a duel because they just threw a word, in survival because
   * the space that committed their last word is what ended the run. Accepting
   * the key immediately would restart the game out of a keystroke aimed at
   * something else, and the player would never see the result they were reading.
   */
  it('is long enough to outlast a trailing keystroke', () => {
    expect(CONFIRM_ARM_MS).toBeGreaterThanOrEqual(300);
  });

  /** And short enough that somebody reaching for it deliberately never waits. */
  it('is short enough not to feel like a dead key', () => {
    expect(CONFIRM_ARM_MS).toBeLessThanOrEqual(800);
  });
});
