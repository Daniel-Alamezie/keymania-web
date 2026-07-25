'use client';

import { useProfile, winRate } from '@/game/profile';
import styles from './SidePanel.module.css';

/**
 * The player's own history.
 *
 * Shown beside the menu so the wide empty arena carries something worth
 * reading, and so there is a visible reason to play another duel.
 */
export default function RecordPanel() {
  const profile = useProfile();
  const played = profile.duels > 0;

  return (
    <aside className={`panel ${styles.side}`}>
      <h2 className={`${styles.heading} pixel-font`}>Your record</h2>

      {!played ? (
        <p className={styles.empty}>
          No duels yet. Your best speed, accuracy and streak will appear here.
        </p>
      ) : (
        <>
          <dl className={styles.stats}>
            <Stat label="Best speed" value={`${profile.bestWpm}`} unit="wpm" highlight />
            <Stat label="Best accuracy" value={`${profile.bestAccuracy}`} unit="%" />
            <Stat label="Best combo" value={`x${profile.bestCombo}`} />
            <Stat label="Win rate" value={`${winRate(profile)}`} unit="%" />
          </dl>

          <div className={styles.tally}>
            <span className={styles.tallyWins}>{profile.wins}W</span>
            <span className={styles.tallyDash}>—</span>
            <span className={styles.tallyLosses}>{profile.duels - profile.wins}L</span>
          </div>

          <h3 className="eyebrow">Recent duels</h3>
          <ul className={styles.list}>
            {profile.recent.map((duel) => (
              <li key={duel.at} className={styles.row} data-won={duel.won || undefined}>
                <span className={styles.rowBadge}>{duel.won ? 'W' : 'L'}</span>
                <span className={styles.rowMain}>{duel.wpm} wpm</span>
                <span className={styles.rowSub}>{duel.accuracy}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function Stat({ label, value, unit, highlight }: {
  label: string; value: string; unit?: string; highlight?: boolean;
}) {
  return (
    <div className={styles.stat} data-highlight={highlight || undefined}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>
        {value}{unit && <small className={styles.unit}>{unit}</small>}
      </dd>
    </div>
  );
}
