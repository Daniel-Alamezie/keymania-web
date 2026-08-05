'use client';

import { useEffect, useMemo, useRef } from 'react';
import { moduleById, type ModuleId } from '@/game/learnPath';
import { BOT_PROFILES } from '@/game/constants';
import { audio } from '@/game/audio';
import { badgeSrc, type Cosmetic } from '@/models/cosmetics';
import styles from './ModuleComplete.module.css';

export interface ModuleCompleteProps {
  module: ModuleId;
  /** What the whole module was just passed at, 1 to 3. */
  stars: number;
  /** The boss fight's speed, for the line that points at the bots. */
  wpm: number | null;
  /**
   * What the server actually granted, by id. Arrives a beat after the screen
   * does — the save is in flight when this mounts — and that is fine: the
   * stars land first, then the reward reveals, which is the right order for
   * a moment anyway.
   */
  granted: string[];
  /** The served catalogue, for turning granted ids into things with faces. */
  catalogue: Cosmetic[] | undefined;
  signedIn: boolean;
  /** The next module, if one exists to continue into. */
  onContinue: () => void;
  onBack: () => void;
}

/**
 * The moment after the boss falls.
 *
 * This screen exists because beating a boss used to teleport the player to
 * the ladder the instant the last word landed — no banner, no reward, the
 * kill blow cut off mid-swing. A path built entirely on the feeling of
 * earning something was skipping the feeling.
 *
 * Three beats, in a deliberate order. The stars pop in first, because they
 * are what was earned by skill. The reward reveals second, because it is a
 * consequence rather than the point. And the bot line lands last, because it
 * is the door out of the path and into the game — which is the entire reason
 * the path exists, and the sentence this screen most wants somebody to leave
 * on.
 *
 * The reward is whatever the SERVER said it granted, diffed off the save
 * response — never a client-side guess from a mirrored unlock table, which
 * would be one more thing to drift.
 */
export default function ModuleComplete({
  module, stars, wpm, granted, catalogue, signedIn, onContinue, onBack,
}: ModuleCompleteProps) {
  const meta = moduleById(module);

  /** The fanfare, once, when the screen arrives — not when the save lands. */
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    audio.moduleDone();
  }, []);

  const rewards = useMemo(
    () => granted
      .map((id) => catalogue?.find((item) => item.id === id))
      .filter((item): item is Cosmetic => Boolean(item)),
    [granted, catalogue],
  );

  /**
   * The line that costs nothing and lands hardest: measured against the
   * bots. The boss was a real timed duel, so the wpm is earned rather than
   * estimated, and "that clears Rookie" is checkable in a way no cosmetic is.
   */
  const botLine = useMemo(() => {
    if (!wpm || wpm <= 0) return null;
    const tiers = Object.values(BOT_PROFILES)
      .slice()
      .sort((a, b) => a.wpm - b.wpm);
    const cleared = [...tiers].reverse().find((tier) => wpm >= tier.wpm);
    if (cleared) {
      return `${wpm} wpm — that clears ${cleared.label}. Try a duel.`;
    }
    const first = tiers[0];
    return `${wpm} wpm. ${first.label} types at ${first.wpm} — you are ${first.wpm - wpm} away.`;
  }, [wpm]);

  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <p className={`${styles.kicker} pixel-font`}>BOSS BEATEN</p>
        <h1 className={`${styles.title} pixel-font`}>{meta?.title ?? module}</h1>

        <div className={styles.stars} aria-label={`${stars} of 3 stars`}>
          {Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className={`${styles.star}${i < stars ? ` ${styles.earned}` : ''}`}
              style={{ animationDelay: `${0.25 + i * 0.3}s` }}
              aria-hidden="true"
            >
              ★
            </span>
          ))}
        </div>

        {stars < 3 && (
          <p className={styles.note}>
            The rest are waiting — stars only ever go up.
          </p>
        )}

        {rewards.length > 0 && (
          <div className={styles.rewards}>
            <p className={`${styles.unlockLabel} pixel-font`}>UNLOCKED</p>
            {rewards.map((item) => (
              <div key={item.id} className={styles.reward}>
                {item.kind === 'badge' && item.value && (
                  <img src={badgeSrc(item.value)} alt="" width={48} height={48} />
                )}
                {item.kind === 'nameColour' && (
                  <span className={`${styles.swatch} pixel-font`} style={{ color: item.value }}>
                    Abc
                  </span>
                )}
                {item.kind === 'title' && (
                  <span className={`${styles.titleChip} pixel-font`}>{item.label}</span>
                )}
                <span className={styles.rewardName}>
                  <strong>{item.label}</strong>
                  <span>{item.kind === 'nameColour' ? 'name colour' : item.kind}</span>
                </span>
              </div>
            ))}
            <p className={styles.wearNote}>Wear it from your profile.</p>
          </div>
        )}

        {!signedIn && (
          <p className={styles.note}>
            The unlocks for this live on an account — sign in and this run
            counts towards them.
          </p>
        )}

        {botLine && <p className={`${styles.botLine} pixel-font`}>{botLine}</p>}

        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={onContinue}>Keep going</button>
          <button className="btn btn-ghost" onClick={onBack}>Back to the path</button>
        </div>
      </div>
    </main>
  );
}
