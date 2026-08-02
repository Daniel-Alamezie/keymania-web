'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBoard } from '@/game/useBoard';
import { BOARDS, BOARD_META, DEFAULT_BOARD, PANEL_ROWS, type BoardKind } from '@/models/leaderboard';
import { untilRollover } from '@/game/weeklyClock';
import BoardRows from './BoardRows';
import BoardGuide from './BoardGuide';
import styles from './SidePanel.module.css';

/**
 * The global standings, as much of them as a menu column can carry.
 *
 * Three boards, and **standings leads**. It used to open on fastest-duel, which
 * turned out to be an incentive pointing the wrong way: a speed board is a
 * `max()`, so the correct play on reaching first place is to never duel again in
 * case you cannot repeat it. Rating only moves by playing, so that is the number
 * a new arrival sees first.
 *
 * Only the top few. A menu is somewhere you glance on the way to a duel, and a
 * full board there is a wall of other people's numbers between you and the
 * button you came for. The rest is a page away.
 *
 * Every figure is computed by the server from a game it refereed. Bot practice
 * is kept against a player's own record but never reaches any board, because a
 * result the browser reported about itself cannot be ranked.
 */
export default function LeaderboardPanel() {
  const [board, setBoard] = useState<BoardKind>(DEFAULT_BOARD);
  const [showGuide, setShowGuide] = useState(false);
  const { entries, status } = useBoard(board);
  const meta = BOARD_META[board];

  const shown = entries?.slice(0, PANEL_ROWS);
  /** Only worth offering the page when it would actually show more. */
  const hasMore = (entries?.length ?? 0) > PANEL_ROWS;

  return (
    <aside className={`panel ${styles.side}`}>
      {/* The heading is the tab strip, so the panel keeps its place on the arena
          screen rather than growing a second box above itself. Same pattern as
          the record panel opposite. */}
      <div className={styles.tabs} role="tablist" aria-label="Leaderboard">
        {BOARDS.map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={kind === board}
            className={`${styles.tab} pixel-font`}
            data-active={kind === board || undefined}
            onClick={() => setBoard(kind)}
          >
            {BOARD_META[kind].tab}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <p className={styles.empty}>Loading the {meta.heading.toLowerCase()}…</p>
      )}

      {status === 'unavailable' && (
        <p className={styles.empty}>The board is unreachable right now.</p>
      )}

      {status === 'ready' && entries?.length === 0 && (
        <p className={styles.empty}>{meta.empty}</p>
      )}

      {status === 'ready' && shown && shown.length > 0 && (
        <BoardRows entries={shown} board={board} />
      )}

      {/* Only once there is something past the cap, so it never promises a page
          that shows exactly what you are already looking at. */}
      {status === 'ready' && hasMore && (
        <Link href={`/leaderboard?board=${board}`} className={styles.footLink}>
          See the full board
        </Link>
      )}

      {/* A deadline, dressed as one. Coarse on purpose - never seconds -
          so it does not tick while somebody reads. */}
      {board === 'weekly' && (
        <p className={styles.resetChip}>
          <span className={styles.resetChipLabel}>NEW SCRIPT IN</span>
          <span className="pixel-font">{untilRollover()}</span>
        </p>
      )}

      <p className={styles.footnote}>{meta.footnote}</p>

      {/*
        * Its own control, below the footnote rather than inside it.
        *
        * It started as an underlined phrase at the end of that sentence, in the
        * same faint grey, and nobody read it as clickable: an underline inside a
        * run of small print is camouflage, not an affordance. Out of the
        * paragraph and given a border, it is shaped like the buttons everywhere
        * else on the screen.
        *
        * Still a button and not an anchor, because it opens a panel in place
        * rather than going anywhere, and a link that does not navigate misleads
        * the status bar and anybody listening to the page.
        */}
      <button type="button" className={styles.footLink} onClick={() => setShowGuide(true)}>
        How the boards work
      </button>

      {showGuide && <BoardGuide onClose={() => setShowGuide(false)} />}
    </aside>
  );
}
