'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBoard } from '@/game/useBoard';
import { asBoard, BOARDS, BOARD_META, PAGE_LIMIT, type BoardKind } from '@/models/leaderboard';
import BoardRows from './BoardRows';
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
  const { entries, status, hasMore } = useBoard(board, limit);
  const meta = BOARD_META[board];

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link href="/" className={styles.back}>‹ Back to the game</Link>
        <h1 className={`${styles.title} pixel-font`}>{meta.heading}</h1>
      </header>

      <div className={`panel ${styles.board}`}>
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

        {status === 'ready' && entries && entries.length > 0 && (
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
      <p className={styles.note}>
        {hasMore
          ? `Showing the top ${entries?.length ?? 0}.`
          : `Showing all ${entries?.length ?? 0} ranked players.`}
      </p>

      {showGuide && <BoardGuide onClose={() => setShowGuide(false)} />}
    </main>
  );
}
