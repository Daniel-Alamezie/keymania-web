'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hands from './Hands';
import { fingerLabel } from '@/game/fingers';
import { audio } from '@/game/audio';
import { track } from '@/game/analytics';
import { markSeen } from '@/game/tutorialSeen';
import styles from './Tutorial.module.css';

/**
 * How to hold your hands, before anything asks you to type.
 *
 * Two acts, and the order is the story.
 *
 * **Act one is the bumps.** Every keyboard in the world carries a raised
 * ridge on F and on J, and most people have never consciously noticed the
 * thing their index fingers have been resting on for years. It is the single
 * most physical fact in touch typing — the whole skill hangs off being able
 * to find home without looking — so it gets the whole screen: two giant keys
 * that visibly answer the real presses, then a beat where both must be found
 * together with eyes on the screen. Felt, not read.
 *
 * **Act two is the walk**: each finger named and pressed once, on the same
 * hand diagram the lessons use afterwards.
 *
 * Nothing here is worth a star, and that is the design. It is information,
 * not an exercise: it stores nothing, cannot be failed, and cannot be rushed.
 * A wrong key does nothing at all — no miss, no shake, no count — because
 * punishing a stray press on the screen built to make somebody comfortable
 * would be exactly backwards.
 */

/** The home row, left to right, then the space bar. One step per finger. */
const HOME = [...'asdfjkl;', ' '];

/** Act one's beats, then the finger walk. */
type Act =
  | 'story' | 'find-f' | 'find-j' | 'both' | 'home'
  | 'spread-left' | 'spread-right' | 'placed'
  | 'walk';

/**
 * The rolls that seat each hand. From the landmark outward-in on the left
 * (little finger first, ending on the F it already knows) and inward-out on
 * the right — both are the natural drum of fingers on a table, and neither
 * can be done comfortably unless the hand is actually resting where it
 * should be. That is the point: the roll is the placement, proved.
 */
const LEFT_ROLL = ['a', 's', 'd', 'f'];
const RIGHT_ROLL = ['j', 'k', 'l', ';'];

export interface TutorialProps {
  onDone: () => void;
  onExit: () => void;
}

