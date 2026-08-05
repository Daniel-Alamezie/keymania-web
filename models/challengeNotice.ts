import { characterById } from './character';
import type { Cosmetic } from './cosmetics';
import type { ChallengeProgress } from './profile';

/**
 * The words the "new challenges" toast says.
 *
 * Pure and separate from the component because this is *copy*, and copy is the
 * part of a notification that decides whether it works. The first version read
 * "A new challenge is in" over a bare "Keep a 5-day streak", which players
 * reported as confusing, and they were right on three counts: "is in" is
 * newsroom shorthand rather than English, neither line was a sentence, and
 * nothing anywhere said what completing it would get them. A notice that
 * announces an obligation without naming the reward is asking for a favour.
 *
 * Being a function rather than JSX also means the sentences can be tested,
 * which matters more than usual here: the plural and the possessive are the
 * kind of thing that reads fine for the case you had in mind and breaks for
 * the one you did not.
 */

/**
 * The headline. A complete sentence, with a full stop, in the plain past.
 *
 * "Have arrived" rather than "are in" or "added": it is what a person would
 * actually say, and it puts the event in the past, which is what makes it a
 * piece of news rather than an instruction.
 */
export function noticeHeading(count: number): string {
  return count === 1
    ? 'A new challenge has arrived.'
    : `${count} new challenges have arrived.`;
}

/**
 * What that challenge asks, and what it pays.
 *
 * The titles are already imperative — "Keep a 5-day streak", "Win three duels
 * against people" — so they read as the start of a sentence with no rewriting:
 * "<title> to unlock <reward>." The reward is the half that was missing, and
 * the half that answers "why would I?".
 *
 * Falls back to the ask alone when the reward cannot be resolved, which is a
 * real case rather than a defensive one: the catalogue arrives with the
 * profile, so a toast rendered from a cached record a release out of date can
 * hold an id this build has no entry for. Better a shorter true sentence than
 * "to unlock undefined".
 */
export function noticeLine(
  challenge: ChallengeProgress | undefined,
  catalogue: Cosmetic[] | undefined,
): string | null {
  if (!challenge) return null;

  const reward = rewardName(challenge, catalogue);
  return reward ? `${challenge.title} to unlock ${reward}.` : `${challenge.title}.`;
}

/**
 * What a challenge pays, by name.
 *
 * Characters resolve locally because the roster ships with the client;
 * cosmetics have to come from the catalogue on the profile, which is the one
 * place that knows what an id means. Same seam the prize box reads.
 */
function rewardName(
  challenge: ChallengeProgress,
  catalogue: Cosmetic[] | undefined,
): string | null {
  // Destructured so the union narrows: through `challenge.reward.…` the
  // compiler treats each access as potentially a different value.
  const { reward } = challenge;
  if (reward.kind === 'character') return characterById(reward.character).name;
  return catalogue?.find((c) => c.id === reward.cosmetic)?.label ?? null;
}
