'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SignInLink from './SignInLink';
import {
  currentSpeed, EMPTY_TALLY, HANDLE_MAX, NAME_MAX, trend, useServerProfile, winRate,
  type DuelResult,
} from '@/game/serverProfile';
import { useAccount } from '@/game/useAccount';
import { asCharacter, DEFAULT_CHARACTER } from '@/models/character';
import { formatPlayTime } from '@/models/profile';
import { daysTyped } from '@/models/streak';
import { markCosmeticsSeen, useUnseenCosmetics } from '@/game/seenCosmetics';
import { markChallengesSeen } from '@/game/seenChallenges';
import { takeProfileTab } from '@/game/profileIntent';
import { ratingFlame, START_RATING } from '@/models/rating';
import { Flame } from './RankFlame';
import CharacterPicker from './CharacterPicker';
import CosmeticsPicker from './CosmeticsPicker';
import ChallengeList from './ChallengeList';
import FriendsPanel from './FriendsPanel';
import { useUiSounds } from './SoundToggle';
import WpmChart, { type ChartPoint } from './WpmChart';
import styles from './ProfileDashboard.module.css';
import CountryPicker from './CountryPicker';
import StreakGrid from './StreakGrid';

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
  const [tab, setTab] = useState<'profile' | 'challenges' | 'characters' | 'look'>('profile');

  /**
   * A parked tab, from the challenge toast — the one thing that delivers
   * somebody *to* a tab rather than to the page.
   *
   * In an effect, not the initialiser, though the initialiser reads better:
   * this page is prerendered showing the profile tab, and sessionStorage does
   * not exist on the server, so an initialiser that read it would hydrate a
   * different tab than the HTML shows. The effect runs after hydration and
   * switches — one frame on the default tab, which nobody can see, against a
   * hydration mismatch, which is the trade this codebase always makes.
   */
  useEffect(() => {
    const parked = takeProfileTab();
    // A one-shot navigation intent: one extra render, on arrival, only when a
    // toast parked a tab. The rule guards against cascading renders; the
    // alternative here is reading sessionStorage in the initialiser, which
    // hydrates a different tab than the server drew.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (parked) setTab(parked);
  }, []);

  // Its own route, so it never mounts Game and would otherwise be the one
  // silent screen in the app.
  useUiSounds();
  const {
    profile, loading, error, anonymous, saveName, saveHandle, saveCharacter, saveCountry,
  } = useServerProfile();
  const account = useAccount();

  /**
   * Cosmetics this browser has not shown its player yet.
   *
   * The whole reason for the badge: an unlock lands on the record silently —
   * a challenge completing on a results screen, a Monday award job, a founder
   * kit growing a colour — and until now the only way to discover it was to
   * open Appearance on a hunch.
   *
   * **Above the early returns, with the other hooks.** It first went in beside
   * the figures it is rendered next to, which is where it reads best and is
   * three returns too late: this component bails out for loading, for signed
   * out and for error, so a hook there runs on some renders and not others.
   */
  const earnedIds = profile?.cosmetics?.earned;
  const unseen = useUnseenCosmetics(earnedIds);



  /**
   * Opening the panel is what counts as looking.
   *
   * Marked on arrival rather than on leaving, so an unlock that lands while
   * somebody is already reading the grid is covered too — the alternative
   * leaves a badge for a thing that is on screen.
   */
  const seenKey = earnedIds?.join(',') ?? '';
  useEffect(() => {
    if (tab === 'look' && earnedIds?.length) markCosmeticsSeen(earnedIds);
    // Keyed on the joined ids rather than the array, whose identity changes
    // with every store snapshot and would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, seenKey]);

  /**
   * The same rule for challenges: opening the tab is what counts as being
   * told. This is the organic path — a player who finds the list themselves
   * must not be greeted by a toast announcing what they have already read.
   */
  const challengeIds = profile?.challenges?.map((c) => c.id) ?? [];
  const challengeKey = challengeIds.join(',');
  useEffect(() => {
    if (tab === 'challenges' && challengeIds.length) markChallengesSeen(challengeIds);
    // Keyed on the joined ids, same as the cosmetics effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, challengeKey]);

  /**
   * Plain derivations, not hooks, so they can sit here without the ordering
   * hazard the two effects above carry — this component returns early three
   * times, and anything conditional must stay above all of them.
   */
  const typedDays = daysTyped(profile?.streak);
  /**
   * Whether the run they are on *is* the record.
   *
   * Worth saying, because the two tiles otherwise show the same number twice
   * with no explanation — which reads as a bug rather than as an achievement.
   * Only when there is a streak at all: two zeroes are not a record.
   */
  const streakIsRecord = Boolean(profile?.streak?.current)
    && profile?.streak?.current === profile?.streak?.best;

  /**
   * `!profile`, not just `loading`.
   *
   * The store revalidates in the background roughly once a minute, and on
   * every duel end. Keying the placeholder on `loading` alone meant any of
   * those could blank a fully-rendered page and rebuild it — a flicker with no
   * new information behind it, since the answer almost always came back
   * identical.
   */
  if (loading && !profile) return <Shell><Skeleton /></Shell>;

  if (anonymous) {
    return (
      <Shell>
        <Notice>
          <p className={styles.muted}>
            Your profile lives with your account, so your name and history follow you
            between devices.
          </p>
          <SignInLink from="profile" className={`btn btn-primary ${styles.loginBtn}`}>Sign in</SignInLink>
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
              ['look', 'Appearance'],
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
                {/*
                  * Unlocks nobody has looked at yet.
                  *
                  * Gold rather than the challenges badge's green, because the
                  * two say different things: that one is a tally of what you
                  * have done and sits there permanently, this one is news and
                  * goes away once read. A second green pill would read as
                  * more of the same and be ignored with it.
                  */}
                {id === 'look' && unseen > 0 && (
                  <span
                    className={`${styles.tabBadge} ${styles.tabBadgeNew}`}
                    aria-label={`${unseen} new`}
                  >
                    {unseen}
                  </span>
                )}
              </button>
            ))}
          </nav>
          {/* Rendered conditionally, not `hidden`. `.body` is `display: grid`,
              which beats the browser's `[hidden] { display: none }` — so the
              attribute did nothing and every tab showed the record as well. */}
          {tab === 'profile' && (
          <>
          <div className={styles.body}>
            <div className={styles.main}>

              <section className={styles.section}>
                <h2 className={`${styles.heading} pixel-font`}>Where you are</h2>
                {/* Three exactly, so the row is full at the default grid. */}
                <dl className={styles.stats}>
                  <Stat label="Current speed" value={now} unit="wpm" highlight
                        note={movement === null ? 'building a baseline'
                          : movement === 0 ? 'holding steady'
                          : `${movement > 0 ? '+' : ''}${movement} wpm vs earlier`} />
                  <Stat label="Best ranked speed" value={profile.bestRankedWpm} unit="wpm"
                        note="what the board orders on" />
                  {/* Belongs up here rather than in either column below: time
                      is spent across ranked, practice and survival alike, and
                      filing it under one would claim it was earned there. */}
                  {profile.playMs !== undefined && (
                    <Stat label="Time played" value={formatPlayTime(profile.playMs)}
                          note="across every mode" />
                  )}
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
                  {/*
                    * Record and win rate in one tile, because they were one
                    * fact stated twice: 18-11 *is* 62%, and reading both is
                    * arithmetic somebody has already been shown the answer to.
                    *
                    * It also happened to be what made this section seven tiles
                    * in a three-column grid, so the last one sat alone in a
                    * third of a row looking like a mistake. Six lays as two
                    * full rows.
                    */}
                  <Stat label="Record (W–L)" value={ranked.wins}
                        suffix={`–${ranked.duels - ranked.wins}`}
                        note={rankedRate === null ? 'no ranked duels yet' : `${rankedRate}% won`} />
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
                        suffix={`–${practice.duels - practice.wins}`}
                        note={practiceRate === null ? 'no practice yet' : `${practiceRate}% won`} />
                  <Stat label="Best speed" value={practice.bestWpm} unit="wpm" />
                  <Stat label="Best accuracy" value={practice.bestAccuracy} unit="%" />
                  <Stat label="Best combo" value={practice.bestCombo} prefix="x" />
                </dl>
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

              {/*
                * Country sits with the name and the handle rather than with the
                * cosmetics, because it is identity rather than an award. Nothing
                * about it was earned, and shelving it in the trophy cabinet
                * would say otherwise.
                */}
              <section className={styles.section}>
                <h2 className={`${styles.heading} pixel-font`}>Country</h2>
                <p className={styles.muted}>
                  Shown beside your name on the boards, and it puts you on your
                  country&apos;s leaderboard. Optional, and you can remove it at
                  any time.
                </p>
                <CountryPicker current={profile.country} onSave={saveCountry} />
              </section>

            </aside>
          </div>

          <div className={styles.wide}>
              {/*
                * The year, and the run it adds up to.
                *
                * On this page and no other. The grid is a map of when somebody
                * is at their keyboard, which is exactly what the public card
                * withholds duel history to avoid -- other people see the
                * number, never the shape behind it.
                */}
              <section className={styles.section}>
                <h2 className={`${styles.heading} pixel-font`}>Daily streak</h2>
                {/*
                  * Figures, not a sentence.
                  *
                  * This read "2 days running. Best: 2. You can miss one day a
                  * week without losing it." — three separate facts in one line
                  * of prose, so the two numbers a player actually came for had
                  * to be unpicked from the words around them. The same tiles
                  * the rest of the profile uses put each figure where the eye
                  * already expects one, and the rule that protects the streak
                  * sits under the streak it protects rather than trailing the
                  * paragraph.
                  */}
                <dl className={`${styles.stats} ${styles.streakStats}`}>
                  <Stat
                    label="Current streak"
                    value={profile.streak?.current ?? 0}
                    unit={(profile.streak?.current ?? 0) === 1 ? 'day' : 'days'}
                    highlight
                    note={profile.streak?.current
                      ? 'miss one day a week and it survives'
                      : 'type anything today to start one'}
                  />
                  <Stat
                    label="Best streak"
                    value={profile.streak?.best ?? 0}
                    unit={(profile.streak?.best ?? 0) === 1 ? 'day' : 'days'}
                    note={streakIsRecord ? 'your record, right now' : 'the longest you have run'}
                  />
                  {/* The third fact the calendar is already showing and nothing
                      was naming: a run resets, this only climbs. Somebody whose
                      best streak is four days may still have typed on ninety. */}
                  <Stat
                    label="Days typed"
                    value={typedDays}
                    unit={typedDays === 1 ? 'day' : 'days'}
                    note="in the last year"
                  />
                </dl>
                <StreakGrid streak={profile.streak} handle={profile.handle} />
              </section>

              <section className={styles.section}>
                <h2 className={`${styles.heading} pixel-font`}>How you have been going</h2>
                <WpmChart points={points} />
              </section>
          </div>
          </>
          )}

          {tab === 'challenges' && (
            <section className={styles.section}>
              <h2 className={`${styles.heading} pixel-font`}>Challenges</h2>
              <p className={styles.muted}>
                Each one earns something to keep: a character, a badge, a name
                colour. Progress is worked out from your record, so anything you
                have already done counts, including duels you played before the
                challenge existed.
              </p>
              <ChallengeList
                challenges={profile.challenges ?? []}
                catalogue={profile.cosmetics?.catalogue}
              />
            </section>
          )}

          {tab === 'look' && (
            <section className={styles.section}>
              <h2 className={`${styles.heading} pixel-font`}>Appearance</h2>
              <p className={styles.blurb}>
                How you look to everyone else. Badges show on the boards and beside
                your name in a duel; a name colour changes how you read on the
                boards.
              </p>
              <CosmeticsPicker />
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
 * The page's own shape, before the numbers arrive.
 *
 * Not a spinner, and not a message. The record is cached in localStorage, but
 * localStorage cannot be read while rendering on the server — so the server
 * always renders the not-yet state, the browser paints it, and only after
 * hydration does the cached copy appear. Whatever that first paint is, it is
 * on screen for a moment on every hard refresh.
 *
 * A "Loading your record…" panel made that moment expensive: the browser
 * painted one small box, then replaced it with a full dashboard, so the whole
 * page jumped. Painting the real layout with its values withheld makes the
 * same transition a matter of digits filling in, at a size and position they
 * were always going to occupy.
 *
 * It only has to match the *shape*. Getting the tile count and the headings
 * right is what holds the layout still; the values are dashes on purpose,
 * because inventing plausible ones would flash a number nobody earned.
 */
function Skeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <div className={`panel ${styles.recordBox}`}>
      <header className={styles.identity}>
        <h1 className={`${styles.identityName} pixel-font ${styles.ghost}`}>&nbsp;</h1>
      </header>

      <div className={styles.body}>
        <div className={styles.main}>
          <section className={styles.section}>
            <h2 className={`${styles.heading} pixel-font`}>Where you are</h2>
            <dl className={styles.stats} data-pair>
              <GhostStat label="Current speed" />
              <GhostStat label="Best ranked speed" />
            </dl>
          </section>

          <section className={styles.section}>
            <h2 className={`${styles.heading} pixel-font`}>Ranked · versus players</h2>
            <dl className={styles.stats}>
              {/* The same six the loaded section shows, in the same order. A
                  skeleton that names a tile the real thing does not have swaps
                  a label out from under the reader as it settles. */}
              {['Rating', 'Duels', 'Record (W–L)', 'Best speed', 'Best accuracy', 'Best combo']
                .map((label) => <GhostStat key={label} label={label} />)}
            </dl>
          </section>
        </div>
      </div>
      </div>

      {/* The friends box is real from the first paint: it loads independently
          of the record, so withholding it would be inventing a wait that does
          not exist. */}
      <aside className={`panel ${styles.friendsBox}`}>
        <FriendsPanel />
      </aside>
    </div>
  );
}

function GhostStat({ label }: { label: string }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font ${styles.ghost}`}>—</dd>
    </div>
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
  /* A string for the figures that are already words, like "12h 40m". */
  label: string; value: number | string; unit?: string; prefix?: string;
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
