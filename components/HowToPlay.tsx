'use client';

import { useEffect, useState } from 'react';
import PixelSprite from './PixelSprite';
import styles from './HowToPlay.module.css';

/**
 * The rules, paged.
 *
 * Split into steps rather than one wall of text: each page carries a single
 * idea and a picture of it, so a new player can skim the whole thing in under
 * a minute and still know what the glowing words do.
 */
interface HowToPlayProps {
  onClose: () => void;
}

const PAGES = [
  {
    title: 'Type, then commit',
    body: (
      <>
        Type each word, then press <kbd className="kbd">SPACE</kbd> to commit it.
        That is the moment a blade is forged and hurled at your opponent.
      </>
    ),
    visual: <SentenceDemo />,
  },
  {
    title: 'Chain words, grow the blade',
    body: (
      <>
        Finish words quickly, one after another, and your blade upgrades. Pause
        longer than a couple of seconds and the streak lapses.
      </>
    ),
    visual: <BladeLadder />,
  },
  {
    title: 'A typo shatters the streak',
    body: (
      <>
        A wrong key never moves you forward — you have to fix it, which costs
        time. Your combo drops straight back to zero.
      </>
    ),
    visual: <ComboBreak />,
  },
  {
    title: 'Charged words grant powers',
    body: (
      <>
        Roughly one word in nine glows gold. Type it correctly and its power
        fires immediately — there is nothing else to press.
      </>
    ),
    visual: <PowerRow />,
  },
  {
    title: 'Empty their health to win',
    body: (
      <>
        You are always on the left, your opponent on the right. Land enough
        blades to empty their bar before they empty yours.
      </>
    ),
    visual: <VersusDemo />,
  },
];

export default function HowToPlay({ onClose }: HowToPlayProps) {
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={`panel ${styles.guide}`} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={`${styles.title} pixel-font`}>How to play</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close guide">✕</button>
        </header>

        {/* Keyed so each page animates in rather than swapping silently. */}
        <div key={page} className={styles.page}>
          <div className={styles.visual}>{current.visual}</div>
          <h3 className={`${styles.pageTitle} pixel-font`}>{current.title}</h3>
          <p className={styles.body}>{current.body}</p>
        </div>

        <footer className={styles.foot}>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Back
          </button>

          <div className={styles.dots}>
            {PAGES.map((p, i) => (
              <button
                key={p.title}
                className={styles.dot}
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
   Page visuals — built from the same pieces the game uses, so the guide shows
   the real thing rather than an illustration that can drift out of date.
   --------------------------------------------------------------------------- */

function SentenceDemo() {
  return (
    <div className={styles.demo}>
      <span className={styles.demoWordDone}>sharpen</span>
      <span className={styles.demoWordActive}>
        <span className={styles.demoDone}>bla</span>
        <span className={styles.demoCaret}>d</span>
        <span className={styles.demoPending}>e</span>
      </span>
      <span className={styles.demoWordAhead}>before</span>
      <div className={styles.spaceKey}>
        <span className="kbd">SPACE</span>
        <small>commits the word</small>
      </div>
    </div>
  );
}

function BladeLadder() {
  return (
    <div className={styles.ladder}>
      {[1, 2, 3, 4, 5].map((tier) => (
        <div key={tier} className={styles.rung}>
          <PixelSprite name={`blade-${tier}` as 'blade-1'} height={14 + tier * 3} />
          <span className={styles.rungLabel}>x{[0, 2, 4, 6, 9][tier - 1]}</span>
        </div>
      ))}
    </div>
  );
}

function ComboBreak() {
  return (
    <div className={styles.demo}>
      <span className={styles.demoWordActive}>
        <span className={styles.demoDone}>bla</span>
        <span className={styles.demoWrong}>z</span>
      </span>
      <div className={styles.comboBreak}>
        <span className={styles.comboWas}>x7</span>
        <span className={styles.comboArrow}>→</span>
        <span className={styles.comboNow}>x0</span>
      </div>
    </div>
  );
}

function PowerRow() {
  const powers = [
    { name: 'power-ward', label: 'Ward', blurb: 'blocks the next blade' },
    { name: 'power-surge', label: 'Surge', blurb: 'next blade hits double' },
    { name: 'power-mend', label: 'Mend', blurb: 'restores health' },
  ] as const;

  return (
    <div className={styles.powers}>
      {powers.map((power) => (
        <div key={power.name} className={styles.power}>
          <PixelSprite name={power.name as 'power-ward'} height={30} />
          <span className={`${styles.powerLabel} pixel-font`}>{power.label}</span>
          <small className={styles.powerBlurb}>{power.blurb}</small>
        </div>
      ))}
    </div>
  );
}

function VersusDemo() {
  return (
    <div className={styles.versus}>
      <div className={styles.side}>
        <PixelSprite name="fighter-blue" height={54} />
        <span className={styles.sideLabel} data-side="you">YOU</span>
        <div className={styles.bar}><span style={{ width: '78%' }} data-team="you" /></div>
      </div>
      <span className={`${styles.vs} pixel-font`}>VS</span>
      <div className={styles.side}>
        <PixelSprite name="fighter-red" height={54} />
        <span className={styles.sideLabel} data-side="them">RIVAL</span>
        <div className={styles.bar}><span style={{ width: '34%' }} data-team="them" /></div>
      </div>
    </div>
  );
}
