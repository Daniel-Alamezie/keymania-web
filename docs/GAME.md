# KeyMania — how the game works

The single reference for the game's rules, numbers and structure. The two
READMEs answer "what is this and how do I run it"; this answers "what actually
happens, and why".

It spans **both repos** — `keymania-web` (the game, the browser, the bots) and
`keymania-api` (the referee, the records, the standings). It lives here rather
than being split in two because half a rulebook in each repo is how two
descriptions of one game drift apart. `keymania-api/README.md` links to it.

Its companion is [INTERESTING-PROBLEMS.md](INTERESTING-PROBLEMS.md): this file
is how the game works, that one is what went wrong on the way there. Several
rules here exist *because* of an entry in that one, and are cross-referenced.

**Every number below is read from the code, not remembered.** When you change a
constant, change it here in the same commit — a stale rulebook is worse than
none, because it gets believed.

---

## 1. The core loop

You are shown a stream of words. Type a word, press `SPACE`, and the word is
committed: it becomes a blade, thrown at an opponent, dealing damage. Both
fighters start at **100 health**. Last one standing wins.

`SPACE` is the commit key, and nothing else is. Typing the first letter of the
*next* word while the cursor sits on a space is rejected as a miss rather than
silently skipping the commit — otherwise a fast typist would score words they
never finished.

A typo does not advance the cursor. It breaks your combo, counts against your
accuracy, and that is all. There is no backspace and nothing to undo.

**Countdown:** 3 seconds. Words thrown before it ends do not count; the server
owns when a duel is live so neither side can jump the gun.

---

## 2. Damage

```
damage = BASE_DAMAGE × speedMultiplier(wpm) × comboMultiplier(combo)
```

| Constant | Value | Meaning |
|---|---|---|
| `MAX_HEALTH` | 100 | Starting health |
| `BASE_DAMAGE` | 1.2 | Per committed word, before multipliers |
| `SLOW_WPM` / `FAST_WPM` | 25 / 95 | Anchors of the speed ramp |
| `MIN_SPEED_MULTIPLIER` | 0.85 | At or below 25 wpm |
| `MAX_SPEED_MULTIPLIER` | 1.5 | At or above 95 wpm |
| `COMBO_STEP` | 0.15 | Added per combo |
| `MAX_COMBO_MULTIPLIER` | 2.0 | Ceiling |
| `MIN_MS_PER_CHAR` | 28 | Floor on plausible typing speed |
| `PROJECTILE_FLIGHT_MS` | 420 | Blade travel time |

- **Speed** is a clamped linear ramp between the anchors, so a slow word still
  does most of its damage. Speed is a bonus, not a gate.
- **Combo** is `clamp(1 + combo × 0.15, 1, 2.0)` — so the tenth consecutive word
  is worth double the first, and no more.
- **wpm** is the standard `characters ÷ 5 ÷ minutes`, counting the committing
  space.
- `MIN_MS_PER_CHAR` clamps absurdly short elapsed times so a stalled clock or a
  tampered client cannot report a 900wpm word.

Damage and health are rounded to one decimal.

---

## 3. Combo and blade tiers

The combo is the number of consecutive words committed **without a typo and
without pausing too long**.

| Constant | Value |
|---|---|
| `COMBO_WINDOW_MS` | 2600 |

Pause longer than 2.6s between words and the streak resets, exactly as a typo
does. The combo drives both damage and which blade sprite is drawn:

| Tier | Combo required |
|---|---|
| 5 | 9+ |
| 4 | 6+ |
| 3 | 4+ |
| 2 | 2+ |
| 1 | 0+ |

**Important:** the server cannot see a typo. A wrong key does not advance the
cursor, so no message is ever sent for it — the client reports `wordMistakes`
alongside each committed word, and the server breaks the streak on that. Get
this wrong and the server's combo runs on where the player's broke, inflating
both the recorded best *and* the damage dealt.

---

## 4. Powers

Roughly one word in nine is **charged**, colour-coded in the stream. Completing
it grants a power.

