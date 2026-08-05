'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  completedCount, MAX_STARS, MODULES, nextModuleId, nodeState, starsFor,
  type LearnModule, type ModuleId, type NodeState,
} from '@/game/learnPath';
import { contentFor, hasContent } from '@/game/curriculum';
import { flameHeat, flameLabel, flameStage } from '@/game/flame';
import { seenServerSnapshot, seenSnapshot, subscribeSeen } from '@/game/tutorialSeen';
import PathFlame from './PathFlame';
import styles from './Ladder.module.css';

export interface LadderProps {
  /** The progress string from the profile. Undefined for somebody new. */
  progress: string | undefined;
  onStart: (id: ModuleId) => void;
  /** The hand tutorial, which is a node here but not a module. */
  onTutorial: () => void;
  onExit: () => void;
  /**
   * The how-to-play guide, which the menu no longer links to directly.
   *
   * It lives here because Learn is the real answer to "new here?", and two
   * doors for one intention means most people pick neither. One level in, from
   * the screen somebody reached by asking that question, it is where the
   * remaining questions about the game itself belong.
   */
  onGuide: () => void;
}

/**
 * Which view of the path is being shown.
 *
 * Both are built rather than one being chosen up front, because the question
 * they answer is not the same and it was not obvious from a description which
 * wins. The list is navigation: twelve named things, in order, with the next
 * one marked — it says *what to do now*. The keyboard is the picture: keys
 * lighting up in groups as they are learned, which says *how much of this
 * machine you own*, and is the thing a list structurally cannot show.
 *
 * The list leads because the ladder's stated job is answering "where am I" at
 * a glance, and a keyboard answers "how far" instead — it takes a legend to
 * turn a lit key into a module you can start. The keyboard is the better
 * motivator and the worse menu, so it sits alongside rather than instead.
 */
type View = 'path' | 'keys';

/**
 * The board, as a beginner meets it.
 *
 * Four rows and no modifiers: this is a map of the keys the path teaches, not
 * a picture of a keyboard. Ctrl and Alt would be honest and would only make
 * every real key smaller on the screen that can least afford it.
 */
const ROWS = ['1234567890', 'qwertyuiop', "asdfghjkl;", 'zxcvbnm,.'] as const;

/** Which module introduces each key, for colouring the board. */
const OWNER = new Map<string, ModuleId>(
  MODULES.flatMap((module) => [...module.keys].map((key) => [key, module.id] as const)),
);

const Stars = ({ earned }: { earned: number }) => (
  <span className={styles.stars} aria-hidden="true">
    {Array.from({ length: MAX_STARS }, (_, i) => (
      <span key={i} className={styles.star} data-earned={i < earned || undefined}>★</span>
    ))}
  </span>
);

const FLAG: Record<NodeState, string> = {
  done: 'PASSED',
  next: 'START HERE',
  locked: 'LOCKED',
};

/**
 * A module that is open but has not been written yet.
 *
 * Distinct from locked, because the two mean opposite things to the player:
 * locked is "earn your way here", unwritten is "this is not ready and no
 * amount of typing will change that". Showing an unwritten module as locked
 * would send somebody grinding for a door that does not exist, and showing it
 * as startable would open onto nothing. It says SOON and refuses the tap.
 */
const SOON = 'SOON';


/**
 * How much work a module is, said before somebody commits to it.
 *
 * The shape is the same for every module by design -- three short lessons and
 * a boss, about five minutes on a first pass -- so an unwritten one can state
 * it honestly from the plan rather than staying silent. A written one counts
 * its own lessons instead, because that is the number that is actually true
 * and the plan is only a promise until it is.
 *
 * Worth saying at all because "twelve modules" is a number somebody reads as
 * either trivial or enormous depending on what they assume a module costs.
 * Five minutes is the answer that makes starting easy.
 */
function costOf(id: ModuleId): string {
  const content = contentFor(id);
  const lessons = content ? content.lessons.length : 3;
  return `${lessons} lessons and a boss, about 5 minutes`;
}

