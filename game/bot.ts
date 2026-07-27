import { BOT_PROFILES } from './constants';
import { randomSentence } from './sentences';
import { toWords } from './engine';
import type { Difficulty } from '@/models/bot';
import type { BotWordEvent } from '@/models/bot';


export interface BotHandle {
  stop: () => void;
}

/**
 * A simulated opponent. It is deliberately *not* machine learning — just
 * timing: it completes words at a target words-per-minute with human-ish
 * jitter, and occasionally fumbles, which costs it a recovery pause.
 */
export function startBot(difficulty: Difficulty, onWord: (event: BotWordEvent) => void): BotHandle {
  const profile = BOT_PROFILES[difficulty];
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  let words = toWords(randomSentence());
  let index = 0;

  const scheduleNext = () => {
    if (stopped) return;

    const word = words[index];
    const baseMs = (word.text.length / 5 / profile.wpm) * 60_000;
    const jitter = 0.75 + Math.random() * 0.5;
    const fumbled = Math.random() < profile.errorRate;
    const delay = baseMs * jitter + (fumbled ? 260 + Math.random() * 420 : 0);

    timer = setTimeout(() => {
      if (stopped) return;

      index += 1;
      const finishedSentence = index >= words.length;
      onWord({
        characters: word.text.length,
        elapsedMs: delay,
        progress: finishedSentence ? 1 : index / words.length,
        fumbled,
      });

      if (finishedSentence) {
        words = toWords(randomSentence());
        index = 0;
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

export type { BotWordEvent } from '@/models/bot';
