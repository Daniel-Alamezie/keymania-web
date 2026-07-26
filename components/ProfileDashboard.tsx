'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import {
  currentSpeed, NAME_MAX, trend, useServerProfile, type DuelResult,
} from '@/game/serverProfile';
import { useAccount } from '@/game/useAccount';
import WpmChart, { type ChartPoint } from './WpmChart';
import styles from './ProfileDashboard.module.css';

/**
 * The player's dashboard: who they are on the board, how fast they are now, and
 * whether that is going up.
 */
export default function ProfileDashboard() {
  const { profile, loading, error, anonymous, saveName } = useServerProfile();
  const account = useAccount();

  if (loading) return <Shell><p className={styles.muted}>Loading your record…</p></Shell>;

  if (anonymous) {
    return (
      <Shell>
        <p className={styles.muted}>
          Your profile lives with your account, so your name and history follow you
          between devices.
        </p>
        <LoginLink className={`btn btn-primary ${styles.loginBtn}`}>Sign in</LoginLink>
      </Shell>
    );
  }

  if (error || !profile) {
    return <Shell><p className={styles.error}>{error ?? 'Could not load your record.'}</p></Shell>;
  }

  // The API stores newest-first; a chart reads left-to-right through time.
  const points: ChartPoint[] = [...profile.history]
    .slice(0, 20)
    .reverse()
    .map(({ wpm, at, ranked, won }) => ({ wpm, at, ranked, won }));

  const now = currentSpeed(profile.history);
  const movement = trend(profile.history);
  const losses = profile.duels - profile.wins;

  return (
    <Shell>
      <NameEditor
        current={profile.displayName}
        suggestion={account.displayName}
        onSave={saveName}
      />

      <section className={styles.section}>
        <h2 className={`${styles.heading} pixel-font`}>Where you are</h2>
        <dl className={styles.stats}>
          <Stat label="Current speed" value={now} unit="wpm" highlight
                note={movement === null ? 'building a baseline'
                  : movement === 0 ? 'holding steady'
                  : `${movement > 0 ? '+' : ''}${movement} wpm vs earlier`} />
          <Stat label="Best ever" value={profile.bestWpm} unit="wpm" />
          <Stat label="Best ranked" value={profile.bestRankedWpm} unit="wpm"
                note="vs humans — what the board uses" />
          <Stat label="Best accuracy" value={profile.bestAccuracy} unit="%" />
          <Stat label="Best combo" value={profile.bestCombo} prefix="x" />
          <Stat label="Record" value={profile.wins} suffix={`W — ${losses}L`} />
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.heading} pixel-font`}>How you have been going</h2>
        <WpmChart points={points} />
      </section>

      {profile.history.length > 0 && (
        <section className={styles.section}>
          <h2 className={`${styles.heading} pixel-font`}>Recent duels</h2>
          <ul className={styles.list}>
            {profile.history.slice(0, 8).map((duel) => (
              <RecentRow key={duel.at} duel={duel} />
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={`panel ${styles.card}`}>
        <header className={styles.header}>
          <h1 className={`${styles.title} pixel-font`}>Profile</h1>
          <Link href="/" className={styles.back}>← Back to the arena</Link>
        </header>
        {children}
      </div>
    </main>
  );
}

/**
 * Editing the name shown to opponents and on the leaderboard.
 *
 * Kept as a draft until saved so a half-typed name is never what other players
 * briefly see.
 */
function NameEditor({ current, suggestion, onSave }: {
  current: string;
  /** Their account name, offered as a starting point when nothing is saved. */
  suggestion: string;
  onSave: (name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  // Seeded from the account name when nothing is saved, so a first-time player
  // is one click from appearing on the board as themselves rather than as
  // "Challenger".
  const [draft, setDraft] = useState(current || suggestion);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  // No effect needed to adopt the saved name: this component is only rendered
  // once the profile has loaded, so `current` is already correct on the first
  // render and useState seeds the draft from it directly.
  const dirty = draft.trim() !== current;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setProblem(null);

    const result = await onSave(draft.trim());
    if (result.ok) {
      setStatus('saved');
    } else {
      setStatus('idle');
      setProblem(result.error ?? 'Could not save that name.');
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={`${styles.heading} pixel-font`}>Display name</h2>
      <p className={styles.muted}>
        What opponents and the leaderboard call you. Changing it here changes it
        everywhere — including duels already on the board.
      </p>

      <form className={styles.nameRow} onSubmit={submit}>
        <input
          className={`field ${styles.input}`}
          value={draft}
          maxLength={NAME_MAX}
          placeholder="Challenger"
          aria-label="Display name"
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus('idle');
            setProblem(null);
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!dirty || draft.trim().length === 0 || status === 'saving'}
        >
          {status === 'saving' ? 'Saving' : 'Save'}
        </button>
      </form>

      <p className={styles.hint} aria-live="polite">
        {problem ? <span className={styles.error}>{problem}</span>
          : status === 'saved' ? <span className={styles.ok}>Saved.</span>
          : `${draft.length}/${NAME_MAX} characters`}
      </p>
    </section>
  );
}

function RecentRow({ duel }: { duel: DuelResult }) {
  return (
    <li className={styles.row} data-won={duel.won || undefined}>
      <span className={styles.badge}>{duel.won ? 'W' : 'L'}</span>
      <span className={styles.rowMain}>{duel.wpm} wpm</span>
      <span className={styles.rowSub}>{duel.accuracy}%</span>
      <span className={styles.rowTag}>
        {duel.ranked ? (duel.opponent ?? 'ranked') : 'practice'}
      </span>
    </li>
  );
}

function Stat({ label, value, unit, prefix, suffix, note, highlight }: {
  label: string; value: number; unit?: string; prefix?: string;
  suffix?: string; note?: string; highlight?: boolean;
}) {
  return (
    <div className={styles.stat} data-highlight={highlight || undefined}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>
        {prefix}{value}{suffix}
        {unit && <small className={styles.unit}>{unit}</small>}
      </dd>
      {note && <p className={styles.statNote}>{note}</p>}
    </div>
  );
}
