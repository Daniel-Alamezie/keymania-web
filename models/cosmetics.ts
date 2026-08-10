/**
 * What a player wears, as the client sees it.
 *
 * Mirrors the API's lib/cosmetics.ts, and only the parts a browser needs: the
 * server resolves ids to values before sending, so nothing here has to know
 * that `badge.crown` means a crown. That asymmetry is deliberate — the
 * catalogue lives in one place, and a client a release behind renders whatever
 * it is given rather than looking up an id it has never heard of.
 */

/** Resolved for display: a label, a filename, a colour. Never ids. */
export interface PublicCosmetics {
  /** The title's label, ready to print. */
  title?: string;
  /** A filename under /badges. */
  badge?: string;
  /** What the badge is called, for the tooltip beside it. */
  badgeLabel?: string;
  /** A CSS colour. */
  nameColour?: string;
  /**
   * The number drawn beside the founder badge.
   *
   * Present only alongside that badge — a number on its own would be a fact
   * about somebody nobody asked for, and beside any other badge it would mean
   * nothing.
   */
  badgeNumber?: number;
  /**
   * The weeks this player has won, when the crown is what they are wearing.
   *
   * The list rather than a count, and the server sends one field rather than
   * two, because the length *is* the count: a row that wants "×3" takes
   * `.length` and a profile that wants to say which three reads the array.
   * Numbered as a player experiences them, so week one is the first week the
   * mode ever ran.
   */
  crownWeeks?: number[];
}

/**
 * One earned cosmetic on somebody's public card, resolved by the server.
 *
 * No hint, deliberately: a hint is an instruction for the owner about how to
 * earn things, not a fact about them for a visitor.
 */
export interface EarnedCosmetic {
  kind: 'title' | 'badge' | 'nameColour';
  label: string;
  value?: string;
  /** The founder's position, on that entry alone. */
  number?: number;
}

/**
 * What hovering a badge says.
 *
 * One function rather than a template repeated at each surface, because the
 * wording is a fact about the badge and the surfaces must agree on it. The
 * founder's number outranks the plain label — "Founder #7" says both what the
 * mark is and whose — and every other badge answers with its name, because a
 * mark that cannot say what it is only speaks to people who already know.
 */
export const badgeTooltip = (worn: PublicCosmetics | undefined): string | undefined => {
  if (worn?.badgeNumber !== undefined) return `Founder #${worn.badgeNumber}`;
  return championTooltip(worn?.crownWeeks) ?? worn?.badgeLabel;
};

/**
 * The same record, cut to the size a tooltip actually is.
 *
 * Every tip in the app is one nowrap line centred on a mark that is often
 * 18px wide near the left edge of a rail or a duel plate, and it stays legible
 * only because every tip so far has been about as long as "Founder #47" — 129
 * pixels, measured. The full sentence broke that on its first outing: centred
 * on a board row's badge, "Champion of weeks 1, 4, 9 and 12" ran off the left
 * of the screen, and even "Champion of week 3" measures 198.
 *
 * So the tip says what the mark is and how many, never which. "Champion ×4"
 * is 129 pixels to the character, the same ceiling the founder's tip has
 * always sat at, and the count on it matches the one drawn beside the mark.
 *
 * Which weeks is the profile's job. That is the surface with room for a panel
 * and the one somebody asking that question is heading to anyway.
 */
export function championTooltip(weeks: number[] | undefined): string | undefined {
  if (!weeks || weeks.length === 0) return undefined;
  /* No "×1": a first win is a win, not a tally of one. */
  return weeks.length === 1 ? 'Champion' : `Champion ×${weeks.length}`;
}

/**
 * A champion's record, in words.
 *
 * The long form: what the popover announces to a screen reader, and what a
 * single win says on hover. Pure, so the list formatting can be tested rather
 * than eyeballed. English needs three shapes here and the middle one is the
 * one that gets forgotten: "1", "1 and 4", "1, 4 and 9".
 *
 * Undefined when there is nothing to say, so a caller can fall back to the
 * badge's plain name without checking a length itself.
 */
