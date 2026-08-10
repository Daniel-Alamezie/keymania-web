'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ratingFlame, START_RATING } from '@/models/rating';
import { Flame } from './RankFlame';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { pathLabel, previousPath } from '@/game/lastPath';
import { sendInvite } from '@/game/sendInvite';
import SignInLink from './SignInLink';
import { useFriends } from '@/game/friends';
import { contenders, friendStanding } from '@/game/friendRank';
import Sparkline from './Sparkline';
import CountryChip from './CountryChip';
import chip from './CountryChip.module.css';
import { EMPTY_TALLY, useHandle, winRate } from '@/game/serverProfile';
import { formatPlayTime, type PublicProfile as Profile } from '@/models/profile';
import { badgeSrc, badgeTooltip } from '@/models/cosmetics';
import CrownWeeks from './CrownWeeks';
import { countryName } from '@/models/countries';
import { useUiSounds } from './SoundToggle';
import styles from './PublicProfile.module.css';

/**
 * Somebody else's profile.
 *
 * Shows strictly less than your own does, and the gap is deliberate rather than
 * unfinished: there is no duel history here, because history carries opponent
 * names and would publish who a player spends their evenings with and when they
 * were last at a keyboard. What is left is what the leaderboard already says
 * about its top ten.
 */

type Status = 'loading' | 'ready' | 'missing' | 'signedOut' | 'error';

/**
 * The cabinet's shelves, in a fixed order.
 *
 * Badges first because they are the pictures, colours after, titles last as
 * the wordiest. Fixed rather than ordered by what somebody owns, so two
 * profiles side by side always shelve alike.
 */
const SHELVES = [
  { kind: 'badge', name: 'Badges' },
  { kind: 'nameColour', name: 'Name colours' },
  { kind: 'title', name: 'Titles' },
] as const;