| Constant | Value |
|---|---|
| `CHARGE_EVERY` | 9 (one charge per window of 9 words) |
| `MIN_CHARGED_LENGTH` | 4 (short words are never charged) |
| `MEND_AMOUNT` | 8 |
| `SURGE_MULTIPLIER` | 2 |
| `LEECH_SHARE` | 0.5 |

| Power | Held? | Effect |
|---|---|---|
| `ward` | **Yes** | Absorbs the next blade aimed at you, entirely |
| `surge` | **Yes** | Doubles your next blade |
| `mend` | No | Heals 8, capped at `MAX_HEALTH` |
| `leech` | No | This word's blade returns half its damage to you as health |
| `stagger` | No | Resets your target's combo to zero |

**Held or instant** is the structural distinction. A held power waits in hand
and the HUD draws a slot for it (`HELD_POWERS`); an instant one resolves on the
blade this word throws and has nothing to show, because by the time you could
look at it, it has happened.

Two rules that are easy to get backwards:

- **A surge is not spent on the word that granted it.** Otherwise picking one
  up would silently double the throw that earned it, and it would be gone
  before the player knew they had it.
- **A ward does not stop a stagger.** A ward is armour against a blade and a
  stagger is not a blade. If it blocked, a warded player would be immune to
  both at once and the two powers would be quietly redundant.

`leech` draws nothing from a blade a ward absorbed — there is no damage to take
a share of.

The rules live in one place per repo: `keymania-api/src/lib/powerRules.ts` and
the solo path in `game/duelReducer.ts`. They cannot share code across repos, so
`powerRules.test.ts` on each side asserts the same facts in the same order —
that pairing is what holds the two implementations together.

Charges are decided **one sentence ahead**, while a sentence is still
`upcoming`, and never revised. This is not an optimisation — a charged word is
8px wider than a plain one (`.token[data-charge]` adds `padding: 0 4px`), so
deciding a charge late resizes text already on screen. Doing it at the moment a
sentence became current is what caused the word-rubberband bug.

In multiplayer the **server** decides which words are charged and sends them
with the script; the client only renders them.

---

## 5. Targeting and elimination

Nobody aims. Aiming would mean reaching for a key that is not part of a word,
and this game only ever asks for words.

**Your blade goes to the healthiest opponent still standing.** Ties break
toward whoever has typed more. That makes leading dangerous, which is the
point: in a four-way without it, whoever pulls ahead early is simply left alone
to win.

A player is out at 0 health. The **duel** ends when one player is left — in a
1v1 those are the same moment, in a four-way they are not.

`Player.outAt` is stamped once when health first reaches zero, in all three
paths that can zero it (a blade, a resign, a disconnect). It exists so a
four-way has a **placement**: surviving longer places higher.

**Eliminated players spectate.** The server keeps broadcasting to them and
rejects their word submissions. *(The client side of this is not built yet —
see §14.)*

---

## 6. Bots

Practice only. Bots run entirely in the browser; the server never simulates
one. Not machine learning — just timing, with human-ish jitter and fumbles.

| Difficulty | wpm | Error rate | Fights as |
|---|---|---|---|
| `rookie` | 34 | 0.18 | Rookie |
| `rival` | 55 | 0.12 | Drifter |
| `master` | 80 | 0.09 | Baron |

Each bot has its own character so the three tell apart on sight. If the bot's
character is the one you picked, it steps aside to the next in the roster — you
chose yours, it did not choose its.

---

## 7. Characters

Six, and purely cosmetic — no character has a gameplay effect.

```
wanderer · scholar · rookie · drifter · sprout · baron
```

`DEFAULT_CHARACTER = 'rookie'`. Everyone starts the same rather than being
assigned at random, so a player who has never opened the picker looks the same
to their opponent today as yesterday.

The **ids** are mirrored in `keymania-api/src/lib/characters.ts`; everything
visual lives in `keymania-web/models/character.ts`. The server stores a choice
and relays it and has no idea what any of them look like. A contract test pins
the roster on both sides, because an id the server accepts but the client
cannot draw is a fighter that renders as nothing.

Unknown ids **fall back** rather than throwing, on both sides: an opponent on a
newer release should appear as somebody ordinary rather than as a gap.

