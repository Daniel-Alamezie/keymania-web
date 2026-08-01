import {
  applyDamage, bladeTier, keepsCombo, sanitiseElapsed, scoreWord, wpmFor,
} from './engine';
import { seekTo } from './resync';
import { BOT_CHARACTERS, COUNTDOWN_FROM, MAX_HEALTH } from './constants';
import { OPENING_SENTENCE, randomSentence } from './sentences';
import { chargeSentence, LEECH_SHARE, MEND_AMOUNT, SURGE_MULTIPLIER } from './powers';
import type { Difficulty } from '@/models/bot';
import type { DuelAction, DuelState, DuelStats, Fighter } from '@/models/duel';
import type { PowerKind } from '@/models/powers';
import {
  DEFAULT_CHARACTER, asCharacter, nextCharacter, type CharacterId,
} from '@/models/character';
import type { BladeTier } from '@/models/scoring';




export const newFighter = (
  name: string,
  target = -1,
  character: CharacterId = DEFAULT_CHARACTER,
): Fighter => ({ name, character, health: MAX_HEALTH, combo: 0, progress: 0, target });

/** You. */
export const you = (state: DuelState): Fighter => state.fighters[state.mySlot];

/** Everyone else, paired with their slot so callers never re-derive an index. */
export const rivals = (state: DuelState): { slot: number; fighter: Fighter }[] =>
  state.fighters
    .map((fighter, slot) => ({ slot, fighter }))
    .filter(({ slot }) => slot !== state.mySlot);

export const isOut = (fighter: Fighter): boolean => fighter.health <= 0;

/** Whether the local player has been knocked out but the duel continues. */
export const spectating = (state: DuelState): boolean =>
  isOut(you(state)) && state.winner === null;

/** Sentences always end in a space so the final word is committed like any other. */
const freshSentence = (exclude?: string) => `${randomSentence(exclude)} `;

/** Re-key per-sentence charges into flat script coordinates. */
function shiftCharges(
  charges: Record<number, PowerKind>,
  offset: number,
): Record<number, PowerKind> {
  const out: Record<number, PowerKind> = {};
  for (const [index, kind] of Object.entries(charges)) out[Number(index) + offset] = kind;
  return out;
}

const emptyStats = (): DuelStats => ({
  wordsTyped: 0, charsTyped: 0, mistakes: 0, maxCombo: 0, bestWpm: 0, startedAt: 0, endedAt: 0,
});

export function initialState(difficulty: Difficulty = 'rival'): DuelState {
  return {
    phase: 'idle',
    difficulty,
    countdown: COUNTDOWN_FROM,
    multiplayer: false,
    script: null,
    scriptIndex: 0,
    // Solo shape: you in slot 0, the bot in slot 1, each aimed at the other.
    fighters: [newFighter('You', 1), newFighter('', 0)],
    mySlot: 0,
    // Fixed, not random — this state is server-rendered too (see OPENING_SENTENCE).
    previous: '',
    sentence: `${OPENING_SENTENCE} `,
    upcoming: '',
    cursor: 0,
    wordStartedAt: 0,
    lastWordAt: 0,
    playerCombo: 0,
    wordMistakes: 0,
    powers: {},
    wordOffset: 0,
    ward: false,
    surge: false,
    lastPower: null,
    blockTick: 0,
    missTick: 0,
    lastHit: null,
    hitSeq: 0,
    tierUpTick: 0,
    stats: emptyStats(),
    winner: null,
  };
}

/** Replace one fighter without touching the others. */
function withSlot(fighters: Fighter[], slot: number, change: Partial<Fighter>): Fighter[] {
  if (slot < 0 || slot >= fighters.length) return fighters;
  return fighters.map((f, i) => (i === slot ? { ...f, ...change } : f));
}

const healSlot = (fighters: Fighter[], slot: number): Fighter[] =>
  withSlot(fighters, slot, {
    health: Math.min(MAX_HEALTH, fighters[slot].health + MEND_AMOUNT),
  });