export default function PublicProfile({ handle }: { handle: string }) {
  useUiSounds();
  const router = useRouter();
  const myHandle = useHandle();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  /**
   * Looking at yourself: go to the dashboard instead.
   *
   * The public card is a worse version of your own profile — it shows less and
   * can do nothing, and offering yourself an "Add friend" button is plainly
   * wrong. Links elsewhere already point your own row at /profile, so this is
   * the backstop for a URL typed, bookmarked or shared back to you.
   *
   * Compared against the *fetched* handle rather than the one in the URL. Old
   * handles keep resolving on purpose so shared links never break, which means
   * /u/an_old_handle_of_mine is also me — and matching on the URL alone would
   * miss it and show me a stranger's view of myself.
   */
  const mine = Boolean(myHandle) && profile?.handle === myHandle;

  useEffect(() => {
    // replace, not push: this page should not sit in history as a step to go
    // back to, or Back from the dashboard would bounce straight here again.
    if (mine) router.replace('/profile');
  }, [mine, router]);

  // Only enabled once we know the visitor is signed in, so a signed-out visitor
  // does not fire a request that can only 401.
  const friends = useFriends(status === 'ready');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const response = await fetch(`/api/players/${encodeURIComponent(handle)}`, {
          cache: 'no-store',
        });
        if (!live) return;

        // The upstream route is authenticated, so a 401 here means "sign in to
        // look at this", not "this player does not exist".
        if (response.status === 401) return setStatus('signedOut');
        if (response.status === 404) return setStatus('missing');
        if (!response.ok) return setStatus('error');

        setProfile((await response.json()) as Profile);
        setStatus('ready');
      } catch {
        if (live) setStatus('error');
      }
    })();

    return () => { live = false; };
  }, [handle]);

  // Covers the frame between knowing it is you and the router acting, so the
  // wrong page never paints even for one frame.
  if (status === 'loading' || mine) {
    return <Shell><p className={styles.muted}>Loading…</p></Shell>;
  }

  if (status === 'signedOut') {
    return (
      <Shell>
        <p className={styles.muted}>Sign in to look at other players&apos; profiles.</p>
        <SignInLink from="public_profile" className={`btn btn-primary ${styles.cta}`}>Sign in</SignInLink>
      </Shell>
    );
  }

  if (status === 'missing') {
    return <Shell><p className={styles.muted}>No player goes by @{handle}.</p></Shell>;
  }

  if (status === 'error' || !profile) {
    return <Shell><p className={styles.error}>Could not load that profile.</p></Shell>;
  }

  const ranked = profile.ranked ?? EMPTY_TALLY;
  const rate = winRate(ranked);

  /**
   * An earned name colour, inline because the palette lives on the server and
   * a stylesheet cannot hold a colour it has not been told about. Undefined
   * rather than an empty object, so the default styling is untouched for the
   * great majority of players, who wear nothing.
   */
  const colour = profile.cosmetics?.nameColour ? { color: profile.cosmetics.nameColour } : undefined;

  // Derived from the list rather than tracked separately, so it stays right
  // after any change without this component knowing the rules.
  const friendship = friends.data.friends.find((f) => f.handle === profile.handle);
  const already = Boolean(friendship);
  /**
   * Their presence, taken from the friends list rather than from this page's
   * own fetch.
   *
   * The public profile deliberately says nothing about when somebody was last
   * at a keyboard — that is the same reason it carries no duel history. But
   * the friends list, which this page already loads to decide whether an "Add
   * friend" button belongs here, does know, and only for people you are
   * actually connected to. Reading it from there keeps the disclosure exactly
   * where it was: between friends, and nowhere else.
   */
  const presence = friendship?.presence;

  /**
   * Their place among the viewer's friends.
   *
   * `contenders` builds the pool from the friends list this page already
   * fetched — so this costs no request — and marks the subject as `you` so the
   * ranking treats them as the one being placed. That flag names "the person
   * this figure is about", which here is the profile's owner rather than the
   * reader.
   *
   * `undefined` for a stranger, for somebody unranked, and while the friends
   * list is still loading. All three mean the same thing to the card: there is
   * no honest number to put here, so the cell is not drawn.
   */
  const standing = friendship && profile
    ? friendStanding(
      contenders(
        friends.data.friends.filter((f) => f.handle !== profile.handle),
        {
          handle: profile.handle,
          displayName: profile.displayName,
          rating: profile.rating,
          bestWpm: profile.bestRankedWpm,
          you: true,
        },
      ),
      'standings',
    )
    : undefined;
  const pending = friends.data.outgoing.some((f) => f.handle === profile.handle);
  const incoming = friends.data.incoming.some((f) => f.handle === profile.handle);

  return (
    <Shell>
      <header className={styles.header}>
        <h1 className={`${styles.name} pixel-font`} style={colour}>
          {/*
            * The badge leads the name rather than trailing it, which is the
            * opposite of the leaderboard and deliberate. A board row is a
            * column being scanned, so a badge before the name would put every
            * name at a different x; this is one heading being read, and a mark
            * in front of it is a mark on the person.
            */}
          {profile.cosmetics?.badge && (
            <span
              className={styles.badge}
              /*
               * The panel speaks for the badge when there is one.
               *
               * Both are hover treatments anchored to the same 26px mark, so
               * both opened at once and the tooltip landed across the panel's
               * heading — two answers to one question, one of them on top of
               * the other. The panel is the better answer here: it separates
               * the weeks instead of running them into a sentence.
               */
              data-tip={
                profile.cosmetics.crownWeeks?.length
                  ? undefined
                  : badgeTooltip(profile.cosmetics)
              }
            >
              <img src={badgeSrc(profile.cosmetics.badge)} alt="" width={26} height={26} />
              {profile.cosmetics.badgeNumber !== undefined && (
                <span className={styles.badgeNo}>{profile.cosmetics.badgeNumber}</span>
              )}
              {/* The weeks behind the crown. This is the surface with room to
                  open a panel, and the one somebody arrives at wanting to know
                  who they are looking at. */}
              <CrownWeeks weeks={profile.cosmetics.crownWeeks} size="large" />
            </span>
          )}
          {profile.displayName}
        </h1>
        <p className={`${styles.handle} ${styles.handleRow}`}>
          {/* Beside the handle rather than the display name: both are identity
              rather than achievement, and the badge above is already carrying
              the eye at the name's line. */}
          <CountryChip code={profile.country} className={chip.large} />
          <span>@{profile.handle}</span>
        </p>
        {/* Here rather than on a board row, which has no width to spare for
            one. This is the surface titles were made for. */}
        {profile.cosmetics?.title && (
          <p className={`${styles.title} pixel-font`}>{profile.cosmetics.title}</p>
        )}
      </header>

      {/*
        * Where they stand, and it is the only part of this page that compares
        * them to anybody. Everything below is a player's own numbers.
        */}
      <section className={styles.standing} aria-label="Standing">
        <div className={styles.rankings}>
          <div>
            <p className={styles.rankLabel}>Global ranking</p>
            {profile.rank ? (
              <p className={`${styles.rankValue} pixel-font`}>
                {/*
                  * "1000+" when the server stopped counting rather than a
                  * number it did not finish working out. See RANK_CEILING in
                  * the API: a truncated count shown as an exact rank would be
                  * wrong in the flattering direction, with nothing saying so.
                  */}
                #{profile.rank.position.toLocaleString()}{profile.rank.capped && '+'}
              </p>
            ) : (
              /* Not last. Unranked — they have never finished a refereed duel,
                 and a number here would invent a defeat nobody handed them. */
              <p className={styles.rankNone}>Unranked</p>
            )}
          </div>

          {/*
            * Their place among YOUR friends, never among theirs.
            *
            * This is the one thing on this page that is easy to get backwards
            * and expensive if you do. Ranking somebody within their own friend
            * list would publish how many friends they have and imply who is in
            * that circle — the same class of fact this card withholds duel
            * history to avoid. The pool is always the viewer's, so the figure
            * says "where this player sits among the people I know", which is
            * both private and the more useful of the two readings.
            *
            * Shown only when they are actually in that pool. For a stranger
            * there is no such position, and the global figure takes the width.
            */}
          {/*
            * Their country's standings, between global and friends.
            *
            * The order is deliberate: widest pool, then narrower, then the one
            * that is personal to the reader. Absent entirely for somebody who
            * has not chosen a country — an empty cell reading "unranked" would
            * imply they lost a board they were never on.
            */}
          {profile.countryRank && profile.country && (
            <div>
              <p className={styles.rankLabel}>In {countryName(profile.country)}</p>
              <p className={`${styles.rankValue} pixel-font`}>
                #{profile.countryRank.position.toLocaleString()}
                {profile.countryRank.capped && '+'}
              </p>
            </div>
          )}

          {standing && (
            <div>
              <p className={styles.rankLabel}>Among your friends</p>
              <p className={`${styles.rankValue} pixel-font`}>
                #{standing.position}
                <span className={styles.rankOf}>of {standing.of}</span>
              </p>
            </div>
          )}
        </div>

        {/*
          * Recent form.
          *
          * Speeds in order with no dates, which is what makes it publishable at
          * all — see recentWpm in the API. Absent under two duels, because a
          * line needs two ends and one duel is not a trend.
          */}
        {(profile.recentWpm?.length ?? 0) > 1 && (
          <>
            <Sparkline
              className={styles.spark}
              points={profile.recentWpm!}
              label={`Recent speed across ${profile.recentWpm!.length} ranked duels`}
            />
            <p className={styles.sparkCaption}>
              <span>Recent speed</span>
              <span className={styles.sparkNow}>{profile.recentWpm!.at(-1)} wpm</span>
            </p>
          </>
        )}
      </section>

      <dl className={styles.stats}>
        {/* Leads, because it is the only figure here that compares this player
            to the person reading it rather than to themselves. */}
        <Stat
          label="Rating"
          value={profile.rating ?? START_RATING}
          icon={<Flame kind={ratingFlame(profile.rating ?? START_RATING)} height={19} />}
          highlight
        />
        <Stat label="Best speed" value={profile.bestRankedWpm} unit="wpm" highlight />
        {/*
          * Days running, and only the number.
          *
          * Persistence is standing, in the way a rating is: it says something
          * about a player without saying when they are at their desk. The
          * calendar behind it stays on their own dashboard, because a grid of
          * squares is a precise map of somebody's week and this card withholds
          * duel history for exactly that reason.
          *
          * Absent rather than "0 days" for somebody with no run going. A zero
          * here reads as a judgement on a player who may simply be new.
          */}
        {profile.streak !== undefined && profile.streak > 0 && (
          <Stat label="Streak" value={profile.streak} unit={profile.streak === 1 ? 'day' : 'days'} />
        )}
        <Stat label="Ranked duels" value={ranked.duels} />
        {/* Absent from an older server rather than shown as zero: "0m" under
            a hundred duels is a claim the card cannot mean. */}
        {profile.playMs !== undefined && (
          <Stat label="Time played" value={formatPlayTime(profile.playMs)} />
        )}
        <Stat label="Win rate" value={rate ?? '—'} unit={rate === null ? '' : '%'} />
        <Stat label="Best accuracy" value={ranked.bestAccuracy} unit="%" />
      </dl>

      {/*
        * Everything they have unlocked, shown as a cabinet with shelves.
        *
        * One shelf per kind, in a fixed order, because "badge or colour?" is
        * the first question a mixed strip forces a reader to answer for every
        * single chip. The shelf answers it once, for the whole row — the same
        * grouping the owner's picker already uses, so the two surfaces read
        * as one system.
        *
        * Every tile is captioned rather than named only on hover, because a
        * phone has no hover and a cabinet whose labels need a mouse is only
        * legible to half its visitors. Within a shelf the order is still the
        * order it was earned — a collection is a history.
        */}
      {(profile.collection?.length ?? 0) > 0 && (
        <section className={styles.collection} aria-label="Unlocked cosmetics">
          <h2 className={`${styles.collectionHeading} pixel-font`}>Collection</h2>
          {SHELVES.map(({ kind, name }) => {
            const items = profile.collection!.filter((item) => item.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind} className={styles.shelf}>
                <h3 className={styles.shelfName}>{name}</h3>
                <ul className={styles.shelfList}>
                  {items.map((item) => (
                    <li
                      key={`${item.kind}-${item.label}`}
                      className={styles.shelfItem}
                      data-kind={item.kind}
                      // The caption already says what it is; the tip only adds
                      // what the caption cannot, which is the founder number.
                      data-tip={item.number !== undefined
                        ? badgeTooltip({ badgeNumber: item.number, badgeLabel: item.label })
                        : undefined}
                    >
                      {item.kind === 'badge' && item.value && (
                        <span className={styles.tileArt}>
                          <img src={badgeSrc(item.value)} alt="" width={28} height={28} />
                          {item.number !== undefined && (
                            <span className={styles.tileNo}>{item.number}</span>
                          )}
                          {/*
                            * The crown's weeks, on the tile that cost them.
                            *
                            * A cabinet is where somebody has stopped to look,
                            * so this lists a single win too — "Week 1" is the
                            * whole of a first champion's record and there is
                            * nowhere else it is written down. The count above
                            * it still waits for a second.
                            */}
                          <CrownWeeks weeks={item.weeks} size="tile" />
                        </span>
                      )}
                      {/*
                        * The colour shown as the thing itself: your name, in
                        * it. "Abc" is the picker's own spelling of that, and
                        * repeating it here is what makes the swatch legible —
                        * a bare coloured word looks like a link.
                        */}
                      {item.kind === 'nameColour' && (
                        <span className={`${styles.tileSwatch} pixel-font`} style={{ color: item.value }}>
                          Abc
                        </span>
                      )}
                      <span className={styles.tileName}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <div className={styles.actions}>
        {/*
          * Invite, on the path players actually take.
          *
          * Reported after the first release: you find somebody on the
          * leaderboard, open them, see that you are friends, and then have to
          * go back to your own profile to ask them for a game. The panel is
          * not where the intention forms — this page is.
          *
          * Offered only for a friend who is free right now, and a friend
          * mid-duel is told so rather than shown a dead button. Nothing at all
          * for one who is offline: there is no ask to make, and a permanently
          * disabled control would just be a question the page cannot answer.
          */}
        {already && presence === 'idle' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { void sendInvite(profile.handle, profile.displayName); }}
          >
            Invite to a duel
          </button>
        )}
        {already && presence === 'busy' && (
          <span className={styles.settled}>They are in a game.</span>
        )}
        {already && presence !== 'idle' && presence !== 'busy' && (
          <span className={styles.settled}>You are friends.</span>
        )}
        {incoming && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={friends.busy}
            onClick={() => friends.accept(profile.handle)}
          >
            Accept request
          </button>
        )}
        {!already && !incoming && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={friends.busy || pending || sent}
            onClick={async () => {
              const result = await friends.add(profile.handle);
              setSent(result.ok);
            }}
          >
            {pending || sent ? 'Request sent' : 'Add friend'}
          </button>
        )}
        <Link href="/profile" className="btn btn-ghost">Your profile</Link>
      </div>

      <p className={styles.footnote}>
        Only server-refereed duels are shown. Practice against bots is a player&apos;s
        own business.
      </p>
    </Shell>
  );
}

/**
 * Back to wherever they actually came from.
 *
 * This used to be a fixed link to the menu, which was wrong in the commonest
 * case there is: opening a friend from the friends list on the profile page
 * and then trying to get back to it. The player was put on the home screen,
 * several clicks from the list they had been reading.
 *
 * A remembered previous path rather than `router.back()`, because this page is
 * also reached by a link somebody shared — and for that visitor `back()` means
 * leaving the site altogether. When there is no in-app history to return to,
 * the control keeps its old behaviour and says so.
 *
 * The destination is named rather than called "Back". A label that says where
 * it goes can be trusted at a glance; one that says "back" has to be tested by
 * pressing it.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const here = usePathname();

  /**
   * Read as an external store rather than into state from an effect.
   *
   * `sessionStorage` is exactly that — a thing outside React that the server
   * render cannot see — and this is the hook built for it. The server snapshot
   * is null, so the first paint says "Menu" and the client corrects it on
   * hydration without a cascading render. Nothing subscribes, because the
   * value is written on the way *out* of a page and cannot change while this
   * one is open.
   */
  const from = useSyncExternalStore(
    () => () => {},
    () => previousPath(here),
    () => null,
  );

  const target = from ?? '/';
  return (
    <main className={styles.page}>
      <div className={`panel ${styles.card}`}>
        <Link href={target} className={styles.back}>← {pathLabel(target)}</Link>
        {children}
      </div>
    </main>
  );
}

function Stat({ icon, label, value, unit, highlight }: {
  /** Sits beside the figure. Used for the rating's flame. */
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className={styles.stat} data-highlight={highlight || undefined}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={`${styles.statValue} pixel-font`}>
        {icon}
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </dd>
    </div>
  );
}
