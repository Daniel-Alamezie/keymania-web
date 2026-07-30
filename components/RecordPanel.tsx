'use client';

import { useState } from 'react';
import { useProfile } from '@/game/profile';
import ChallengeList from './ChallengeList';
import { useServerProfile, winRate } from '@/game/serverProfile';
import type { DuelResult, Tally } from '@/models/profile';
import type { ChallengeProgress } from '@/models/profile';
import styles from './SidePanel.module.css';

/**
 * What a signed-out visitor is shown in the challenges tab.
 *
 * Titles only, no progress, and the list is greyed by `signedIn={false}`. The
 * real list comes from the server and needs an account to compute against, so
 * this is a shop window rather than a placeholder — enough to say what is on
 * offer without pretending anybody is part-way through it.
 */
const LOCKED_PREVIEW: ChallengeProgress[] = [
  { id: 'p1', title: 'Beat the Rival bot', reward: { kind: 'character', character: 'sprout' },
    progress: 0, goal: 1, display: 'mark', done: false },
  { id: 'p2', title: 'Win three duels against people', reward: { kind: 'character', character: 'wanderer' },
    progress: 0, goal: 3, display: 'count', done: false },
  { id: 'p3', title: 'Finish a ranked duel at 95% accuracy', reward: { kind: 'character', character: 'scholar' },
    progress: 0, goal: 95, display: 'mark', done: false },
];

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
  /**
   * Two views of the same panel.
   *
   * The record is what you glance at after a duel; the challenges are what
   * pull you into the next one. They share a panel rather than each taking a
   * corner, because the arena screen has three boxes and a fourth would make
   * the menu the smallest thing on it.
   */
  const [tab, setTab] = useState<'record' | 'challenges'>('record');

  // The account record wins whenever there is one. `anonymous` is the explicit
  // signed-out signal; a null profile that is merely still loading falls
  // through to the local copy rather than flashing an empty panel.
  const useLocal = anonymous || !profile;

  if (useLocal) {
    return (
      <Shell
        note={anonymous ? 'This device only. Sign in to keep it.' : undefined}
        tab={tab}
        setTab={setTab}
      >
        {/* Shown greyed rather than hidden. Progression is the argument for
            making an account, and somebody who cannot see what is on offer has
            no reason to want it. */}
        {tab === 'challenges' ? <ChallengeList challenges={LOCKED_PREVIEW} signedIn={false} />
        : local.duels === 0 ? (
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
          ? 'Duels against other players. Practice is kept separately.'
          : 'Bot practice. Play another player and your ranked record starts here.'
      }
      tab={tab}
      setTab={setTab}
      earned={(profile.challenges ?? []).filter((c) => c.done).length}
    >
      {tab === 'challenges' ? (
        // The three you are nearest to. The panel is narrow, and "one more
        // win" is what pulls somebody back into a duel — the full list belongs
        // on the profile, where there is room to read it.
        <ChallengeList challenges={profile.challenges ?? []} limit={3} />
      ) : tally.duels === 0 ? (
        <Empty />
      ) : (
        <Body tally={tally} recent={profile.history.slice(0, 5)} />
      )}
    </Shell>
  );
}

function Shell({ note, children, tab, setTab, earned }: {
  note?: string;
  children: React.ReactNode;
  tab: 'record' | 'challenges';
  setTab: (tab: 'record' | 'challenges') => void;
  earned?: number;
}) {
  return (
    <aside className={`panel ${styles.side}`}>
      <nav className={styles.tabs} aria-label="Panel sections">
        <button
          type="button" className={styles.tab} data-active={tab === 'record' || undefined}
          aria-pressed={tab === 'record'} onClick={() => setTab('record')}
        >
          Your record
        </button>
        <button
          type="button" className={styles.tab} data-active={tab === 'challenges' || undefined}
          aria-pressed={tab === 'challenges'} onClick={() => setTab('challenges')}
        >
          Challenges
          {earned ? <span className={styles.badge}>{earned}</span> : null}
        </button>
      </nav>
      {tab === 'record' && note && <p className={styles.footnote}>{note}</p>}
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
