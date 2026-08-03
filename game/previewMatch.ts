import { randomSentence } from './sentences';
import type { MultiplayerConfig } from '@/components/Duel';
import type { CharacterId } from '@/models/character';

/**
 * A duel that has no server behind it, for looking at the layout.
 *
 * Four-player duels are the one arrangement that cannot be checked by playing:
 * a bot duel is always 1v1, and a real four-way needs four accounts on four
 * connections at the same moment. So the layout for three opponents has only
 * ever been seen by accident, which is how it came to be quietly broken when the
 * arena stopped drawing fighters.
 *
 * This fabricates the state a real match would have arrived in and hands it
 * straight to `Duel`, which then renders exactly what four players would see.
 * Nothing is sent and nothing is received, so words will not score and the duel
 * will not progress. That is the whole point: it is a photograph, not a game.
 *
 * **Temporary, and reachable only by URL.** It goes when the four-player layout
 * has been settled, along with `?fx=`.
 */
export interface PreviewOptions {
  /** How many players in the room, including you. */
  players: number;
  /** Which slot is yours, so the "you are not always slot 0" cases can be seen. */
  mySlot?: number;
}

const NAMES = ['You', 'Robert', 'Dinh Quang', 'Lunox'];
const FACES: CharacterId[] = ['wanderer', 'baron', 'scholar', 'drifter'];

/**
 * Never resolves and never fires.
 *
 * A real config subscribes to a socket; this one takes the handler and drops it,
 * which is correct rather than lazy. A preview that pretended to receive
 * messages would be showing a layout driven by fake events, and the thing being
 * checked is how the room looks when it is standing still.
 */
export function previewMatch({ players, mySlot = 0 }: PreviewOptions): MultiplayerConfig {
  const size = Math.max(2, Math.min(NAMES.length, players));

  return {
    // A handful of sentences, which is enough to fill the line and scroll it.
    // The server builds ten rounds; nothing here is going to reach the end.
    script: Array.from({ length: 4 }, () => randomSentence()),
    roster: NAMES.slice(0, size),
    mySlot: Math.max(0, Math.min(size - 1, mySlot)),
    powers: {},
    characters: FACES.slice(0, size),
    /**
     * Made up, because there is no server here and nobody has a standing.
     *
     * Given values rather than left undefined so the preview shows the plates as
     * a real duel does — the whole point of this harness is checking a layout
     * that is otherwise unreachable without four accounts at once.
     */
    ratings: Array.from({ length: size }, (_, i) => 300 + i * 17),
    countdownMs: 3000,
    subscribe: () => () => {},
    onWord: () => {},
    onResign: () => {},
    onRematch: () => {},
    // Nothing to leave and no queue to join: the preview is not a real room.
    onFindGame: () => {},
    // No socket to beat against. The preview is a still frame of a room.
    onPulse: () => {},
    // The preview shows a plain roster; cosmetics are a signed-in concern.
    cosmetics: undefined,
  };
}