export default function Ladder({
  progress, onStart, onTutorial, onExit, onGuide,
}: LadderProps) {
  const seen = useSyncExternalStore(subscribeSeen, seenSnapshot, seenServerSnapshot);
  const [view, setView] = useState<View>('path');

  const frontier = nextModuleId(progress);
  const passed = completedCount(progress);

  /**
   * The module the keyboard view is talking about.
   *
   * Null means "whatever is next", which is the state somebody arrives in. A
   * lit key with no caption is a decoration; the caption is what makes the
   * keyboard usable as a menu at all.
   */
  const [picked, setPicked] = useState<ModuleId | null>(null);
  const focus: LearnModule | undefined = useMemo(() => {
    const id = picked ?? frontier;
    return MODULES.find((module) => module.id === id);
  }, [picked, frontier]);

  /**
   * Where the player actually is, and getting back to it.
   *
   * Twelve nodes do not fit a phone, and the scroll that fixes that is also
   * what loses somebody: the whole point of the list is answering "where am
   * I", and a list scrolled to an arbitrary offset answers it wrongly. So the
   * frontier is scrolled to on arrival, and a button offers the way back for
   * anybody who has scrolled off to see how much is left -- which they should,
   * because seeing the size of the thing is the other half of what a path is
   * for.
   */
  const here = useRef<HTMLButtonElement>(null);
  const [adrift, setAdrift] = useState(false);

  /**
   * The fire, and how far the list has travelled under it.
   *
   * One listener, on the element that actually scrolls, feeding the flame's
   * parallax. `requestAnimationFrame` coalesces it: scroll fires far faster
   * than paint on a trackpad, and setting state per event would re-render the
   * whole ladder dozens of times a second to move one background layer.
   */
  const screen = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(0);

  useEffect(() => {
    const node = screen.current;
    if (!node) return;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        setScrolled(node.scrollTop);
      });
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  const heat = flameHeat(progress);
  const stage = flameStage(progress);

  useEffect(() => {
    const node = here.current;
    if (!node) return;
    /* Instant, not smooth: this is the arrival position, not a journey. */
    node.scrollIntoView({ block: 'center' });

    const watch = new IntersectionObserver(
      ([entry]) => setAdrift(!entry.isIntersecting),
      { threshold: 0.6 },
    );
    watch.observe(node);
    return () => watch.disconnect();
  }, [view, frontier]);

  const startable = (id: ModuleId) => nodeState(progress, id) !== 'locked' && hasContent(id);

  const start = (id: ModuleId) => {
    if (!startable(id)) return;
    onStart(id);
  };

  return (
    <main className={styles.screen} ref={screen}>
      <PathFlame heat={heat} stage={stage} offset={scrolled} />

      <header className={styles.head}>
        <h1 className={`${styles.title} pixel-font`}>Learn to type</h1>
        {/* The flame's name in words: the shape is decoration and cannot be
            read, so the encouragement is said once here where it can be. */}
        <span className={styles.progress}>
          {passed} / {MODULES.length} · {flameLabel(stage)}
        </span>
        <button className="btn btn-ghost" onClick={onExit}>Back</button>
      </header>

      <div className={styles.views} role="tablist" aria-label="How to view the path">
        {(['path', 'keys'] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={view === option}
            className={`${styles.viewBtn} pixel-font`}
            data-on={view === option || undefined}
            onClick={() => setView(option)}
          >
            {option === 'path' ? 'PATH' : 'KEYBOARD'}
          </button>
        ))}
      </div>

      {view === 'path' ? (
        <div className={styles.path}>
          {/*
            * The hand tutorial, first and outside the map.
            *
            * A node, not a module: it awards nothing, so it has no progress
            * character and no entry in `MODULE_IDS` — which is what lets it
            * sit at the front without shifting every player's stars by one.
            *
            * It never locks and never shows stars, and it goes quiet once it
            * has been read, so it stops competing with the frontier for the
            * eye of somebody who is forty modules in and knows all this.
            */}
          <button
            className={styles.node}
            data-state="next"
            data-quiet={seen || undefined}
            onClick={onTutorial}
            aria-label="How to hold your hands. Information, no stars."
          >
            <span className={`${styles.pip} pixel-font`} aria-hidden="true">✋</span>
            <span className={styles.body}>
              <span className={`${styles.name} pixel-font`}>How this works</span>
              <span className={styles.teaches}>which finger presses which key</span>
              <span className={styles.cost}>a minute, and nothing is scored</span>
            </span>
            <span className={styles.tail}>
              <span className={`${styles.flag} pixel-font`}>{seen ? 'READ' : 'START HERE'}</span>
            </span>
          </button>

          {MODULES.map((module, at) => {
            const state = nodeState(progress, module.id);
            const stars = starsFor(progress, module.id);
            const written = hasContent(module.id);
            const flag = state !== 'locked' && !written ? SOON : FLAG[state];
            return (
              <button
                key={module.id}
                ref={module.id === frontier ? here : undefined}
                className={styles.node}
                data-state={state}
                data-soon={(state !== 'locked' && !written) || undefined}
                disabled={!startable(module.id)}
                onClick={() => start(module.id)}
                aria-label={`${module.title}. ${flag}.${
                  state === 'done' ? ` ${stars} of ${MAX_STARS} stars.` : ''
                }`}
              >
                <span className={`${styles.pip} pixel-font`} aria-hidden="true">
                  {state === 'locked' ? '🔒' : at + 1}
                </span>
                <span className={styles.body}>
                  <span className={`${styles.name} pixel-font`}>{module.title}</span>
                  <span className={styles.teaches}>{module.teaches}</span>
                  <span className={styles.cost}>{costOf(module.id)}</span>
                </span>
                <span className={styles.tail}>
                  {state === 'done' && <Stars earned={stars} />}
                  <span className={`${styles.flag} pixel-font`}>{flag}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className={styles.keyboard}>
            {ROWS.map((row) => (
              <div key={row} className={styles.krow}>
                {[...row].map((key) => {
                  const owner = OWNER.get(key);
                  /* A key no module claims stays dark rather than pretending
                     to be locked behind something that will never open it. */
                  const state = owner ? nodeState(progress, owner) : 'locked';
                  const owning = owner && MODULES.find((m) => m.id === owner);
                  return (
                    <button
                      key={key}
                      className={`${styles.key} pixel-font`}
                      data-state={state}
                      disabled={!owner || state === 'locked'}
                      onClick={() => owner && setPicked(owner)}
                      aria-label={owning ? `${key}, taught by ${owning.title}` : key}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className={styles.legend}>
            <span className={styles.swatch}>
              <span className={styles.chip} data-state="done" /> learned
            </span>
            <span className={styles.swatch}>
              <span className={styles.chip} data-state="next" /> next up
            </span>
            <span className={styles.swatch}>
              <span className={styles.chip} /> not yet
            </span>
          </div>

          {focus && (
            <div className={styles.focus}>
              <p className={`${styles.focusName} pixel-font`}>{focus.title}</p>
              <p className={styles.focusTeaches}>
                {focus.teaches}
                <br />
                {costOf(focus.id)}
              </p>
              <button
                className="btn btn-primary"
                disabled={!startable(focus.id)}
                onClick={() => start(focus.id)}
              >
                {!hasContent(focus.id) && nodeState(progress, focus.id) !== 'locked'
                  ? 'Not written yet'
                  : nodeState(progress, focus.id) === 'done' ? 'Practise again' : 'Start'}
              </button>
            </div>
          )}
        </>
      )}

      {adrift && frontier && (
        <button
          className={`${styles.jump} pixel-font`}
          onClick={() => here.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        >
          ↑ Back to where you are
        </button>
      )}

      <button className={styles.guide} onClick={onGuide}>
        How the game itself works
      </button>

      {!frontier && (
        <div className={styles.done}>
          <p className={`${styles.focusName} pixel-font`}>Every module passed</p>
          <p className={styles.focusTeaches}>
            Go back for the stars you left behind, or take it into a duel.
          </p>
        </div>
      )}
    </main>
  );
}