export function championSummary(weeks: number[] | undefined): string | undefined {
  if (!weeks || weeks.length === 0) return undefined;

  const list = weeks.length === 1
    ? `week ${weeks[0]}`
    : `weeks ${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`;

  return `Champion of ${list}`;
}

/** One catalogue entry, as the customisation panel needs it. */
export interface Cosmetic {
  id: string;
  kind: 'title' | 'badge' | 'nameColour';
  label: string;
  /** How it is earned, shown against a locked entry so the grid teaches. */
  hint: string;
  value?: string;
}

/** Where the generator writes them. See keymania-web/scripts/badges.py. */
export const badgeSrc = (file: string) => `/badges/${file}`;

/**
 * The one badge that carries a number beside it.
 *
 * Mirrored from the API's lib/cosmetics.ts, and the single id this file knows
 * by name. Everywhere else the server resolves ids to values first, but the
 * appearance panel has to render its preview from an unsaved selection — the
 * server has not been told yet, so it cannot be the one to decide whether a
 * number belongs. The rendered surfaces still take a resolved
 * `PublicCosmetics` and never see this.
 */
export const FOUNDER_BADGE = 'badge.founder';

/**
 * The other badge this file knows by name, for the same reason.
 *
 * The appearance panel previews an unsaved selection, so the server has not
 * been told and cannot decide whether a crown should carry a count. Mirrored
 * from the API's lib/cosmetics.ts; every rendered surface still takes a
 * resolved `PublicCosmetics` and never sees this.
 */
export const CROWN_BADGE = 'badge.crown';

/**
 * Turn a set of chosen catalogue ids into what every rendering surface expects.
 *
 * The boards, the duel plates and the public card all take *values* — a
 * filename, a label, a CSS colour — because the server resolves ids before
 * sending them. Anywhere the client holds ids instead has to do the same
 * resolution, and this is that, once.
 *
 * There were two callers before this existed and there is now a third, which is
 * exactly when a private copy becomes a liability: the appearance preview
 * resolving a pending selection, and the friends leaderboard resolving the
 * viewer's own row. Two implementations of "what does this id look like" is two
 * places for the founder number rule below to be forgotten.
 */
export function resolveWorn(
  catalogue: Cosmetic[],
  chosen: { title?: string | null; badge?: string | null; nameColour?: string | null },
  founderNumber?: number,
  /**
   * The weeks this player has won, for previewing the crown.
   *
   * Passed in for the same reason `founderNumber` is: the panel is rendering
   * a selection nobody has saved, so it has to resolve what the server would
   * have sent. The caller derives it from the earned list.
   */
  crownWeeks?: number[],
): PublicCosmetics {
  const byId = (id: string | null | undefined) =>
    (id ? catalogue.find((c) => c.id === id) : undefined);

  return {
    title: byId(chosen.title)?.label,
    badge: byId(chosen.badge)?.value,
    badgeLabel: byId(chosen.badge)?.label,
    nameColour: byId(chosen.nameColour)?.value,
    /**
     * Only beside the founder badge. A number on its own is a fact about
     * somebody nobody asked for, and beside any other badge it means nothing.
     */
    badgeNumber: chosen.badge === FOUNDER_BADGE ? founderNumber : undefined,
    /* Same rule, the other badge that carries a history. */
    ...(chosen.badge === CROWN_BADGE && crownWeeks?.length ? { crownWeeks } : {}),
  };
}

/**
 * The three groups, in the order the panel shows them.
 *
 * Badges first because they are the most visible thing a player can change and
 * therefore the one they came to the panel for.
 */
export const COSMETIC_GROUPS = [
  { kind: 'badge', heading: 'Badge', blurb: 'Shown beside your name on the boards.' },
  { kind: 'title', heading: 'Title', blurb: 'Shown on your profile and to your opponent.' },
  { kind: 'nameColour', heading: 'Name colour', blurb: 'How your name reads on the boards.' },
] as const;
