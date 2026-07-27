'use client';

import { useProfile } from '@/game/profile';
import { useServerProfile, winRate } from '@/game/serverProfile';
import type { DuelResult, Tally } from '@/models/profile';
import styles from './SidePanel.module.css';

/**
 * The player's own history, beside the menu.
 *
 * Reads the account record when signed in and this browser's own only when not.
 *
 * It used to always read localStorage, which quietly showed a different, older,
 * *blended* dataset under the same labels as the dashboard — one panel saying
 * "best speed 64" while the other said 65, and a win rate that mixed bot
 * practice into the figure the board is meant to reflect. Two sources, one set
 * of words, no way for a player to know which they were looking at.
 */
export default function RecordPanel() {
  const local = useProfile();
  const { profile, anonymous } = useServerProfile();

  // The account record wins whenever there is one. `anonymous` is the explicit
  // signed-out signal; a null profile that is merely still loading falls
  // through to the local copy rather than flashing an empty panel.
  const useLocal = anonymous || !profile;

  if (useLocal) {
    return (
      <Shell note={anonymous ? 'This device only. Sign in to keep it.' : undefined}>
        {local.duels === 0 ? (
          <Empty />
        ) : (
          <Body
            tally={{
              duels: local.duels,
              wins: local.wins,
              bestWpm: local.bestWpm,
              bestAccuracy: local.bestAccuracy,
              bestCombo: local.bestCombo,
            }}
            recent={local.recent.map((duel) => ({ ...duel, ranked: false }))}
          />
        )}
      </Shell>
    );
  }

  // Ranked leads because it is the record that reaches the board. Practice is
  // shown instead only until there is a ranked duel to show — an empty panel
  // would be a worse first impression than an honest one about bots.
  const ranked = profile.ranked;
  const showing: 'ranked' | 'practice' = ranked.duels > 0 ? 'ranked' : 'practice';
  const tally = showing === 'ranked' ? ranked : profile.practice;

  return (
    <Shell
      note={
        showing === 'ranked'
          ? 'Duels against humans. Practice is kept separately.'
          : 'Bot practice. Duel a human and your ranked record starts here.'
      }
    >
      {tally.duels === 0 ? <Empty /> : <Body tally={tally} recent={profile.history.slice(0, 5)} />}
    </Shell>
  );
}

function Shell({ note, children }: { note?: string; children: React.ReactNode }) {
  return (
    <aside className={`panel ${styles.side}`}>
      <h2 className={`${styles.heading} pixel-font`}>Your record</h2>
      {note && <p className={styles.footnote}>{note}</p>}
      {children}
    </aside>
  );
}

const Empty = () => (
  <p className={styles.empty}>
    No duels yet. Your best speed, accuracy and streak will appear here.
  </p>
);

function Body({ tally, recent }: { tally: Tally; recent: DuelResult[] }) {
  const rate = winRate(tally);

  return (
    <>
      <dl className={styles.stats}>
        <Stat label="Best speed" value={`${tally.bestWpm}`} unit="wpm" highlight />
        <Stat label="Best accuracy" value={`${tally.bestAccuracy}`} unit="%" />
        <Stat label="Best combo" value={`x${tally.bestCombo}`} />
        <Stat label="Win rate" value={rate === null ? '—' : `${rate}`} unit={rate === null ? undefined : '%'} />
      </dl>

      <div className={styles.tally}>
        <span className={styles.tallyWins}>{tally.wins}W</span>
        <span className={styles.tallyDash}>—</span>
        <span className={styles.tallyLosses}>{tally.duels - tally.wins}L</span>
      </div>

      <h3 className="eyebrow">Recent duels</h3>
      <ul className={styles.list}>
        {recent.map((duel) => (
          <li key={duel.at} className={styles.row} data-won={duel.won || undefined}>
            <span className={styles.rowBadge}>{duel.won ? 'W' : 'L'}</span>
            <span className={styles.rowMain}>{duel.wpm} wpm</span>
            <span className={styles.rowSub}>{duel.accuracy}%</span>
          </li>
        ))}
      </ul>
    </>
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
