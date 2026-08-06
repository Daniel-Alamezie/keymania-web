'use client';

import { BOT_CHARACTERS, BOT_PROFILES } from '@/game/constants';
import { BOT_UNLOCK_WPM, isBotUnlocked, suggestedBot } from '@/game/botLadder';
import { characterFrame } from '@/models/character';
import { DIFFICULTIES, type Difficulty } from '@/models/bot';
import PixelSprite from './PixelSprite';
import styles from './Bots.module.css';

export interface BotsProps {
  /** The player's own best speed, which is what opens the top three. */
  bestWpm: number;
  /** Which one is mid-ignition, so the flame plays on that card alone. */
  igniting: Difficulty | null;
  onPick: (id: Difficulty) => void;
  onBack: () => void;
}

/**
 * The six opponents, with their faces.
 *
 * This was six text buttons unfolding inside the menu, which is where the menu
 * got its cramped feeling from: a whole roster squeezed into the space of one
 * option. Given a screen, it can do the thing the roster was always for.
 *
 * **The portraits already existed.** `BOT_CHARACTERS` gave every difficulty its
 * own character a while back, so that a bot duel stopped being two identical
 * figures throwing knives at each other. It was drawn in the arena and nowhere
 * else, so the moment you actually chose an opponent was the one moment you
 * could not see them. That is the gap this closes; no new art was needed for
 * it.
 *
 * The ladder rule is unchanged and worth restating, because the screen has to
 * explain it: the top three open on YOUR speed, not on beating the one below.
 * See `botLadder` for why — a win that opens a tier gets evicted from a capped
 * history, and the ladder would silently close again behind you.
 */
export default function Bots({ bestWpm, igniting, onPick, onBack }: BotsProps) {
  const suggestion = suggestedBot(bestWpm);

  return (
    <main className={styles.screen}>
      <header className={styles.head}>
        <button className={styles.back} onClick={onBack}>← Back</button>
        <h1 className={`${styles.title} pixel-font`}>Pick a fight</h1>
        <p className={styles.note}>
          Nothing here touches your rating or the board. Lose as often as you
          like.
        </p>
      </header>

      <ul className={styles.grid}>
        {DIFFICULTIES.map((id) => {
          const bot = BOT_PROFILES[id];
          const unlocked = isBotUnlocked(id, bestWpm);
          const suggested = unlocked && id === suggestion;

          return (
            <li key={id}>
              <button
                className={styles.card}
                data-igniting={igniting === id || undefined}
                data-locked={!unlocked || undefined}
                /* The one nearest your own speed, so the roster is a
                   suggestion rather than a list to guess your way through. */
                data-suggested={suggested || undefined}
                disabled={igniting !== null || !unlocked}
                onClick={() => onPick(id)}
                aria-label={
                  unlocked
                    ? `${bot.label}, ${bot.wpm} words a minute`
                    : `${bot.label}, locked. Reach ${BOT_UNLOCK_WPM[id]} words a minute to open it.`
                }
              >
                {/* Frame 1 only. The idle bob belongs in the arena; six of them
                    breathing out of step in a grid is a distraction. */}
                <PixelSprite name={characterFrame(BOT_CHARACTERS[id], 1)} height={76} />

                <span className={`${styles.name} pixel-font`}>{bot.label}</span>

                {unlocked ? (
                  <span className={styles.speed}>{bot.wpm} wpm</span>
                ) : (
                  /* A locked card says what opens it rather than just refusing.
                     "20 wpm away" is a target; a padlock is a closed door. */
                  <span className={styles.locked}>
                    {Math.max(0, BOT_UNLOCK_WPM[id] - bestWpm)} wpm away
                  </span>
                )}

                {suggested && <span className={styles.flag}>NEAREST YOU</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <p className={styles.footnote}>
        The last three open when you have typed that fast yourself, anywhere in
        the game. You do not have to beat the one before it.
      </p>
    </main>
  );
}
