'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBoard } from '@/game/useBoard';
import { asBoard, BOARDS, BOARD_META, type BoardKind } from '@/models/leaderboard';
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
  const { entries, status } = useBoard(board);
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
          <BoardRows entries={entries} board={board} />
        )}

        <p className={panel.footnote}>{meta.footnote}</p>

        <button type="button" className={panel.footLink} onClick={() => setShowGuide(true)}>
          How the boards work
        </button>
      </div>

      {/*
        * Said out loud rather than left to be discovered.
        *
        * The board is capped at ten by the API, which is plenty while there are
        * a handful of ranked players and will stop being plenty. Saying so now
        * means nobody spends time wondering whether they are missing rows or
        * whether the page is broken.
        */}
      <p className={styles.note}>
        Showing the top {entries?.length ?? 10}. More will appear here as the
        board grows.
      </p>

      {showGuide && <BoardGuide onClose={() => setShowGuide(false)} />}
    </main>
  );
}
