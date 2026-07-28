'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';
import {
  currentSpeed, EMPTY_TALLY, HANDLE_MAX, NAME_MAX, trend, useServerProfile, winRate,
  type DuelResult,
} from '@/game/serverProfile';
import { useAccount } from '@/game/useAccount';
import { asCharacter, DEFAULT_CHARACTER } from '@/models/character';
import { ratingFlame, START_RATING } from '@/models/rating';
import { Flame } from './RankFlame';
import CharacterPicker from './CharacterPicker';
import ChallengeList from './ChallengeList';
import FriendsPanel from './FriendsPanel';
import { useUiSounds } from './SoundToggle';
import WpmChart, { type ChartPoint } from './WpmChart';
import styles from './ProfileDashboard.module.css';

/**
 * The player's dashboard: who they are on the board, how fast they are now, and
 * whether that is going up.
 */
export default function ProfileDashboard() {
  /**
   * Which view of the account is showing.
   *
   * Local, not in the URL. A profile tab is not a place somebody links to or
   * expects the back button to walk through, and putting it in the route would
   * mean a router push on every click for no gain.
   */
  const [tab, setTab] = useState<'profile' | 'challenges' | 'characters'>('profile');

  // Its own route, so it never mounts Game and would otherwise be the one
  // silent screen in the app.
  useUiSounds();
  const {
    profile, loading, error, anonymous, saveName, saveHandle, saveCharacter,
  } = useServerProfile();
  const account = useAccount();

  if (loading) {
    return <Shell><Notice><p className={styles.muted}>Loading your record…</p></Notice></Shell>;
  }

  if (anonymous) {
    return (
      <Shell>
        <Notice>
          <p className={styles.muted}>
            Your profile lives with your account, so your name and history follow you
            between devices.
          </p>
          <LoginLink className={`btn btn-primary ${styles.loginBtn}`}>Sign in</LoginLink>
        </Notice>
      </Shell>
    );
  }

  if (error || !profile) {
    return (
      <Shell>
        <Notice><p className={styles.error}>{error ?? 'Could not load your record.'}</p></Notice>
      </Shell>
    );
  }

  /**
   * The API stores newest-first; a chart reads left-to-right through time.
   *
   * Passed whole rather than cut to twenty here. The chart lets you filter to
   * ranked or practice, and it cannot honour that over points thrown away
   * before they reached it — cutting the most recent twenty of *any* kind is
   * exactly what made a run of bot practice hide the ranked line.
   */
  const points: ChartPoint[] = [...profile.history]
    .reverse()
    .map(({ wpm, at, ranked, won }) => ({ wpm, at, ranked, won }));

  // Shown on the tab, so a finished challenge is noticed without opening it.
  const earned = (profile.challenges ?? []).filter((c) => c.done).length;
  const now = currentSpeed(profile.history);
  const movement = trend(profile.history);
  const ranked = profile.ranked ?? EMPTY_TALLY;
  const practice = profile.practice ?? EMPTY_TALLY;
  const rankedRate = winRate(ranked);
  const practiceRate = winRate(practice);

  return (
    <Shell>
      {/*
        * Two boxes, not one box with columns drawn in it.
        *
        * Friends and your record are separate things and now look it. Both
        * inside a single panel is what made every rearrangement still read as
        * one slab.
        *
        * Ordered record-then-friends in the DOM and placed by grid area, so the
        * two need not agree: a phone gets the record first, which is what
        * someone opening their profile came for, while a desktop puts friends
        * in the margin the record was never going to use.
        */}
      <div className={styles.layout}>
        <div className={`panel ${styles.recordBox}`}>
          {/*
            * Who you are, before anything you can change about it. The same
            * pairing the public card uses, deliberately — that is how other
            * players see you, so recognising yourself here is the point, and it
            * is the one place that shows which of your two names is which.
            */}
          <header className={styles.identity}>
            <h1 className={`${styles.identityName} pixel-font`}>
              {profile.displayName || account.displayName}
            </h1>
            {profile.handle && <p className={styles.identityHandle}>@{profile.handle}</p>}
          </header>

          {/*
            * Three views of one account, rather than one long column.
            *
            * The record is what most visits are for, so it stays the default and
            * keeps its own layout. Challenges and characters each want the full
            * width instead of a sidebar's share — the character grid especially,
            * since the roster is meant to grow and six across a narrow column is
            * already tight.
            */}
          <nav className={styles.tabs} aria-label="Profile sections">
            {([
              ['profile', 'Profile'],
              ['challenges', 'Challenges'],
              ['characters', 'Characters'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.tab}
                data-active={tab === id || undefined}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
                {id === 'challenges' && earned > 0 && (
                  <span className={styles.tabBadge}>{earned}</span>
                )}
              </button>
            ))}
          </nav>
          {/* Rendered conditionally, not `hidden`. `.body` is `display: grid`,
              which beats the browser's `[hidden] { display: none }` — so the
              attribute did nothing and every tab showed the record as well. */}
          {tab === 'profile' && (
          <div className={styles.body}>
            <div className={styles.main}>

              <section className={styles.section}>
                <h2 className={`${styles.heading} pixel-font`}>Where you are</h2>
                {/* Two, not six — so it fills its row rather than leaving a
                    gap where a third tile would go. */}
                <dl className={styles.stats} data-pair>
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
                  {/* First, and highlighted, because it is the one figure here
                      that is a standing rather than a personal best. Everything
                      beside it says how well you have played; this says where
                      that puts you. */}
                  <Stat
                    label="Rating"
                    value={profile.rating ?? START_RATING}
                    // Ember, azure, then gold. The mark is the progress: a
                    // crown would say the same thing at 300 as at 500.
                    icon={<Flame kind={ratingFlame(profile.rating ?? START_RATING)} height={19} />}
                    highlight
                    note={ranked.duels === 0 ? 'unplayed — everyone starts here' : undefined}
                  />
                  <Stat label="Duels" value={ranked.duels} highlight />
                  {/* "11–3", not "11W — 3L". The long form is eight characters
                      of a pixel font in a tile sized for four, so it broke after
                      the dash and dragged the whole row taller to match. The
                      label carries the W–L, where there is room for it. */}
                  <Stat label="Record (W–L)" value={ranked.wins}
                        suffix={`–${ranked.duels - ranked.wins}`} />
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
                  <Stat label="Record (W–L)" value={practice.wins}
                        suffix={`–${practice.duels - practice.wins}`} />
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

            {/* The two fields you change, alongside the record you read. Sticky
                on tall screens so a field you are typing into stays put. */}
            <aside className={styles.side}>
              <NameEditor
                current={profile.displayName}
                suggestion={account.displayName}
                onSave={saveName}
              />

              <HandleEditor current={profile.handle ?? ''} onSave={saveHandle} />

            </aside>
          </div>
          )}

          {tab === 'challenges' && (
            <section className={styles.section}>
              <h2 className={`${styles.heading} pixel-font`}>Challenges</h2>
              <p className={styles.muted}>
                Each one earns a character. Progress is worked out from your record,
                so anything you have already done counts — including duels you played
                before the challenge existed.
              </p>
              <ChallengeList challenges={profile.challenges ?? []} />
            </section>
          )}

          {tab === 'characters' && (
            <section className={styles.section}>
              <CharacterPicker
                current={asCharacter(profile.character)}
                onChoose={saveCharacter}
                // Straight from the server, which derives both from the record.
                // The picker greys things out; the endpoint refuses them.
                unlocked={profile.unlocked ?? [DEFAULT_CHARACTER]}
                challenges={profile.challenges ?? []}
              />
            </section>
          )}
        </div>

        <aside className={`panel ${styles.friendsBox}`}>
          <FriendsPanel />
        </aside>
      </div>
    </Shell>
  );
}