---

## 8. Identity: display name vs handle

Two fields that want opposite things, which is why they are separate.

| | Display name | Handle |
|---|---|---|
| Unique | No | **Yes** |
| Max length | 16 | 16 (min 3) |
| Change | Whenever | First free, then every **15 days** |
| Purpose | Expressive | Canonical, addressable |

A display name cannot be safely compared — homoglyphs make impersonation
trivial — so anything that *addresses* a player uses the handle.

**The handle is seeded, not chosen.** On your first profile read the server
generates one from your Kinde given name (forwarded by the BFF, since the
access token carries only `sub`). Because that is not a choice, it does not
start the cooldown: `handleChosen` is set only on a deliberate claim, and the
cooldown keys off *that*, not off having a handle.

Old handles are **never released**. Whoever picked one up next would inherit
every link and every person still looking for you.

---

## 9. Rating

Standing among people. **Deliberately not Elo** — Elo's apparatus exists to
predict a match from two numbers and pays for it with a scale nobody can read.
Arithmetic a player can check in their head beats accuracy they cannot perceive.

| Constant | Value |
|---|---|
| `START_RATING` | 300 |
| `RATING_FLOOR` | 100 |
| `WIN_POINTS` | +10 |
| `LOSS_POINTS` | −8 |
| `MAX_UPSET_BONUS` | +3 |
| `POINTS_PER_GAP` | 5 |

**Three rules:**

1. Finishing higher pays more, on a straight line from first to last. One
   formula gives a duel `+10 / −8` and a four-way `+10 / +4 / −2 / −8`.
2. Beating somebody rated above you pays up to +3, scaled by the gap
   (`gap ÷ 5`, clamped 1–3). 345 beating 355 pays +2.
3. **Human duels only.** `recordMatch` is never reached for bot practice.

Design decisions worth not re-litigating:

- **The upset bonus goes to the winner alone**, measured against the strongest
  player they beat. Spreading it across everyone you finished above would let
  second place out-earn first by drawing a kinder field. There is a test.
- **The cap matters.** Uncapped, one win over a very strong player would be
  worth a week of ordinary duels, and the fastest route up would be to find one
  strong player and farm them.
- **A loss costs the same whoever beat you.** Flat means you can predict what a
  loss costs before you take it.
- **Absent means 300, never 0.** Every account predates the field.
- Ratings are read for the whole room **in one pass before any are written** —
  the writes run concurrently, so a duel must be scored against the board as it
  stood when it started.

Rating is **public** on profiles. A rating nobody else can see is a private
score, and a private score is not standing.

---

## 10. Ranked vs practice — the integrity line

The single most important rule in the codebase.

|  | Ranked | Practice |
|---|---|---|
| Opponent | A person | A bot |
| Refereed by | The server | Nobody — the browser |
| Moves rating | **Yes** | Never |
| Reaches leaderboard | **Yes** | Never |
| Recorded via | `recordMatch` | `POST /duels` |

A bot duel is the client's word for it, so it is stored `ranked: false` and can
never move the standings. With one combined tally the fastest route to a
perfect win rate would be beating Rookie on a loop, which would make the number
worth nothing.

Practice results carry `difficulty` (`rookie` / `rival` / `master`). An
unrecognised or absent value is **dropped, never defaulted** — defaulting to
`rookie` would manufacture progress toward unlocks nobody earned. **Missing
means unknown, never "the easiest opponent."**

`HISTORY_PER_KIND = 30` — per kind, not in total. A single combined cap would
let a run of bot duels evict every human duel from the record, and the graph
would lose its ranked line with no way to get it back.

---

## 11. Multiplayer

Rooms over API Gateway WebSockets. 2–4 players.

**The server sends the script.** Both players type the same words in the same
order, and the server validates every submission against the word that player
actually owed. Speed is computed server-side from facts it owns — the script,
how far you got, and the window between countdown and last word. A tampered
client can lie about its own display; it cannot make the server believe it
typed words it never sent.

Script is `buildScript(rounds = 10)`.

### Client → server

