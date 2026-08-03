/**
 * The duel protocol — every message that crosses the WebSocket.
 *
 * API Gateway holds the socket and a Lambda runs per message, so each of these
 * is self-contained: there is no connection-scoped memory on the server beyond
 * what the rooms table holds.
 *
 * The server is the authority. Anything a client sends is a claim to be
 * checked, never a fact — which is why nothing here lets a client state its own
 * damage or health.
 */

import type { PublicCosmetics } from './cosmetics';
import type { CharacterId } from './character';
import type { PowerKind } from './powers';
import type { RoomSize, RoomSummary, Visibility } from './room';
import type { BladeTier } from './scoring';

export type SocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type ServerMessage =
  | {
    type: 'roomCreated';
    roomId: string;
    visibility: Visibility;
    capacity?: RoomSize;
    slot: number;
    you: string;
  }
  | { type: 'roomList'; rooms: RoomSummary[] }
  /**
   * Nobody suitable was waiting, so you are the one waiting now.
   *
   * Carries the rating it queued you at, which is worth showing: it is the only
   * moment the game explains *why* the wait might be short or long, and a player
   * staring at a spinner deserves to know it is looking for somebody near them
   * rather than simply stuck.
   */
  | { type: 'searching'; roomId: string; rating: number }
  /** The search was called off, by you. */
  | { type: 'searchStopped' }
  /**
   * What a refereed duel did to your standing.
   *
   * Sent per connection rather than broadcast, because the number is different
   * for everybody in the room — a shared payload would be the one message in
   * this protocol that is wrong for everyone but its author. It arrives just
   * after `gameOver`, so the result lands first and the rating follows it onto
   * the same screen.
   *
   * **The server has sent this since ratings existed and this client never
   * declared it**, so every one was parsed, handed to the subscribers, matched
   * by nobody and dropped. The single most motivating moment in the game — the
   * number moving — has never once been shown to anybody.
   */
  | {
    type: 'rating';
    /** How far the duel moved them. Signed, and the sign is most of the message. */
    delta: number;
    /** Where they landed. */
    rating: number;
    /** How much of `delta` was the upset bonus, so this can say why. */
    bonus: number;
    /**
     * The speed the record was written with — the leaderboard's own number.
     *
     * Optional because an older server does not send it, in which case the
     * result card falls back to its local estimate, exactly as it always did.
     */
    wpm?: number;
  }
  /**
   * One word of a survival run, judged.
   *
   * Sent for every word, surviving or not, because the two carry the same
   * information and the client needs the last one most of all: `ended` is how a
   * run finishes, and a message that stopped arriving would be indistinguishable
   * from a dropped connection.
   */
  | {
    type: 'survivalWord';
    survived: boolean;
    combo: number;
    maxCombo: number;
    tier: BladeTier;
    wpm: number;
    /** Words survived, which in sudden death is also the score. */
    wordIndex: number;
    /** Milliseconds of heat the forge holds, for the bar to drain from. */
    heat: number;
    /** How fast that heat is being spent, which rises through a run. */
    cooling: number;
    /**
     * Why the run ended, absent while it continues.
     *
     * `typo` is reported by the client and taken on trust; `cold` is the
     * server's own call, measured between two timestamps it wrote itself. Worth
     * telling apart, because only one of them is a fact.
     */
    ended?: 'typo' | 'cold';
    /**
     * A sentence the server added to the script while judging this word.
     *
     * The run has no end, so the script is topped up as it goes. Without this
     * the client walks off the end of the ten sentences it was handed at the
     * start, somewhere around word eighty, and every word after that disagrees
     * with the referee.
     */
    appended?: string;
  }
  /** A room filling up, before it is full enough to start. */
  | {
    /** One word of a weekly sprint, acknowledged. */
    type: 'weeklyWord';
    ended: boolean;
    wordIndex: number;
    chars: number;
  }
  | {
    /**
     * A weekly sprint, over and scored.
     *
     * `run` is this attempt and `best` the week's standing best after the
     * write, both from the server's own clock — the end card renders these
     * and never its own arithmetic. Absent `run` means the attempt was too
     * short to measure, which the card words as encouragement, not an error.
     */
    type: 'weeklyEnd';
    week: string;
    run?: { chars: number; words: number; wpm: number; lastMs: number };
    best?: { chars: number; words: number; wpm: number; lastMs: number };
    improved: boolean;
  }
  | {
    /**
     * The referee's position, sent when a word is refused as a mismatch.
     *
     * The cure for the reorder desync: at high speed two words can be in
     * flight at once and the later one can be judged first, leaving the
     * client permanently one word ahead. Rather than a bare refusal, the
     * server says where it stands and the client seeks there - a reorder
     * costs one word instead of the rest of the duel.
     */
    type: 'wordSync';
    /** The flat index of the word the server expects next. */
    expected: number;

  }
  | { type: 'roomFilling'; roomId: string; players: string[]; capacity: number }
  | {
    type: 'matchStart';
    /**
     * What is starting.
     *
     * Absent means a duel, which is what every release before survival sent and
     * what every duel still sends. The client routes on this rather than on the
     * roster length, because a room of one is a legitimate thing for a duel to
     * become mid-match and a survival run is not something to fall into.
     */
    mode?: 'duel' | 'survival' | 'weekly';
    roomId: string;
    script: string[];
    /** Charged words keyed by flat word index. */
    powers: Record<number, PowerKind>;
    countdownMs: number;
    slot: number;
    you: string;
    /** Every player's name in slot order. */
    roster: string[];
    /**
     * Who each player fights as, parallel to the roster.
     *
     * Sent with the match because a client only ever learns about other players
     * through this message — there is no route for asking who somebody is.
     * Absent from an older server, in which case everyone draws as the default.
     */
    characters?: CharacterId[];
    /**
     * What each seat is rated, parallel to the roster.
     *
     * So a duel can show the stakes before a word is typed rather than only
     * revealing them in the swing afterwards. Optional because an older server
     * sends none, and a plate with no rating simply shows a name, which is what
     * every plate did until now.
     */
    ratings?: number[];
    /**
     * What each seat is wearing, parallel to the roster.
     *
     * Resolved server-side through the same function the leaderboard uses, so
     * a player looks identical wherever they are seen. Entries are undefined
     * for a simulated opponent, which has no account and therefore wears
     * nothing — a ghost with a tournament badge would be the loudest tell the
     * feature could produce.
     */
    cosmetics?: (PublicCosmetics | undefined)[];
    /** Legacy single-opponent name, sent only for two-player rooms. */
    opponent?: string;
  }
  | {
    type: 'hit';
    fromSlot: number;
    /** Who wore it. Past two players this cannot be inferred from fromSlot. */
    toSlot: number;
    damage: number;
    tier: number;
    combo: number;
    wpm: number;
    healths: number[];
    progress: number[];
    /** Power the thrower just collected, if the word was charged. */
    granted?: PowerKind;
    /** The target's ward absorbed this blade. */
    blocked?: boolean;
    /** The throw was doubled by a surge. */
    surged?: boolean;
    wards?: boolean[];
    surges?: boolean[];
    /** Health the thrower drew back from this blade, if it leeched. */
    drained?: number;
    /**
     * Whose streak a stagger broke, if any.
     *
     * A slot rather than a boolean, because the victim's own client is the one
     * that must act: every client counts its own combo locally, so a staggered
     * player left untold would keep a streak the server had already ended and
     * their damage would run ahead of the referee's.
     */
    staggeredSlot?: number;
    /** Who each fighter now aims at, recomputed after the damage. */
    targets?: number[];
    /** Set when this blow knocked somebody out. */
    eliminatedSlot?: number;
  }
  /** Somebody is out, but others are still fighting. Four-way only. */
  | {
    type: 'eliminated';
    slot: number;
    reason?: 'resign' | 'left';
    healths: number[];
    targets?: number[];
  }
  | { type: 'gameOver'; winnerSlot: number; reason?: 'resign' | 'left' }
  /**
   * Who has asked to go again, after a duel has finished.
   *
   * Sent to everyone in the room, including the people who have not answered —
   * waiting is much easier when you can see what you are waiting for. The
   * roster can shrink between messages: somebody leaving the result screen
   * drops out of it rather than taking the room with them.
   */
  | { type: 'rematchState'; players: string[]; ready: boolean[] }
  /**
   * A seat successfully reclaimed on a fresh socket.
   *
   * Carries the full board, not a delta: the client has been blind for an
   * unknown number of exchanges, so the only honest thing the server can hand
   * it is the complete current state to repaint from. `status` says whether
   * there is still a duel to rejoin or only a result to see.
   */
  | {
    type: 'rejoined';
    roomId: string;
    status: 'playing' | 'over';
    slot: number;
    script: string[];
    powers: Record<number, PowerKind>;
    roster: string[];
    characters: CharacterId[];
    ratings: number[];
    /**
     * What each seat is wearing. Carried here too, or a duel picked back up
     * after a dropped socket would silently lose every badge on screen — the
     * rejoin's whole promise is that nothing about the duel changed.
     */
    cosmetics?: (PublicCosmetics | undefined)[];
    healths: number[];
    progress: number[];
    wards: boolean[];
    surges: boolean[];
    targets: number[];
    countdownMs: number;
    winnerSlot?: number;
  }
  /**
   * The seat could not be reclaimed.
   *
   * A typed message rather than an error string, because the client acts on the
   * difference: 'auth' means the session needs renewing and retrying might
   * work, 'gone' means the duel no longer exists and the only move is the menu.
   */
  | { type: 'rejoinFailed'; reason: 'auth' | 'gone' }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string };

