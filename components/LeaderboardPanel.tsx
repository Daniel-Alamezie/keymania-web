'use client';

import { useProfile } from '@/game/profile';
import styles from './SidePanel.module.css';

/**
 * Standings.
 *
 * Ranked on sustained speed rather than the fastest single word: one quick
 * short word is mostly luck, whereas speed held across a whole duel is skill.
 * Because a wrong key never advances the cursor, mistakes already cost time —
 * so this figure reflects accuracy without needing a separate penalty.
 *
 * Currently seeded from this browser's own results. The panel is deliberately
 * shaped around a ranked list so a server-backed global board can replace the
 * source without the UI changing.
 */
export default function LeaderboardPanel() {
  const profile = useProfile();

  const entries = [...profile.recent]
    .sort((a, b) => b.wpm - a.wpm)
    .slice(0, 6)
    .map((duel, index) => ({
      position: index + 1,
      name: profile.name || 'You',
      wpm: duel.wpm,
      accuracy: duel.accuracy,
      mine: true,
    }));

  return (
    <aside className={`panel ${styles.side}`}>
      <h2 className={`${styles.heading} pixel-font`}>Fastest duels</h2>

      {entries.length === 0 ? (
        <p className={styles.empty}>
          Nothing ranked yet. Finish a duel and your best runs land here.
        </p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li
              key={`${entry.position}-${entry.wpm}`}
              className={styles.rank}
              data-me={entry.mine || undefined}
              data-top={entry.position === 1 || undefined}
            >
              <span className={`${styles.rankPos} pixel-font`}>{entry.position}</span>
              <span className={styles.rankName}>{entry.name}</span>
              <span className={styles.rankSub}>{entry.accuracy}%</span>
              <span className={`${styles.rankScore} pixel-font`}>{entry.wpm}</span>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.footnote}>
        Ranked on sustained speed across a whole duel.
      </p>
    </aside>
  );
}
