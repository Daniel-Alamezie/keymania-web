'use client';

import { useEffect, useState } from 'react';
import {
  AZURE_FROM, GOLD_FROM, LOSS_POINTS, MAX_UPSET_BONUS,
  RATING_FLOOR, START_RATING, WIN_POINTS,
} from '@/models/rating';
import PixelSprite from './PixelSprite';
import RankFlame, { Flame } from './RankFlame';
import styles from './BoardGuide.module.css';

/**
 * How the boards work.
 *
 * Written because a rating nobody can explain is a rating nobody trusts, and an
 * unexplained one invites the assumption that the board rewards something other
 * than playing.
 *
 * **Paged, with a picture on every page.** The first cut was one scrolling
 * column of prose, which failed twice over: a scrollbar down the side of a
 * calm-looking panel is the least calm thing on the screen, and a wall of rules
 * is exactly what somebody opening a five-second question will not read. Each
 * page now carries one idea and a drawing of it, and no page scrolls.
 *
 * The drawings are the game's own sprites — the same animated flames and crowns
 * the board and profile already use — rather than illustrations, so they cannot
 * drift out of step with what a player actually sees. `HowToPlay` takes the same
 * approach for the same reason.
 *
 * Every figure is imported, never typed out. A hard-coded `+10` here would
 * survive any change to the scoring and go on confidently describing a system
 * that no longer exists.
 */
interface BoardGuideProps {
  onClose: () => void;
}

/** Signed, so the sign belongs to the number rather than to the prose. */
const signed = (points: number) => (points > 0 ? `+${points}` : `${points}`);

const PAGES = [
  {
    title: 'Two boards',
    body: (
      <>
        <strong>Standings</strong> is your rating — it moves every time you duel
        a person. <strong>Fastest</strong> is the quickest duel you have ever
        typed, so it only ever goes up.
      </>
    ),
    visual: <TwoBoards />,
  },
  {
    title: 'Rating moves both ways',
    body: (
      <>
        Everybody starts at {START_RATING}. Win a duel and you gain{' '}
        {WIN_POINTS}; lose one and you drop {Math.abs(LOSS_POINTS)}. It never
        falls below {RATING_FLOOR}, however badly a run goes.
      </>
    ),
    visual: <RatingSwing />,
  },
  {
    title: 'Beating someone better pays more',
    body: (
      <>
        Win against a player rated above you and you earn up to{' '}
        {MAX_UPSET_BONUS} extra — more the bigger the gap. The winner gets it and
        nobody else.
      </>
    ),
    visual: <Upset />,
  },
  {
    title: 'Bots never count',
    body: (
      <>
        Practice builds your own record, but never your rating — a bot duel
        happens entirely in your browser, so you are its only witness. Duels
        against people are refereed by the server.
      </>
    ),
    visual: <Refereed />,
  },
  {
    title: 'The flame is your band',
    body: (
      <>
        The flame beside a rating says which band it falls in. On the board
        itself, the top three get a crown for their position instead — those are
        the only three there are.
      </>
    ),
    visual: <FlameBands />,
  },
];

