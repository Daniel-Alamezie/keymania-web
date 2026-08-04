'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBoard } from '@/game/useBoard';
import { useFriendBoard } from '@/game/useFriendBoard';
import { useServerProfile } from '@/game/serverProfile';
import { countryName } from '@/models/countries';
import { asBoard, BOARDS, BOARD_META, PAGE_LIMIT, type BoardKind } from '@/models/leaderboard';
import { untilRollover } from '@/game/weeklyClock';
import BoardRows from './BoardRows';
import BoardScope, { useScope } from './BoardScope';
import BoardGuide from './BoardGuide';
import panel from './SidePanel.module.css';
import styles from './FullBoard.module.css';

/**
 * The whole board, with room to read it.
 *
 * The menu panel shows five and sends people here for the rest. This is
 * deliberately a page rather than a taller panel or a modal: a leaderboard is
 * something a player wants to link to and come back to, and neither of the other
 * two has an address.
 *
 * Which board is open comes in on the query string rather than resetting to the
 * default, so following "See the full board" from the Fastest tab does not
 * silently put you on Standings.
 */
export default function FullBoard({ initial }: { initial?: string }) {
  const [board, setBoard] = useState<BoardKind>(asBoard(initial));
  const [showGuide, setShowGuide] = useState(false);
  /**
   * How many rows this page has asked for so far.
   *
   * Per board, so switching tabs does not carry one board's appetite onto
   * another and quietly fetch fifty rows of something nobody looked at.
   */
  const [wanted, setWanted] = useState<Partial<Record<BoardKind, number>>>({});
  const limit = wanted[board] ?? PAGE_LIMIT;
  const scope = useScope();
  const friendly = scope === 'friends';

  /**
   * The country the viewer chose, which is the only one this toggle can show.
   *
   * A country board is not a place you browse to — it is *your* country's
   * board, exactly as the friends board is your friends. Somebody who has set
   * none is offered no Country segment at all, so `mine` being absent here and
   * the segment being hidden are the same fact.
   */
  const mine = useServerProfile().profile?.country;
  /**
   * Standings only, because that is the only board with a country index.
   *
   * The other three are ordered by indexes with no country partition, so
   * scoping them is not a filter away — it is another index each. Passing the
   * code anyway would have the API ignore it and answer globally, and the page
   * would caption a global board with a country name. Better to say so.
   */
  const inCountry = scope === 'country' && board === 'standings' ? mine : undefined;
  const countryUnavailable = scope === 'country' && board !== 'standings';

  /**
   * Both hooks run every render, and only one of them does any work.
   *
   * Hooks cannot be called conditionally, and the alternative — a wrapper
   * component per scope — would unmount and refetch the global board every time
   * somebody glanced at their friends and came back. `useFriendBoard` is told
   * whether it is on screen and fetches nothing when it is not, so the idle one
   * costs a render and no request.
   */
  const global = useBoard(board, limit, inCountry);
  const friends = useFriendBoard(board, friendly);

  const entries = friendly ? friends.entries : global.entries;
  const status = friendly ? friends.status : global.status;
  // Friends boards are never paged: the whole list is already in memory, and
  // nobody has more friends than a page holds.
  const hasMore = friendly ? false : global.hasMore;
  const meta = BOARD_META[board];

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/" className={styles.back}>‹ Back to the game</Link>
        <h1 className={`${styles.title} pixel-font`}>{meta.heading}</h1>
      </header>

      <div className={`panel ${styles.board}`}>
        {/*
          * Global or friends. Above the tabs because it is the wider question:
          * who is being measured, then what is being measured.
          */}
        <BoardScope hasCountry={Boolean(mine)} />

        <div className={panel.tabs} role="tablist" aria-label="Leaderboard">
          {BOARDS.map((kind) => (
            <button
              key={kind}
              role="tab"
              aria-selected={kind === board}
              className={`${panel.tab} pixel-font`}
              data-active={kind === board || undefined}
              onClick={() => setBoard(kind)}
            >
              {BOARD_META[kind].tab}
            </button>
          ))}
        </div>

        {status === 'loading' && (
          <p className={panel.empty}>Loading the {meta.heading.toLowerCase()}…</p>
        )}

        {status === 'unavailable' && (
          <p className={panel.empty}>The board is unreachable right now.</p>
        )}

        {status === 'ready' && entries?.length === 0 && (
          <p className={panel.empty}>{meta.empty}</p>
        )}

        {/*
          * The two states only a friends board has, and both are prompts rather
          * than errors — somebody who has just found this toggle has hit the one
          * case where it cannot do anything, so the message is the way out.
          */}
        {countryUnavailable && (
          <p className={panel.empty}>
            {countryName(mine ?? '')} rankings are on the standings board only,
            for now.
          </p>
        )}

        {status === 'anonymous' && (
          <p className={panel.empty}>
            Sign in to see how you and your friends compare.
          </p>
        )}
        {status === 'noFriends' && (
          <p className={panel.empty}>
            No friends yet, so there is nobody to rank against.
            <Link href="/profile" className={panel.scopeEmpty}>Add a friend</Link>
          </p>
        )}

        {status === 'ready' && !countryUnavailable && entries && entries.length > 0 && (
          /*
           * The one part of the cabinet that moves.
           *
           * The frame — header, tabs, footnote, the way out — stays fixed like
           * every other screen in the game, and the rows scroll inside this
           * window. A page that scrolled wholesale read as a website wearing
           * the game's clothes; a fixed machine with a moving window of rows
           * reads as an arcade board, which is what it is.
           */
          <div className={styles.window}>
            <BoardRows entries={entries} board={board} />
          </div>
        )}

        {/*
          * A button rather than fetching as the page scrolls.
          *
          * Infinite scroll would put everything below the rows permanently out
          * of reach — the footnote, the guide, the note about the cap all live
          * down there — and a leaderboard is somewhere people want to stop and
          * read rather than fall through. It is also reachable by keyboard,
          * which a scroll listener is not.
          */}
        {status === 'ready' && hasMore && (
          <button
            type="button"
            className={panel.footLink}
            onClick={() => setWanted((n) => ({ ...n, [board]: limit + PAGE_LIMIT }))}
          >
            Show more
          </button>
        )}

        {board === 'weekly' && (
          <p className={panel.resetChip}>
            <span className={panel.resetChipLabel}>NEW SCRIPT IN</span>
            <span className="pixel-font">{untilRollover()}</span>
          </p>
        )}
        <p className={panel.footnote}>{meta.footnote}</p>

        <button type="button" className={panel.footLink} onClick={() => setShowGuide(true)}>
          How the boards work
        </button>
      </div>

      {/*
        * Said out loud, and now said accurately.
        *
        * This read "more will appear here as the board grows", which implied the
        * cap was the size of the player base. It was not: the route returned ten
        * rows and no more, so by the time fifteen accounts had reached the board
        * five of them could not find themselves and the page was explaining that
        * away as a lack of players. A note that is wrong is worse than no note,
        * because it stops the reader asking.
        */}
      {/*
        * Only when there are rows to count, which the first version of this got
        * wrong the moment the friends toggle existed: a signed-out visitor was
        * told to sign in and then, directly underneath, that the page was
        * "showing all 0 ranked players". That is the exact failure the comment
        * above describes — a note that is wrong stops the reader asking.
        *
        * The friends wording is its own sentence rather than the same one with a
        * different number. "All 4 ranked players" on a board of your friends
        * reads as a claim about the game having four players in it.
        */}
      {status === 'ready' && !countryUnavailable && (entries?.length ?? 0) > 0 && (
        <p className={styles.note}>
          {friendly
            ? `Showing you and ${entries!.length - 1} of your friends.`
            : hasMore
              ? `Showing the top ${entries!.length}.`
              : `Showing all ${entries!.length} ranked players.`}
        </p>
      )}

      {showGuide && <BoardGuide onClose={() => setShowGuide(false)} />}
    </main>
  );
}
