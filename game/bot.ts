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
    /**
     * How much this bot's pace wanders, centred on its target speed.
     *
     * Per-profile rather than a fixed quarter either way. The swing is what
     * makes a slow bot feel like a person rather than a metronome, and what
     * makes a fast one feel arbitrary: at 150wpm a quarter-swing means losing to
     * a lucky burst rather than to a better typist. So it narrows as the ladder
     * climbs and the top bot is relentless instead of erratic.
     */
    const jitter = 1 - profile.jitter + Math.random() * profile.jitter * 2;
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