/**
 * The page around the boxes, rather than a box itself.
 *
 * This used to be one panel with everything inside it and columns drawn within,
 * which is why the page kept reading as a single slab however the insides were
 * rearranged — the border said "this is all one thing" no matter how it was
 * divided. The title bar belongs to the page; what sits below it are separate
 * containers, each holding one idea.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={`${styles.title} pixel-font`}>Profile</h1>
        <Link href="/" className={styles.back}>← Back to the arena</Link>
      </header>
      {children}
    </main>
  );
}

/** A single panel, for the states that have nothing to lay out. */
function Notice({ children }: { children: React.ReactNode }) {
  return <div className={`panel ${styles.notice}`}>{children}</div>;
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
        How other players find you, and the only name that is yours alone. Your
        first change is free; after that it settles for about a fortnight —
        unlike your display name, which you can change whenever you like.
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

function Stat({ icon, label, value, unit, prefix, suffix, note, highlight }: {
  /** Sits beside the figure. Used for the rating's flame. */
  icon?: React.ReactNode;
  label: string; value: number; unit?: string; prefix?: string;
  suffix?: string; note?: string; highlight?: boolean;
}) {
  return (
    <div className={styles.stat} data-highlight={highlight || undefined}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>
        {icon}
        {prefix}{value}{suffix}
        {unit && <small className={styles.unit}>{unit}</small>}
      </dd>
      {note && <p className={styles.statNote}>{note}</p>}
    </div>
  );
}