export default function BoardGuide({ onClose }: BoardGuideProps) {
  const [page, setPage] = useState(0);
  const last = PAGES.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setPage((p) => Math.min(last, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, last]);

  const current = PAGES[page];

  return (
    <div className={styles.boardOverlay} onClick={onClose}>
      <div
        className={`panel ${styles.boardSheet}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="How the boards work"
      >
        <header className={styles.boardHead}>
          <h2 className={`${styles.boardTitle} pixel-font`}>How the boards work</h2>
          <button className={styles.boardClose} onClick={onClose} aria-label="Close">✕</button>
        </header>

        {/* Keyed so each page animates in rather than swapping silently. */}
        <div key={page} className={styles.boardPage}>
          <div className={styles.boardVisual}>{current.visual}</div>
          <h3 className={`${styles.boardPageTitle} pixel-font`}>{current.title}</h3>
          <p className={styles.boardBody}>{current.body}</p>
        </div>

        <footer className={styles.boardFoot}>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Back
          </button>

          <div className={styles.boardDots}>
            {PAGES.map((p, i) => (
              <button
                key={p.title}
                className={styles.boardDot}
                data-active={i === page || undefined}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>

          {page === last ? (
            <button className="btn btn-primary" onClick={onClose}>Got it</button>
          ) : (
            <button className="btn" onClick={() => setPage((p) => Math.min(last, p + 1))}>
              Next
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Page visuals.
   Built from the sprites and components the game already uses, so the guide
   shows the real thing rather than a drawing of it that can go stale.
   --------------------------------------------------------------------------- */

/**
 * The two boards, side by side, as the rows a player will actually see.
 *
 * Same name on both on purpose: it is one player on two boards, which is the
 * point being made. The difference is which number is large and what the note
 * underneath says happens to it.
 */
function TwoBoards() {
  return (
    <div className={styles.boards}>
      {([
        { tab: 'Standings', score: 312, note: 'moves every duel' },
        { tab: 'Fastest', score: 128, note: 'only ever climbs' },
      ] as const).map((board) => (
        <div key={board.tab} className={styles.mini}>
          <span className={`${styles.miniTab} pixel-font`}>{board.tab}</span>
          <div className={styles.miniRow}>
            <RankFlame rank={1} height={17} />
            <span className={styles.miniName}>Bill</span>
            <span className={`${styles.miniScore} pixel-font`}>{board.score}</span>
          </div>
          <small className={styles.miniNote}>{board.note}</small>
        </div>
      ))}
    </div>
  );
}

/**
 * A rating with the two things that can happen to it.
 *
 * The arrows drift rather than sitting still, because "moves both ways" is the
 * whole content of the page and a static diagram says "here are two numbers".
 */
function RatingSwing() {
  return (
    <div className={styles.swing}>
      <span className={styles.swingGain}>{signed(WIN_POINTS)}</span>
      <span className={`${styles.swingNow} pixel-font`}>{START_RATING}</span>
      <span className={styles.swingLoss}>{signed(LOSS_POINTS)}</span>
      <small className={styles.swingFloor}>floor {RATING_FLOOR}</small>
    </div>
  );
}

/**
 * The upset: a lower rating beating a higher one.
 *
 * Two of the game's own characters rather than abstract boxes, and a blade
 * between them pointing the right way, so which one won is readable before the
 * numbers are.
 */
function Upset() {
  return (
    <div className={styles.upset}>
      <div className={styles.upsetSide}>
        <PixelSprite name="characters/rookie-1" height={42} />
        <span className={`${styles.upsetRating} pixel-font`}>300</span>
        <small className={styles.upsetWho}>you</small>
      </div>

      <div className={styles.upsetMid}>
        <PixelSprite name="blade-4" height={16} />
        <span className={styles.upsetBonus}>{signed(MAX_UPSET_BONUS)}</span>
      </div>

      <div className={styles.upsetSide}>
        <PixelSprite name="characters/baron-1" height={42} />
        <span className={`${styles.upsetRating} pixel-font`}>415</span>
        <small className={styles.upsetWho}>them</small>
      </div>
    </div>
  );
}

/**
 * What counts and what does not.
 *
 * The flame on the left is the tell: a duel against a person can move your
 * band, and the practice column has an empty slot where that would be rather
 * than a crossed-out one. Nothing is being taken away — it was never there.
 */
function Refereed() {
  return (
    <div className={styles.compare}>
      <div className={styles.compareCol} data-counts>
        <span className={styles.compareMark}><Flame kind="gold" height={22} /></span>
        <PixelSprite name="characters/wanderer-1" height={42} />
        <span className={styles.compareTag} data-counts>A person</span>
        <small className={styles.compareNote}>ranked</small>
      </div>

      <div className={styles.compareCol}>
        <span className={styles.compareMark} aria-hidden="true" />
        <PixelSprite name="characters/rookie-1" height={42} />
        <span className={styles.compareTag}>A bot</span>
        <small className={styles.compareNote}>practice only</small>
      </div>
    </div>
  );
}

/** The three bands, burning, with where each one starts. */
function FlameBands() {
  return (
    <div className={styles.bands}>
      {([
        { kind: 'ember', label: `under ${AZURE_FROM}` },
        { kind: 'azure', label: `${AZURE_FROM}+` },
        { kind: 'gold', label: `${GOLD_FROM}+` },
      ] as const).map((band) => (
        <div key={band.kind} className={styles.band}>
          <Flame kind={band.kind} height={26} />
          <span className={`${styles.bandLabel} pixel-font`}>{band.label}</span>
        </div>
      ))}
    </div>
  );
}
