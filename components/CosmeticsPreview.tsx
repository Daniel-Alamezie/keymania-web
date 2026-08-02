'use client';

import type { CharacterId } from '@/models/character';
import type { BoardEntry } from '@/models/leaderboard';
import type { PublicCosmetics } from '@/models/cosmetics';
import BoardRows from './BoardRows';
import HealthBar from './HealthBar';
import styles from './CosmeticsPreview.module.css';

/**
 * What everybody else sees.
 *
 * A badge is worth exactly its visibility, and until this existed a player
 * choosing one could see it only as a 24px thumbnail on the tile they clicked
 * — never in either of the two places it actually appears, and never at the
 * size it appears there. Choosing between two badges meant equipping one,
 * leaving the panel, finding a board, and doing it again for the other.
 *
 * Two rules decided how this is built:
 *
 *  - **The real components, never a mock-up.** `BoardRows` and `HealthBar` are
 *    the same ones the leaderboard and the arena use, given a made-up row and
 *    a made-up plate. A hand-built imitation would be accurate on the day it
 *    was written and wrong the first time a badge changed size — and a preview
 *    that lies is worse than no preview, because it is trusted.
 *  - **It shows the choice, not the save.** Everything here renders from the
 *    panel's pending selection, so the answer to "what will this look like"
 *    arrives before the decision to keep it rather than after.
 */
export default function CosmeticsPreview({ name, character, rating, cosmetics }: {
  name: string;
  character: CharacterId;
  /** Absent for a player with no ranked duels yet; the plate omits it. */
  rating?: number;
  /** The pending selection, already resolved to labels, files and colours. */
  cosmetics: PublicCosmetics;
}) {
  /**
   * A board of three, with the player in the middle.
   *
   * One row alone shows the badge but not the thing worth checking, which is
   * whether it reads against the rows either side of it — the question a
   * player is actually asking when they pick between a crown and a star. The
   * neighbours are deliberately plain: they are scenery, and giving them
   * cosmetics of their own would make the row being judged harder to find.
   *
   * Positions well down the board so nobody reads it as a claim about where
   * they stand, and the figures are rounded stand-ins for the same reason.
   */
  const rows: BoardEntry[] = [
    { position: 7, name: 'Rowan', wpm: 79, accuracy: 97, rating: 312 },
    { position: 8, name, wpm: 76, accuracy: 96, rating: rating ?? 300, cosmetics },
    { position: 9, name: 'Wren', wpm: 74, accuracy: 95, rating: 291 },
  ];

  return (
    <section className={styles.preview} aria-label="How you look to everyone else">
      <h3 className={`${styles.heading} pixel-font`}>How others see you</h3>

      <div className={styles.surfaces}>
        <div className={styles.surface}>
          <p className={styles.where}>On the leaderboard</p>
          {/* As a stranger: no "your row" tint and no link, neither of which
              anybody but the player themselves would ever get. */}
          <BoardRows entries={rows} board="standings" asStranger />
        </div>

        <div className={styles.surface}>
          <p className={styles.where}>In a duel</p>
          <div className={styles.plate}>
            <HealthBar
              name={name}
              value={72}
              team="blue"
              align="left"
              character={character}
              rating={rating}
              cosmetics={cosmetics}
            />
          </div>
          {/* Said plainly, because the panel offers a name colour and this is
              the one surface that ignores it. Without the note it reads as the
              preview being broken. */}
          <p className={styles.note}>
            Plates keep their team colours, so a name colour does not show here.
          </p>
        </div>
      </div>
    </section>
  );
}
