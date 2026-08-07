'use client';

import { completedCount, MODULE_IDS, nextModuleId, moduleById } from '@/game/learnPath';
import { flameLabel, flameStage, flameHeat } from '@/game/flame';
import { bestServerSnapshot, bestSnapshot, subscribeBest } from '@/game/warmupBest';
import {
  bestOverall, subscribeTests, testsServerSnapshot, testsSnapshot,
} from '@/game/typingTest';
import { useSyncExternalStore } from 'react';
import PathFlame from './PathFlame';
import styles from './LearnHub.module.css';

export interface LearnHubProps {
  /**
   * The player's module progress, or undefined when the path is not available
   * here at all — the flag is off, or this is a touch device.
   *
   * Undefined is not an error state. The two doors that remain are the two the
   * path never owned: bots have been in this game since before it, and the
   * warm-up asks nothing of anybody. Taking the path away must not take
   * practice with it.
   */
  progress?: string;
  onPath: () => void;
  onWarmup: () => void;
  onTest: () => void;
  onBots: () => void;
  onBack: () => void;
}

/**
 * One door on the menu, three rooms behind it.
 *
 * Bot practice used to unfold its six-rung roster inside the menu itself,
 * which is where the menu's crowding came from, and the path sat beside it as
 * a peer. They are not peers with the duel; they are the two halves of the
 * same thing, which is the part of this game where nothing is at stake.
 *
 * The three are ordered by how much they ask of you, which is also the order a
 * nervous typist needs them in: a curriculum that starts from nothing, a
 * screen with no pressure at all, then an opponent. Somebody who already types
 * is looking for the third and will find it in one glance; somebody who does
 * not is looking for the first and would not have found it at all if the menu
 * still said Practice.
 */
export default function LearnHub({
  progress, onPath, onWarmup, onTest, onBots, onBack,
}: LearnHubProps) {
  const best = useSyncExternalStore(subscribeBest, bestSnapshot, bestServerSnapshot);
  /* The fastest across all three lengths, so the door has one line rather
     than three. Which length it came from is the test screen's business. */
  useSyncExternalStore(subscribeTests, testsSnapshot, testsServerSnapshot);
  const topSpeed = bestOverall();

  const done = completedCount(progress);
  const next = nextModuleId(progress);
  const heat = flameHeat(progress);
  const stage = flameStage(progress);

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <button className={styles.back} onClick={onBack}>← Menu</button>
        <h1 className={`${styles.title} pixel-font`}>
          {progress === undefined ? 'Practice' : 'Learn to type'}
        </h1>
        {/*
          * This said "ranked, timed or on the board" until the typing test
          * arrived, at which point one third of it became false: the test is
          * timed, deliberately and prominently. The promise worth keeping is
          * the one about consequences, not the one about clocks, so the line
          * now says only what is still true of every door behind it.
          */}
        <p className={styles.note}>
          Nothing here is ranked, recorded against you, or on the board.
        </p>
      </header>

      <div className={styles.doors}>
        {progress !== undefined && (
          <button className={styles.door} data-door="path" onClick={onPath}>
            {/* The flame is the path's own mark and the only progress anybody
                carries between sessions, so it belongs on the door rather than
                behind it. */}
            {/* `contained`, because this is being looked at rather than sat
                behind: without it the flame sizes to the viewport and the card
                becomes the thing that gets clipped. */}
            <span className={styles.art}>
              <PathFlame heat={heat} stage={stage} offset={0} contained />
            </span>
            <span className={styles.doorBody}>
              <strong className={`${styles.doorTitle} pixel-font`}>The path</strong>
              <span className={styles.doorNote}>
                Twelve modules, the whole keyboard, one row at a time.
              </span>
              <span className={styles.doorState}>
                {done === 0
                  ? 'Start at the home row'
                  : done === MODULE_IDS.length
                    ? `All twelve done · ${flameLabel(stage)}`
                    : `${done} of ${MODULE_IDS.length} done${
                      next ? ` · next up, ${moduleById(next)?.title.toLowerCase()}` : ''
                    }`}
              </span>
            </span>
          </button>
        )}

        <button className={styles.door} data-door="warmup" onClick={onWarmup}>
          <span className={styles.art} aria-hidden="true">
            <span className={`${styles.glyph} pixel-font`}>∞</span>
          </span>
          <span className={styles.doorBody}>
            <strong className={`${styles.doorTitle} pixel-font`}>Warm-up</strong>
            <span className={styles.doorNote}>
              No clock, no health, no end. Words keep coming; keep the streak
              alive.
            </span>
            <span className={styles.doorState}>
              {best > 0 ? `Best streak, ${best} words` : 'Nothing to beat yet'}
            </span>
          </span>
        </button>

        {/*
          * Between the warm-up and the bots, because that is where it falls on
          * the same scale the other three are ordered by: how much it asks of
          * you. The warm-up asks nothing, this asks you to be measured, and an
          * opponent asks you to be measured by somebody else.
          */}
        <button className={styles.door} data-door="test" onClick={onTest}>
          <span className={styles.art} aria-hidden="true">
            <span className={`${styles.glyph} pixel-font`}>30</span>
          </span>
          <span className={styles.doorBody}>
            <strong className={`${styles.doorTitle} pixel-font`}>Typing test</strong>
            <span className={styles.doorNote}>
              Thirty, forty-five or sixty seconds. Find out how fast you
              actually type.
            </span>
            <span className={styles.doorState}>
              {topSpeed > 0 ? `Best, ${topSpeed} wpm` : 'Nothing to beat yet'}
            </span>
          </span>
        </button>

        <button className={styles.door} data-door="bots" onClick={onBots}>
          <span className={styles.art} aria-hidden="true">
            <span className={`${styles.glyph} pixel-font`}>VS</span>
          </span>
          <span className={styles.doorBody}>
            <strong className={`${styles.doorTitle} pixel-font`}>Bots</strong>
            <span className={styles.doorNote}>
              Six opponents, 34 to 150 words a minute. Beat one, then pick the
              next.
            </span>
            <span className={styles.doorState}>Unranked, every time</span>
          </span>
        </button>
      </div>
    </main>
  );
}
