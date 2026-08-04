import { countryName } from '@/models/countries';
import styles from './CountryChip.module.css';

/**
 * Where somebody is from, as two letters beside their name.
 *
 * **Its own element, never the badge slot.** A player wears one badge, and that
 * slot already holds founder marks, crowns and streak flames that were earned.
 * Putting a country in it would make a founder choose between their number and
 * their flag, which quietly devalues every badge in the game to add one that
 * was not won. The reference this was drawn from does the same thing — the flag
 * sits next to the name, separate from everything else on the card.
 *
 * **Two letters rather than a flag**, decided by two independent facts:
 *
 *   * Windows ships no regional-indicator glyphs, so an emoji flag renders as
 *     the letters anyway for a large share of players. Better to choose that
 *     than to discover it.
 *   * A board row is eighteen pixels tall, and most flags at that size are
 *     indistinguishable smudges.
 *
 * The full name lives in the tooltip, on the app-wide `data-tip` attribute the
 * badges already use — so the mechanism, the styling and the placement rules
 * are shared rather than reinvented for a second kind of ornament.
 */
export default function CountryChip({ code, className }: {
  code: string | undefined;
  className?: string;
}) {
  // Most players have not set one, and a placeholder would be worse than a gap:
  // an empty chip on every second row is a column of nothing pretending to be
  // information.
  if (!code) return null;

  return (
    <span
      className={`${styles.chip} ${className ?? ''} pixel-font`}
      data-tip={countryName(code)}
      /**
       * The code is decoration for a reader who can see it; the name is the
       * fact. A screen reader gets the name and skips the abbreviation, which
       * would otherwise be announced letter by letter.
       */
      aria-label={countryName(code)}
    >
      <span aria-hidden="true">{code}</span>
    </span>
  );
}