| Action | Meaning |
|---|---|
| `createRoom` / `joinRoom` / `listRooms` | Lobby |
| `wordComplete` | One committed word, with `wordMistakes` and `accuracy` |
| `resign` | Forfeit — knocks you out, does not hand anyone the duel |
| `rematch` | Go again with whoever is left |

### Server → client

| Message | Meaning |
|---|---|
| `hit` | Damage, healths, progress, targets, powers |
| `eliminated` | A player is out; the duel continues (`reason`: `resign` / `left`) |
| `gameOver` | `winnerSlot` |
| `rematchState` | Who is ready |
| `opponentLeft` | Nobody left to duel |

**Leaving is a loss.** Both `resign` and `disconnect` zero your health and
record the result — otherwise the fastest way to protect a win rate is to pull
the plug. A four-way carries on without you.

Rooms **outlive** a finished duel so the rest can rematch; one person walking
away shrinks the roster rather than taking the room with them.

**Concurrency:** rooms use optimistic concurrency (`saveRoom` with a `version`
check, `withRoom` retries). This is what fixed the lost-update bug where two
blades landing at once lost one player's damage. **A `withRoom` mutate function
must have no side effects — it can run several times.**

---

## 12. Storage

DynamoDB, four tables.

| Table | Key | Notes |
|---|---|---|
| `connections` | `connectionId` | TTL |
| `rooms` | `roomId` | `OpenRoomsIndex` (sparse) on `openListing`+`createdAt`; TTL |
| `players` | `userId` | `LeaderboardIndex` on `leaderboard`+`bestRankedWpm` (sparse) |
| `friends` | `userId`+`friendId` | Two rows per friendship, written in a transaction |

**Sparse indexes** throughout: the index attribute is written only when the row
belongs in the index, so queries need no filtering.

> ⚠️ **A live GSI's key schema and projection cannot be changed.** CloudFormation
> refuses outright — *"Cannot update GSI's properties other than Provisioned
> Throughput and Contributor Insights Specification"* — and the **whole stack
> update rolls back**, taking unrelated changes with it. Adding a differently
> keyed index is a separate, deliberate deploy. This is why the leaderboard
> still orders on `bestRankedWpm` rather than on rating.

### HTTP rate limits (per user)

| Budget | Limit |
|---|---|
| `lookup` | 60 |
| `friendWrite` | 20 |
| `rename` | 5 |

---

## 13. Where things live

```
keymania-web/
  game/          rules that run in the browser: engine, reducer, powers, bots, audio
  models/        shared shapes; mirrors of API contracts
  components/    the arena, HUD, profile, lobby
  tools/         Python sprite generators (gen_sprites.py, gen_characters.py)

keymania-api/
  src/lib/       rules that run on the server: rooms, rating, handles, players, scoring
  src/*.ts       one file per Lambda
  serverless.yml infrastructure
```

**Duplication is the standing hazard here.** Several things exist in both repos
(character ids, bot difficulties, scoring constants) because the two deploy
separately. Every one of those pairs is guarded by a **contract test that pins
the values literally** rather than deriving them, because a mismatch fails
*quietly* — as progress that never advances, or a fighter that renders as
nothing. If you add a shared value, add the test.

---

## 14. Known gaps

- **Spectating is server-only.** The server broadcasts to eliminated players
  and rejects their submissions, but the client has no spectator state:
  `spectating()` in `duelReducer.ts` is defined and never called, and a
  knocked-out player can still type into a void.
- **The leaderboard orders on speed, not rating** — see the GSI warning above.
- **Progression** (challenges, character locks, the unlock moment) is not built.
- `sanitiseName` has a trailing-space bug of the kind already fixed in
  `sanitiseHandle` (trim after slice, not before).

---

## 15. Extending this document

Add to it in the commit that changes the behaviour, not afterwards.

- **Numbers belong in a table**, copied from the constant, with the constant's
  name beside them so the source is findable.
- **Record the decision, not just the rule.** The rules are readable from the
  code; why a rule beat its obvious alternative is not, and that is the thing
  that gets re-litigated.
- If something here contradicts the code, **the code is right** — fix the doc
  and work out how it drifted.