export type ClientMessage =
  // `token` is a Kinde access token. The server refuses both of these without
  // one — a duel has to be attributable to an account before it can count.
  | {
    action: 'createRoom';
    name: string;
    visibility: Visibility;
    token: string;
    /** How many players the room waits for. Omitted means a duel. */
    capacity?: RoomSize;
    /**
     * A room of one, refereed against the clock rather than an opponent.
     *
     * Omitted means a duel, which is what every release before survival sent.
     * The server starts a survival room the moment it exists, so the reply is
     * `matchStart` rather than `roomCreated`.
     */
    mode?: 'survival' | 'weekly';
  }
  | { action: 'joinRoom'; roomId: string; name: string; token: string }
  | { action: 'listRooms' }
  /**
   * Find me a game.
   *
   * Takes the seat of somebody already waiting, or opens one and waits. The
   * server answers with `matchStart` if it paired you immediately, or
   * `searching` if you are now the person being found.
   *
   * Carries a token for the same reason hosting does: a duel has to belong to an
   * account before it can move a rating.
   */
  | { action: 'quickPlay'; name: string; token: string }
  /** Stop looking, and tear down the seat that was opened for you. */
  | { action: 'cancelQueue' }
  /**
   * Stop waiting for a person and take the opponent the server is running.
   *
   * Sent when the search has gone on long enough that waiting is worse than
   * playing. The server decides whether to honour it, and enforces its own floor
   * on how early it can be asked, so this says "I have waited long enough"
   * rather than "give me an opponent".
   */
  | { action: 'playGhost' }
  /**
   * One word of a survival run.
   *
   * The same shape as `wordComplete` and a different route, because the two are
   * judged by different referees: a duel word is scored against an opponent, and
   * this one against the clock. Sharing a route would have meant a mode branch
   * inside the handler carrying the lost-update, countdown and stagger fixes.
   */
  | { action: 'survivalWord'; word: string; elapsedMs: number; accuracy?: number; typos?: number }
  /**
   * One word of a weekly sprint, or `finish` when the local thirty seconds
   * are up — trusted only to close the run, never to score it.
   */
  | { action: 'weeklyWord'; word?: string; finish?: boolean }
  // Running accuracy rides along here rather than on its own route. The server
  // cannot verify it, so it is stored for the player's record but never ranked.
  //
  // `typos` is how many mistakes were made inside this word. The server needs
  // it because a wrong key never reaches it: the cursor does not advance, so no
  // message is sent, and without this its combo runs on where yours broke.
  //
  // Client-reported and therefore imperfect — under-reporting keeps a streak
  // you lost. It is the same trust as elapsedMs, which the server already
  // accepts and clamps, and lying only helps in one direction.
  | { action: 'wordComplete'; word: string; elapsedMs: number; accuracy?: number; typos?: number }
  | { action: 'resign' }
  /**
   * A heartbeat while a duel is live.
   *
   * Carries nothing. Its whole job is to give the server a reason to look at the
   * clock, because some opponents run on one and until now the only thing that
   * ever woke the server was a human finishing a word. That made going quiet a
   * way to stop the other side dead.
   *
   * **Sent in every multiplayer duel, not only the ones that need it.** The
   * client cannot tell which is which, and must not be able to: a message that
   * appeared only against a simulated opponent would be a clearer tell than the
   * one it fixes. Skipped while a word was recently sent, since words already
   * wake the server and a fast typist should not pay for a heartbeat they are
   * generating anyway.
   */
  | { action: 'pulse' }
  /**
   * Reclaim a seat after the socket died mid-duel.
   *
   * Identity is the token, never the connection — the entire premise is that
   * the old connection id is dead and this one is a stranger. Sockets die for
   * reasons nobody can prevent (phone locks, network handovers, API Gateway's
   * hard two-hour cap), and $disconnect is best-effort, so recovery has to be
   * driven by the side that knows it reconnected.
   */
  | { action: 'rejoin'; roomId: string; token: string }
  /**
   * Another duel with the people already here.
   *
   * Needs no room code: the server knows which room this socket is in, and the
   * room now outlives the match that was played in it. Unanimous among whoever
   * is still connected — a rematch is not something you can decline once it has
   * started.
   */
  | { action: 'rematch' };