export function duelReducer(state: DuelState, action: DuelAction): DuelState {
  switch (action.type) {
    case 'start': {
      const sentence = freshSentence();
      const upcoming = freshSentence(sentence);

      /**
       * Who the two of you are.
       *
       * `initialState` cannot answer this: it is server-rendered, so it has no
       * profile to read and hands both fighters the default. That default is
       * also what most players are before they open the picker, which is why a
       * bot duel so often showed two identical figures and made the character
       * you had just chosen look like it had been ignored — it had.
       */
      const mine = action.character ?? DEFAULT_CHARACTER;
      const theirs = BOT_CHARACTERS[action.difficulty];

      return {
        ...initialState(action.difficulty),
        phase: 'countdown',
        // Never the same face on both sides. If the bot's own character is the
        // one you picked, it steps aside to the next in the roster — you chose
        // yours, it did not choose its.
        fighters: [
          newFighter('You', 1, mine),
          newFighter('', 0, theirs === mine ? nextCharacter(mine) : theirs),
        ],
        sentence,
        upcoming,
        // Both sentences are charged up front, and every later sentence is
        // charged while it is still `upcoming`. A charged word is 8px wider
        // than a plain one, so deciding its charge only once it is reached
        // resizes text that is already on screen — see the roll below.
        powers: {
          ...chargeSentence(sentence.trim()),
          ...shiftCharges(chargeSentence(upcoming.trim()), sentence.trim().split(' ').length),
        },
      };
    }

    case 'startMulti':
      return {
        ...initialState(state.difficulty),
        phase: 'countdown',
        multiplayer: true,
        script: action.script,
        scriptIndex: 0,
        // Slot order comes from the server and never shifts, even as fighters
        // are knocked out — every later message addresses players by index.
        // asCharacter rather than the raw value: an opponent on a newer
        // release may send a character this build cannot draw, and a gap in
        // the arena is worse than a stand-in.
        fighters: action.roster.map((name, slot) =>
          newFighter(name, -1, asCharacter(action.characters?.[slot]))),
        mySlot: action.mySlot,
        // The server decides which words are charged; we only render them.
        powers: action.powers,
        // Both players type the same words in the same order — the server sent
        // this script, and it also validates every submission against it.
        sentence: `${action.script[0]} `,
        upcoming: `${action.script[1 % action.script.length]} `,
      };

    case 'countdown': {
      if (state.phase !== 'countdown') return state;
      const next = state.countdown - 1;
      if (next > 0) return { ...state, countdown: next };
      const now = Date.now();
      return {
        ...state,
        phase: 'playing',
        countdown: 0,
        wordStartedAt: now,
        lastWordAt: now,
        stats: { ...emptyStats(), startedAt: now },
      };
    }

    case 'typed': {
      if (state.phase !== 'playing') return state;
      const expected = state.sentence[state.cursor];

      if (action.char !== expected) {
        return {
          ...state,
          playerCombo: 0,
          // Counted per word as well as per duel: the per-word figure is what
          // tells the server this streak broke.
          wordMistakes: state.wordMistakes + 1,
          missTick: state.missTick + 1,
          stats: { ...state.stats, mistakes: state.stats.mistakes + 1 },
        };
      }

      const advanced = state.cursor + 1;
      const stats = { ...state.stats, charsTyped: state.stats.charsTyped + 1 };

      // Mid-word: just advance the cursor.
      if (expected !== ' ') {
        return { ...state, cursor: advanced, stats };
      }

      // SPACE committed the word — score everything that came before it.
      const wordStart = state.sentence.lastIndexOf(' ', state.cursor - 1) + 1;

      // The committing space is a keystroke too, and the measured time spans
      // it, so it counts toward the word's length. Standard typing measures
      // define a "word" as five characters *including* the space. Leaving it
      // out understates speed by 1/(n+1) — and because that fraction depends on
      // word length, short words would look slower than long ones at an
      // identical typing rate.
      const keystrokes = state.cursor - wordStart + 1;

      const combo = keepsCombo(action.now - state.lastWordAt) ? state.playerCombo : 0;
      const result = scoreWord({
        characters: keystrokes,
        elapsedMs: Math.max(1, action.now - state.wordStartedAt),
        combo,
      });

      const sentenceDone = advanced >= state.sentence.length;
      // Through the same clamp the damage uses, rather than raw elapsed with a
      // 1ms floor. Unclamped, a timing artefact reported a whole word typed in
      // 36 milliseconds as a peak of 1333 wpm.
      const wpm = wpmFor(
        keystrokes,
        sanitiseElapsed(keystrokes, action.now - state.wordStartedAt),
      );

      // Which word of the whole script this was, so charged words line up with
      // whatever the server marked.
      const localWord = state.sentence.slice(0, wordStart).split(' ').length - 1;
      const granted = state.powers[state.wordOffset + localWord];

      // Surge is spent on this throw, unless it is the power we just picked up.
      const spendSurge = state.surge && granted !== 'surge';

      const damage = spendSurge
        ? Math.round(result.damage * SURGE_MULTIPLIER * 10) / 10
        : result.damage;
      /**
       * Powers that resolve on the blade this word throws, in solo.
       *
       * Multiplayer never reaches this: the server applies all of it and sends
       * the result back, and `setHealths` overwrites whatever was predicted
       * here. This is the bot path, and it has to agree with
       * keymania-api/src/lib/powerRules.ts — the pair of powerRules test files
       * is what holds the two to the same rules.
       *
       * A bot holds no ward, so a blade in solo is never blocked and a leech
       * always draws.
       */
      const target = you(state).target;
      const soloFighters = (() => {
        if (granted === 'mend') return healSlot(state.fighters, state.mySlot);
        if (granted === 'leech') {
          const me = state.fighters[state.mySlot];
          return withSlot(state.fighters, state.mySlot, {
            health: Math.min(MAX_HEALTH, me.health + Math.round(damage * LEECH_SHARE * 10) / 10),
          });
        }
        // Breaks the streak, not the health — and the bot's combo is the only
        // one this reducer can reach.
        if (granted === 'stagger' && target >= 0) {
          return withSlot(state.fighters, target, { combo: 0 });
        }
        return state.fighters;
      })();


      // Multiplayer walks the server's script in order so both sides stay in
      // step; solo play just picks another sentence at random.
      const nextIndex = sentenceDone ? state.scriptIndex + 1 : state.scriptIndex;
      const wordsThisSentence = state.sentence.trim().split(' ').length;
      // The stream always holds one sentence beyond the one being typed, so
      // the text flowing in from the right is never invented at the moment
      // it is needed.
      // Falls back rather than trusting `upcoming` to be there. It always is
      // in a duel that started properly, but an empty one would roll the
      // player onto an empty sentence with nothing to type and no way out.
      const drawNext = () => (state.script
        ? `${state.script[nextIndex % state.script.length]} `
        : freshSentence(state.sentence));
      const nextSentence = !sentenceDone ? state.sentence : (state.upcoming || drawNext());
      const nextUpcoming = !sentenceDone
        ? state.upcoming
        : state.script
          ? `${state.script[(nextIndex + 1) % state.script.length]} `
          : freshSentence(nextSentence);

      const rolledOffset = sentenceDone ? state.wordOffset + wordsThisSentence : state.wordOffset;

      /**
       * Solo charges each sentence one roll early; multiplayer already has the
       * whole script's charges from the server.
       *
       * The early part matters more than it looks. `.token[data-charge]` adds
       * `padding: 0 4px`, so whether a word is charged is a *layout* fact, not
       * just a colour. This used to replace the whole map with charges for the
       * sentence being rolled onto, which meant that in the single frame of a
       * roll the incoming words grew 8px each as they landed and the outgoing
       * ones shrank by the same amount. The caret stayed pinned — the snap
       * saw to that — so what you actually saw was the text on either side of
       * it lurching. That was the rubberband.
       *
       * Charging `nextUpcoming` instead settles a word's width before it is
       * ever drawn, and never touches it again. `nextSentence` is deliberately
       * left alone: it was charged as `upcoming` a roll ago, and re-charging
       * it would draw fresh random charges for words already on screen, which
       * is the same bug wearing a different hat.
       */
      const nextPowers = (() => {
        if (!sentenceDone || state.script) return state.powers;

        const merged = {
          ...state.powers,
          ...shiftCharges(
            chargeSentence(nextUpcoming.trim()),
            rolledOffset + nextSentence.trim().split(' ').length,
          ),
        };

        // Drop anything older than the sentence just finished. Only previous,
        // current and upcoming are ever rendered, and a duel left running for
        // an hour should not accumulate a charge for every word it has shown.
        const kept: Record<number, PowerKind> = {};
        for (const [index, kind] of Object.entries(merged)) {
          if (Number(index) >= state.wordOffset) kept[Number(index)] = kind;
        }
        return kept;
      })();

      return {
        ...state,
        previous: sentenceDone ? state.sentence : state.previous,
        sentence: nextSentence,
        upcoming: nextUpcoming,
        scriptIndex: nextIndex,
        wordOffset: rolledOffset,
        powers: nextPowers,
        cursor: sentenceDone ? 0 : advanced,
        playerCombo: result.combo,
        // A fresh word starts clean.
        wordMistakes: 0,
        wordStartedAt: action.now,
        lastWordAt: action.now,
        hitSeq: state.hitSeq + 1,
        tierUpTick: result.tierUp ? state.tierUpTick + 1 : state.tierUpTick,
        // Powers only resolve locally in solo; in multiplayer the server's
        // `setPowers` overwrites this with the authoritative state.
        ward: granted === 'ward' ? true : state.ward,
        surge: granted === 'surge' ? true : spendSurge ? false : state.surge,
        lastPower: granted ? { kind: granted, tick: action.now } : state.lastPower,
        fighters: soloFighters,
        lastHit: {
          id: state.hitSeq + 1,
          fromSlot: state.mySlot,
          // Whoever you are currently aimed at. In solo that is always the bot.
          toSlot: you(state).target,
          damage,
          wpm: result.wpm,
          tier: result.tier,
        },
        stats: {
          ...stats,
          wordsTyped: stats.wordsTyped + 1,
          maxCombo: Math.max(stats.maxCombo, result.combo),
          bestWpm: Math.max(stats.bestWpm, Math.round(wpm)),
        },
      };
    }

    case 'botWord': {
      if (state.phase !== 'playing') return state;
      // Solo only: the bot is always slot 1, throwing at slot 0.
      const botSlot = 1;
      const bot = state.fighters[botSlot];
      if (!bot) return state;

      const combo = action.fumbled ? 0 : bot.combo;
      const result = scoreWord({ characters: action.characters, elapsedMs: action.elapsedMs, combo });
      return {
        ...state,
        fighters: withSlot(state.fighters, botSlot, {
          combo: result.combo,
          progress: action.progress,
        }),
        hitSeq: state.hitSeq + 1,
        lastHit: {
          id: state.hitSeq + 1,
          fromSlot: botSlot,
          toSlot: state.mySlot,
          damage: result.damage,
          wpm: result.wpm,
          tier: result.tier,
        },
      };
    }

    case 'land': {
      if (state.phase !== 'playing') return state;

      // A ward absorbs the blade entirely and is consumed doing so.
      if (action.toSlot === state.mySlot && state.ward) {
        return { ...state, ward: false, blockTick: state.blockTick + 1 };
      }

      const target = state.fighters[action.toSlot];
      if (!target) return state;

      const fighters = withSlot(state.fighters, action.toSlot, {
        health: applyDamage(target.health, action.damage),
      });

      // Last one standing, not "the other one dropped". In a duel these are the
      // same moment; in a four-way the first knockout decides nothing.
      const standing = fighters.filter((f) => !isOut(f));
      const winner = standing.length === 1 ? fighters.indexOf(standing[0]) : null;

      return {
        ...state,
        fighters,
        phase: winner !== null ? 'finishing' : state.phase,
        winner,
        // Freeze the clock on the blow, not when the banner appears — the
        // cinematic that follows must never be counted as typing time.
        stats: winner !== null ? { ...state.stats, endedAt: action.now } : state.stats,
      };
    }

    case 'resync': {
      // No script means no multiplayer duel to find a place in.
      if (!state.multiplayer || !state.script) return state;
      const seek = seekTo(state.script, action.wordIndex);
      return {
        ...state,
        // Straight to playing: whatever countdown was running belongs to the
        // duel this player left, and that duel is mid-swing.
        phase: 'playing',
        scriptIndex: seek.scriptIndex,
        sentence: seek.sentence,
        upcoming: seek.upcoming,
        cursor: seek.cursor,
        /**
         * The streak restarts. The server's own combo for this seat carried on
         * — the seat never left the duel — so the local figure is only the
         * visual prediction, and starting it at zero understates one word
         * rather than overstating damage that will not come.
         */
        playerCombo: 0,
        wordMistakes: 0,
        wordStartedAt: action.now,
        lastWordAt: action.now,
        fighters: state.fighters.map((fighter, slot) => ({
          ...fighter,
          health: action.healths[slot] ?? fighter.health,
        })),
      };
    }

    case 'setHealths': {
      // Once decided, health is frozen. Keyed on the winner rather than the
      // phase so a server update arriving during the finishing beat cannot
      // quietly heal a fallen fighter mid-collapse.
      if (state.winner !== null) return state;
      return {
        ...state,
        fighters: state.fighters.map((f, slot) => (
          action.healths[slot] === undefined ? f : { ...f, health: action.healths[slot] }
        )),
      };
    }

    case 'staggered':
      /**
       * The server has already broken this streak; this is the client catching
       * up with it.
       *
       * Your own combo lives in `playerCombo` and everybody else's on their
       * fighter, so the slot decides which one stops. Without this the victim
       * would keep counting a streak the referee had ended, and every blade
       * after it would be scored locally at a multiplier the server has
       * already refused.
       */
      return action.slot === state.mySlot
        ? { ...state, playerCombo: 0 }
        : { ...state, fighters: withSlot(state.fighters, action.slot, { combo: 0 }) };

    case 'setTargets':
      return {
        ...state,
        fighters: state.fighters.map((f, slot) => (
          action.targets[slot] === undefined ? f : { ...f, target: action.targets[slot] }
        )),
      };

    case 'setProgress':
      return {
        ...state,
        fighters: withSlot(state.fighters, action.slot, { progress: action.progress }),
      };

    case 'setPowers':
      return {
        ...state,
        ward: action.ward,
        surge: action.surge,
        blockTick: action.blocked ? state.blockTick + 1 : state.blockTick,
        lastPower: action.granted
          ? { kind: action.granted, tick: Date.now() }
          : state.lastPower,
      };

    case 'finish':
      // Already decided — a resign arriving after the killing blow must not
      // restart the sequence or overwrite the winner.
      if (state.winner !== null) return state;
      return {
        ...state,
        phase: 'finishing',
        winner: action.winnerSlot,
        stats: { ...state.stats, endedAt: state.stats.endedAt || action.now },
      };

    /** The cinematic is done (or was skipped); show the result. */
    case 'settle':
      if (state.phase !== 'finishing') return state;
      return { ...state, phase: 'over' };

    case 'reset':
      return initialState(state.difficulty);

    default:
      return state;
  }
}

