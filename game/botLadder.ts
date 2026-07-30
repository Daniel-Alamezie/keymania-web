import { BOT_PROFILES } from './constants';
import { DIFFICULTIES, type Difficulty } from '@/models/bot';

/**
 * Which bots a player has opened up, and which one to point them at.
 *
 * **Unlocked by your own speed, not by beating the bot below.** "Beat the
 * Master" is the obvious rule and it does not survive contact with the record:
 * history is capped at thirty duels per kind, so the win that opened your ladder
 * gets evicted and the ladder silently closes again, and there is no
 * per-difficulty win tally to fall back on. `bestWpm` is a maximum that is never
 * evicted, so the ladder derives from it retroactively for everybody who already
 * qualifies, exactly as the challenges do.
 *
 * It is also the better rule. You earn the next opponent by typing at their
 * speed, not by beating one that happened to fumble twice.
 *
 * **Not enforced by the server, on purpose.** Bot duels are unranked and can
 * never touch the leaderboard or a rating, so a forged unlock wins nothing at
 * all: it buys the right to be beaten by a faster bot. Enforcing it would mean
 * paying for a round trip to protect a prize that does not exist.
 */

/** The speed you have to have reached yourself to open each tier. */
export const BOT_UNLOCK_WPM: Record<Difficulty, number> = {
  rookie: 0,
  rival: 0,
  master: 0,
  champion: 80,
  virtuoso: 100,
  apex: 120,
};

/**
 * Your best speed, wherever you earned it.
 *
 * Practice counts. The profile keeps ranked and practice apart because only one
 * of them can be believed well enough to rank, but the ladder is not a ranking
 * and a hundred words a minute is a hundred words a minute whoever you were
 * typing against. Gating it on ranked speed alone would also mean a signed-out
 * player could never open a single tier.
 */
export const bestSpeed = (ranked: number, practice: number): number =>
  Math.max(ranked || 0, practice || 0);

export const isBotUnlocked = (id: Difficulty, bestWpm: number): boolean =>
  bestWpm >= BOT_UNLOCK_WPM[id];

export const unlockedBots = (bestWpm: number): Difficulty[] =>
  DIFFICULTIES.filter((id) => isBotUnlocked(id, bestWpm));

/**
 * How much faster you have to get before the next tier opens.
 *
 * Null once everything is open. Shown on a locked tier so it reads as a target
 * rather than as a closed door: "12 wpm away" is an invitation, a padlock is
 * not.
 */
export function nextUnlock(bestWpm: number): { id: Difficulty; wpmAway: number } | null {
  const locked = DIFFICULTIES.find((id) => !isBotUnlocked(id, bestWpm));
  if (!locked) return null;
  return { id: locked, wpmAway: BOT_UNLOCK_WPM[locked] - bestWpm };
}

/**
 * The bot worth suggesting, which is the hardest one that is not out of reach.
 *
 * A new arrival from a typing subreddit types a hundred words a minute and is
 * currently shown a 34wpm Rookie as the front door, which they beat without
 * noticing anything happened. Pointing at the tier nearest their own speed turns
 * a list they have to guess their way through into a suggestion.
 *
 * Falls back to the easiest bot for somebody with no record at all, because a
 * first-timer with no speed to compare against is exactly who Rookie is for.
 */
export function suggestedBot(bestWpm: number): Difficulty {
  const open = unlockedBots(bestWpm);
  /**
   * The gentlest step up: the first bot on the ladder that is at least as fast
   * as you are.
   *
   * Searched from the easy end deliberately. Taking the *hardest* one you can
   * still technically beat sounds like the same idea and is not: it handed a
   * brand new player the Master, because at zero words a minute every bot in the
   * game is faster than they are. A suggestion should be the next rung, not the
   * top of what is unlocked.
   */
  const stretch = open.find((id) => BOT_PROFILES[id].wpm >= bestWpm);
  // Nobody left who is faster than you, so the hardest there is.
  return stretch ?? open[open.length - 1] ?? DIFFICULTIES[0];
}