export default function Tutorial({ onDone, onExit }: TutorialProps) {
  const [act, setAct] = useState<Act>('story');
  const [at, setAt] = useState(0);

  /** The giant keys mirror the real ones: down while held, lit once found. */
  const [fDown, setFDown] = useState(false);
  const [jDown, setJDown] = useState(false);
  const [found, setFound] = useState({ f: false, j: false });
  /** How far through the current hand's roll. */
  const [rollAt, setRollAt] = useState(0);

  const actRef = useRef(act);
  useEffect(() => { actRef.current = act; }, [act]);
  const atRef = useRef(at);
  useEffect(() => { atRef.current = at; }, [at]);
  const downRef = useRef({ f: false, j: false });
  /**
   * The both-at-once beat only counts after both keys have been UP since the
   * act began. Without this, the J still held from the previous beat would
   * complete it instantly, and the one thing this act teaches — leave, then
   * find home again by touch — would never have happened.
   */
  const armedRef = useRef(false);
  const rollRef = useRef(0);

  /** Enter a hand's roll from the start, wherever it is entered from. */
  const beginRoll = useCallback((next: Act) => {
    rollRef.current = 0;
    setRollAt(0);
    setAct(next);
  }, []);

  const finished = act === 'walk' && at >= HOME.length;
  const wanted = act === 'walk' && at < HOME.length ? HOME[at] : undefined;

  useEffect(() => { if (finished) markSeen(); }, [finished]);

  /* The funnel starts here: how many who open the path read the tutorial at
     all, and how many of those reach the end of it. */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track({ name: 'learn_tutorial', step: 'started' });
  }, []);
  useEffect(() => {
    if (finished) track({ name: 'learn_tutorial', step: 'finished' });
  }, [finished]);
  useEffect(() => { if (act === 'both') armedRef.current = false; }, [act]);


  const advance = useCallback(() => {
    setAt((was) => Math.min(HOME.length, was + 1));
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return; }

      const key = e.key.toLowerCase();
      if (key === 'f' || key === 'j') {
        downRef.current[key] = true;
        (key === 'f' ? setFDown : setJDown)(true);
      }

      const phase = actRef.current;

      if (phase === 'story') return;

      if (phase === 'find-f') {
        if (key === 'f') { e.preventDefault(); audio.key(0); setFound((s) => ({ ...s, f: true })); setAct('find-j'); }
        return;
      }

      if (phase === 'find-j') {
        if (key === 'j') { e.preventDefault(); audio.key(1); setFound((s) => ({ ...s, j: true })); setAct('both'); }
        return;
      }

      if (phase === 'both') {
        if ((key === 'f' || key === 'j')
          && armedRef.current
          && downRef.current.f && downRef.current.j) {
          e.preventDefault();
          audio.lessonDone();
          setAct('home');
        }
        return;
      }

      if (phase === 'home') {
        if (key === ' ' || e.key === 'Enter') { e.preventDefault(); beginRoll('spread-left'); }
        return;
      }

      if (phase === 'spread-left' || phase === 'spread-right') {
        const roll = phase === 'spread-left' ? LEFT_ROLL : RIGHT_ROLL;
        const idx = rollRef.current;
        /* Only the next key in the roll advances; anything else is ignored
           rather than punished — same rule as everywhere on this screen. */
        if (key !== roll[idx]) return;
        e.preventDefault();
        audio.key(idx + (phase === 'spread-right' ? LEFT_ROLL.length : 0));
        const next = idx + 1;
        if (next < roll.length) {
          rollRef.current = next;
          setRollAt(next);
          return;
        }
        if (phase === 'spread-left') {
          beginRoll('spread-right');
        } else {
          audio.lessonDone();
          setAct('placed');
        }
        return;
      }

      if (phase === 'placed') {
        if (key === ' ' || e.key === 'Enter') { e.preventDefault(); setAct('walk'); }
        return;
      }

      /* The walk. */
      const step = atRef.current;
      if (step >= HOME.length) return;
      if (e.key.length !== 1) return;
      e.preventDefault();
      if (key !== HOME[step]) return;
      audio.key(step);
      advance();
    };

    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'f' || key === 'j') {
        downRef.current[key] = false;
        (key === 'f' ? setFDown : setJDown)(false);
      }
      /* Both hands off: the both-at-once beat is now armed. */
      if (actRef.current === 'both' && !downRef.current.f && !downRef.current.j) {
        armedRef.current = true;
      }
    };

    const onBlur = () => {
      downRef.current = { f: false, j: false };
      setFDown(false);
      setJDown(false);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [advance, beginRoll, onExit]);

  const inSpread = act === 'spread-left' || act === 'spread-right' || act === 'placed';
  const inActOne = act === 'story' || act === 'find-f' || act === 'find-j'
    || act === 'both' || act === 'home';

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <button className="btn btn-ghost" onClick={onExit}>← Path</button>
        <span className={styles.count}>
          {inActOne ? 'Finding home'
            : inSpread ? 'Taking position'
              : `${Math.min(at + 1, HOME.length)} / ${HOME.length}`}
        </span>
      </header>

      {/* Act one's stage: two keys, drawn big enough to be the whole story.
          They answer the real keyboard — down while held, lit once found. */}
      {inActOne && (
        <div className={styles.keys} aria-hidden="true">
          <div
            className={`${styles.bigKey} pixel-font`}
            data-down={fDown || undefined}
            data-lit={found.f || undefined}
            data-hint={(act === 'find-f' || act === 'both') || undefined}
          >
            F
            <i className={styles.bump} />
          </div>
          <div
            className={`${styles.bigKey} pixel-font`}
            data-down={jDown || undefined}
            data-lit={found.j || undefined}
            data-hint={(act === 'find-j' || act === 'both') || undefined}
          >
            J
            <i className={styles.bump} />
          </div>
        </div>
      )}

      {/* Act two's stage: the home row itself, as keycaps, one hand rolled
          into place at a time. The bumps stay drawn on F and J — the row is
          act one's landmarks with the rest of the hand grown around them. */}
      {inSpread && (
        <div className={styles.keyRow} aria-hidden="true">
          {LEFT_ROLL.map((key, i) => (
            <div
              key={key}
              className={`${styles.rowKey} pixel-font`}
              data-lit={(act !== 'spread-left' || i < rollAt) || undefined}
              data-hint={(act === 'spread-left' && i === rollAt) || undefined}
            >
              {key}
              {key === 'f' && <i className={styles.bumpSmall} />}
            </div>
          ))}
          <span className={styles.splitGap} />
          {RIGHT_ROLL.map((key, i) => (
            <div
              key={key}
              className={`${styles.rowKey} pixel-font`}
              data-lit={(act === 'placed' || (act === 'spread-right' && i < rollAt)) || undefined}
              data-hint={(act === 'spread-right' && i === rollAt) || undefined}
            >
              {key}
              {key === 'j' && <i className={styles.bumpSmall} />}
            </div>
          ))}
        </div>
      )}

      {act === 'walk' && (
        <div className={styles.stage}>
          <Hands next={wanted} />
        </div>
      )}

      <div className={styles.card}>
        {act === 'story' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>Two keys are different</h1>
            <p className={styles.body}>
              Run a fingertip along the middle row of your keyboard. On
              <strong> F</strong> and on <strong>J</strong> there is a small
              raised ridge, a bump you can feel.
            </p>
            <p className={styles.body}>
              Every keyboard in the world has them, and they exist for one
              reason: so your hands can find their place
              <strong> without your eyes</strong>.
            </p>
            <button className="btn btn-primary" onClick={() => setAct('find-f')}>
              I can feel them
            </button>
          </>
        )}

        {act === 'find-f' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>The left landmark</h1>
            <p className={styles.body}>
              Rest your <strong>left index finger</strong> on the bump,
              and press.
            </p>
            <p className={styles.prompt}>The key on screen will answer.</p>
          </>
        )}

        {act === 'find-j' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>The right landmark</h1>
            <p className={styles.body}>
              Now your <strong>right index finger</strong> on <strong>J</strong>.
            </p>
            <p className={styles.prompt}>Take your time. Nothing here is scored.</p>
          </>
        )}

        {act === 'both' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>Eyes off the keyboard</h1>
            <p className={styles.body}>
              Take your hands away from the keyboard. Now, without looking
              down, find the raised bumps again with your index fingers.
            </p>
            <p className={styles.body}>
              Your <strong>left index finger</strong> should be touching
              {' '}<strong>F</strong>, and your <strong>right index
              finger</strong> should be touching <strong>J</strong>. Press
              them both together.
            </p>
            <p className={styles.prompt}>This is the whole trick. Everything else is a reach.</p>
          </>
        )}

        {act === 'home' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>You found home</h1>
            <p className={styles.body}>
              Without looking. That is what the bumps buy you: your hands can always
              find this position, and every other key is a short reach from it.
            </p>
            <button className="btn btn-primary" onClick={() => beginRoll('spread-left')}>
              Where do the other fingers go?
            </button>
          </>
        )}

        {act === 'spread-left' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>The left hand falls into place</h1>
            <p className={styles.body}>
              Keep your index on <strong>F</strong>. The rest of the hand
              spreads outward, middle finger on <strong>D</strong>, ring on
              <strong> S</strong>, little finger on <strong>A</strong>.
            </p>
            <p className={styles.prompt}>
              Rest them there, then roll from the outside in:
              A, S, D, F, like drumming your fingers.
            </p>
          </>
        )}

        {act === 'spread-right' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>Now the right</h1>
            <p className={styles.body}>
              Index on <strong>J</strong>, middle on <strong>K</strong>, ring
              on <strong>L</strong>, little finger on the
              <strong> semicolon</strong>.
            </p>
            <p className={styles.prompt}>
              Roll from the inside out: J, K, L, ;
            </p>
          </>
        )}

        {act === 'placed' && (
          <>
            <h1 className={`${styles.title} pixel-font`}>That is the position</h1>
            <p className={styles.body}>
              Eight fingers on eight keys, thumbs resting on space. This is
              where your hands live now, and every other key is a reach that comes
              straight back here.
            </p>
            <button className="btn btn-primary" onClick={() => setAct('walk')}>
              Meet your fingers
            </button>
          </>
        )}

        {act === 'walk' && !finished && (
          <>
            <h1 className={`${styles.title} pixel-font`}>
              {HOME[at] === ' ' ? 'Space' : HOME[at].toUpperCase()}
            </h1>
            <p className={styles.body}>
              {HOME[at] === ' '
                ? (
                  <>The space bar belongs to your <strong>thumbs</strong>. Use
                    whichever is nearer. It makes no difference, as long as it is not a
                    finger.
                  </>
                )
                : <>Your <strong>{fingerLabel(HOME[at])}</strong>.</>}
            </p>
            <p className={styles.prompt}>
              Press it to carry on. Nothing here is timed or scored.
            </p>
          </>
        )}

        {finished && (
          <>
            <h1 className={`${styles.title} pixel-font`}>That is home</h1>
            <p className={styles.body}>
              Come back to it after every key. It feels slower than hunting, and it
              is the only thing that gets you past thirty words a minute. The
              lessons keep showing you which finger to use.
            </p>

            {/*
              * The scoring, drawn rather than described. Three rows of the
              * ladder — stars, what earns them, what they open — with the
              * full sentence on each row for a screen reader.
              */}
            <div className={styles.rules}>
              <div
                className={styles.step}
                aria-label="Finish every lesson: one star."
              >
                <span className={styles.stepStars} aria-hidden="true">
                  <i data-on>★</i><i>★</i><i>★</i>
                </span>
                <span className={styles.stepWhat} aria-hidden="true">finish every lesson</span>
                <span className={styles.stepOpens} aria-hidden="true" />
              </div>
              <div
                className={styles.step}
                aria-label="Stay above 95 percent: two stars, and the boss opens."
              >
                <span className={styles.stepStars} aria-hidden="true">
                  <i data-on>★</i><i data-on>★</i><i>★</i>
                </span>
                <span className={styles.stepWhat} aria-hidden="true">stay above 95%</span>
                <span className={styles.stepOpens} aria-hidden="true">
                  <span className={`${styles.chip} pixel-font`}>⚔ boss</span>
                </span>
              </div>
              <div
                className={styles.step}
                aria-label="Beat the boss: three stars, and the next module opens."
              >
                <span className={styles.stepStars} aria-hidden="true">
                  <i data-on>★</i><i data-on>★</i><i data-on>★</i>
                </span>
                <span className={styles.stepWhat} aria-hidden="true">beat the boss</span>
                <span className={styles.stepOpens} aria-hidden="true">
                  <span className={`${styles.chip} pixel-font`}>next module</span>
                </span>
              </div>
            </div>

            <p className={styles.prompt}>
              Stars only ever go up, so replaying costs nothing.
            </p>

            <button className="btn btn-primary" onClick={onDone}>Start module 1</button>
            <button className="btn btn-ghost" onClick={onExit}>Back to the path</button>
          </>
        )}
      </div>

      {/* Always available. Somebody who already touch types should not have to
          sit through this, and making them would be the first thing the path
          did to them. */}
      {!finished && (
        <button
          className={styles.skip}
          onClick={() => { track({ name: 'learn_tutorial', step: 'skipped' }); onExit(); }}
        >
          I already know this
        </button>
      )}
    </main>
  );
}
