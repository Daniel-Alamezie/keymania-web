'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import {
  currentSpeed, EMPTY_TALLY, HANDLE_MAX, NAME_MAX, trend, useServerProfile, winRate,
  type DuelResult,
} from '@/game/serverProfile';
import { useAccount } from '@/game/useAccount';
import FriendsPanel from './FriendsPanel';
import { useUiSounds } from './SoundToggle';
import WpmChart, { type ChartPoint } from './WpmChart';
import styles from './ProfileDashboard.module.css';

/**
 * The player's dashboard: who they are on the board, how fast they are now, and
 * whether that is going up.
 */
export default function ProfileDashboard() {
  // Its own route, so it never mounts Game and would otherwise be the one
  // silent screen in the app.
  useUiSounds();
  const { profile, loading, error, anonymous, saveName, saveHandle } = useServerProfile();
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
  const ranked = profile.ranked ?? EMPTY_TALLY;
  const practice = profile.practice ?? EMPTY_TALLY;
  const rankedRate = winRate(ranked);
  const practiceRate = winRate(practice);

  return (
    <Shell>
      {/*
        * Who you are, before anything you can change about it.
        *
        * The same pairing the public card uses, and deliberately so: this is
        * how other players see you, so recognising yourself here is the point.
        * The name is what people read and the handle is what identifies them —
        * showing only one would leave you unable to tell which is which when
        * two players share a display name.
        */}
      <header className={styles.identity}>
        <h1 className={`${styles.identityName} pixel-font`}>
          {profile.displayName || account.displayName}
        </h1>
        {profile.handle && <p className={styles.identityHandle}>@{profile.handle}</p>}
      </header>

      {/*
        * Two columns rather than one long strip.
        *
        * Every section used to be stacked full width in a 720px column, which
        * on any desktop meant a page of empty space either side and a scroll
        * long enough to lose the bottom of.
        *
        * The split is by what you do with a thing rather than by what it is.
        * The left is everything you read or act on — your record, and your
        * people. The right is the two fields you change, which you touch once
        * and then leave alone for months.
        *
        * Ordered main-then-side in the DOM so that collapsing to one column on
        * a phone leaves the stats first, where somebody opening their profile
        * is looking, and the settings last, where settings belong.
        */}
      <div className={styles.body}>
        <div className={styles.main}>

      <section className={styles.section}>
        <h2 className={`${styles.heading} pixel-font`}>Where you are</h2>
        <dl className={styles.stats}>
          <Stat label="Current speed" value={now} unit="wpm" highlight
                note={movement === null ? 'building a baseline'
                  : movement === 0 ? 'holding steady'
                  : `${movement > 0 ? '+' : ''}${movement} wpm vs earlier`} />
          <Stat label="Best ranked speed" value={profile.bestRankedWpm} unit="wpm"
                note="what the board orders on" />
        </dl>
        <p className={styles.muted}>
          Speed counts wherever you earn it — practice is still typing. Records
          below are kept apart, so a run of bot wins never flatters the one that
          decides the board.
        </p>
      </section>

      {/* Two records, never merged. Beating Rookie on a loop is a fine way to
          get faster and a worthless way to look good. */}
      <section className={styles.section}>
        <h2 className={`${styles.heading} pixel-font`}>Ranked · versus players</h2>
        <dl className={styles.stats}>
          <Stat label="Duels" value={ranked.duels} highlight />
          <Stat label="Record" value={ranked.wins}
                suffix={`W — ${ranked.duels - ranked.wins}L`} />
          <Stat label="Win rate" value={rankedRate ?? 0} unit="%"
                note={rankedRate === null ? 'no ranked duels yet' : undefined} />
          <Stat label="Best speed" value={ranked.bestWpm} unit="wpm" />
          <Stat label="Best accuracy" value={ranked.bestAccuracy} unit="%" />
          <Stat label="Best combo" value={ranked.bestCombo} prefix="x" />
        </dl>
        {ranked.duels === 0 && (
          <p className={styles.muted}>
            Nothing here yet. Beat another player and this fills in — it is the only
            record that reaches the leaderboard.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={`${styles.heading} pixel-font`}>Practice · versus bots</h2>
        <dl className={styles.stats}>
          <Stat label="Duels" value={practice.duels} />
          <Stat label="Record" value={practice.wins}
                suffix={`W — ${practice.duels - practice.wins}L`} />
          <Stat label="Win rate" value={practiceRate ?? 0} unit="%"
                note={practiceRate === null ? 'no practice yet' : undefined} />
          <Stat label="Best speed" value={practice.bestWpm} unit="wpm" />
          <Stat label="Best accuracy" value={practice.bestAccuracy} unit="%" />
          <Stat label="Best combo" value={practice.bestCombo} prefix="x" />
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

        </div>

        {/*
          * Its own column, to the left of the record on a wide screen.
          *
          * Ordered after the record in the DOM and placed by grid area rather
          * than by source order, so the two do not have to agree: on a phone
          * the record comes first, because that is what someone opening their
          * profile came to see, while on a desktop friends sits in what was
          * otherwise empty margin.
          */}
        <div className={styles.friends}>
          <FriendsPanel />
        </div>

        {/* Sticky on tall screens, so the fields you might be typing into stay
            put while the record scrolls past them. */}
        <aside className={styles.side}>
          <NameEditor
            current={profile.displayName}
            suggestion={account.displayName}
            onSave={saveName}
          />

          <HandleEditor current={profile.handle ?? ''} onSave={saveHandle} />
        </aside>
      </div>
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

/**
 * The handle.
 *
 * Sits next to the display name and behaves almost nothing like it, which is
 * the point of showing them together: one is free and changeable, the other is
 * unique and rationed. The copy has to carry that, because the field looks
 * identical and the consequences are not.
 *
 * The input is canonicalised as you type rather than on submit. A handle is
 * lowercase ASCII with underscores for separators, and letting somebody type
 * "Daniel Alamezie" only to be handed "daniel_alamezie" after saving would make
 * the rule look like a bug. Showing the transformation live makes it a rule.
 */
function HandleEditor({ current, onSave }: {
  current: string;
  onSave: (handle: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState(current);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  const dirty = draft !== current;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setProblem(null);

    const result = await onSave(draft);
    if (result.ok) {
      setStatus('saved');
    } else {
      setStatus('idle');
      setProblem(result.error ?? 'Could not save that handle.');
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={`${styles.heading} pixel-font`}>Handle</h2>
      <p className={styles.muted}>
        How other players find you, and the only name that is yours alone. You can
        change it about once a month — unlike your display name, which you can
        change whenever you like.
      </p>

      <form className={styles.nameRow} onSubmit={submit}>
        <input
          className={`field ${styles.input}`}
          value={draft}
          maxLength={HANDLE_MAX}
          placeholder="typist"
          aria-label="Handle"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) => {
            // Mirrors sanitiseHandle upstream. The server is still the
            // authority — this only stops the field showing something it will
            // never accept.
            setDraft(event.target.value
              .toLowerCase()
              .replace(/[\s.\-]+/g, '_')
              .replace(/[^a-z0-9_]/g, '')
              .replace(/_{2,}/g, '_')
              .slice(0, HANDLE_MAX));
            setStatus('idle');
            setProblem(null);
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!dirty || draft.length < 3 || status === 'saving'}
        >
          {status === 'saving' ? 'Saving' : 'Save'}
        </button>
      </form>

      <p className={styles.hint} aria-live="polite">
        {problem ? <span className={styles.error}>{problem}</span>
          : status === 'saved' ? <span className={styles.ok}>Saved.</span>
          : current ? `Players add you as @${current}`
          : 'Letters, numbers and underscores.'}
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