export function currentTier(state: DuelState): BladeTier {
  return bladeTier(state.playerCombo);
}

/** Accuracy as a percentage of keystrokes that landed correctly. */
export function accuracy(stats: DuelStats): number {
  const total = stats.charsTyped + stats.mistakes;
  return total === 0 ? 100 : Math.round((stats.charsTyped / total) * 100);
}

/** Overall words-per-minute across the whole duel, live. */
export function overallWpm(stats: DuelStats, now: number): number {
  if (!stats.startedAt) return 0;
  return Math.round(wpmFor(stats.charsTyped, now - stats.startedAt));
}

/**
 * The duel's settled speed — the figure worth ranking.
 *
 * Uses the frozen end time rather than the clock: computing this live on a
 * results screen would make the number fall steadily as the player sat there,
 * since elapsed time keeps growing while the character count does not.
 *
 * Preferred over `bestWpm` for any leaderboard. A single fast short word is
 * mostly luck; sustained speed over a whole duel is the actual skill. Note that
 * because a wrong key never advances the cursor, mistakes already cost time —
 * so this figure honestly reflects accuracy without needing a separate penalty.
 */
export function finalWpm(stats: DuelStats): number {
  if (!stats.startedAt || !stats.endedAt) return 0;
  return Math.round(wpmFor(stats.charsTyped, stats.endedAt - stats.startedAt));
}

export type { DuelStats, DuelState, Fighter, DuelAction } from '@/models/duel';
