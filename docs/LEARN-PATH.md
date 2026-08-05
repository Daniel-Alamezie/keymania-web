# The learning path

An unlockable, twelve-module route from "cannot touch type" to "can hold your
own in a duel". This document records the decisions and the reasons behind
them, because most of them are the kind that look arbitrary later and are
expensive to reverse.

Code lives in both repos: `keymania-api/src/lib/path.ts` holds the path's
shape, and `keymania-web/game/{learnPath,curriculum,lessonReducer,bossBank,fingers}.ts`
holds everything a player actually sees.

---

## Why this exists

Production data on 2026-08-04: 58 accounts, median ~6 games, and **19 of 56
active players had never played a ranked duel**. Survival outdrew ranked duels
1,607 to 1,218. The people who stay already choose to play alone.

KeyMania is a competitive game with no on-ramp. A 35 wpm player gets beaten and
leaves. The path is the on-ramp.

**The framing that shapes everything below:** touch typing takes 10–15 hours to
learn, and the path cannot contain that. *The path is the map; the game is the
gym.* It covers every key, instils the habits, and hands people to duels for the
reps.

**The point is not to rehearse letters.** Somebody can hunt-and-peck through
every module, three-star the lot, and have learned nothing except to hunt
faster. The letters are the excuse; the finger discipline is the lesson. See
[Finger guidance](#finger-guidance).

---

## Shape

| | |
|---|---|
| Modules | 12 |
| Lessons per module | 3 short, plus a boss |
| First pass per module | ~5 minutes |
| First pass, whole path | ~1 hour |
| To three-star everything | Many hours, over weeks |

An hour of content finished in one evening would be thin. **Three stars per
module is what turns 12 modules into something you come back to, and it costs
no extra authoring** — the same content at a higher bar.

### The twelve

| # | Module | Teaches |
|---|---|---|
| 1 | Home row | `asdf jkl;` |
| 2 | Home row complete | `g h` |
| 3 | Top row, common | `e i` |
| 4 | Top row | `r u t y` |
| 5 | Top row, edges | `w o q p` |
| 6 | Bottom row, common | `c n v m` |
| 7 | Bottom row | `b x z , .` |
| 8 | Capitals and shift | reaching without breaking rhythm |
| 9 | Numbers | the row nobody practises |
| 10 | Punctuation | apostrophes, semicolons, quotes |
| 11 | Awkward runs | minimum, committee, same-hand strings |
| 12 | Rhythm and endurance | evenness over bursts |

Coverage first (1–7), then the habits that are not about position at all
(8–12). Modules 11 and 12 add no new keys; what they teach is using the ones
you have. Modules 8–12 double as the daily drill pool later.

---

## Decisions

### The server holds shape, never content

Module ids, order and stars live on the API. No lesson text, no word banks.
The curriculum will be rewritten many times and none of those rewrites should
need a deploy or a migration.

The cost is that `MODULE_IDS` exists in both repos and the two must agree. It is
paid with a pinned-order test in each — copied, not imported, because the repos
share no code.

### `MODULE_IDS` is append-only

Progress is one character per module, indexed by position. **Insert a module at
position three and every player's progress shifts by one** — stars handed to
modules nobody passed, taken from ones they did, permanently, with nothing
erroring and no way to recover the old string once it is written back.

New modules go on the end. A genuine reorder is a migration, not an edit. The
pinned-order tests are the only guard; this does *not* fail typecheck.

### Stars only ever climb

Replaying a mastered module and doing badly costs nothing. Somebody practising
is doing the exact thing the feature exists to encourage, and taking a star back
would teach them to stop once they were ahead. The record is a best, not a last.

### Advancing needs one star, not three

Mastery is what stars two and three are for. Gating progress on perfection turns
a learning tool into a wall for precisely the people it was built for.

### The three stars are three different claims

Not three thresholds on one number:

1. **You finished it** — every lesson typed to the end, at any accuracy at all.
   This is what opens the next module.
2. **You were clean about it** — 95% across the module, not any single lesson.
   Sailing through two and struggling on the third is not being clean about it.
3. **You beat the boss** — the proof. Worth more than another decimal place of
   accuracy, and the reason this is a game rather than a tutor.

Losing to the boss costs nothing.

### Lessons are untimed

A clock on somebody's first touch-typing lesson teaches panic, and panic is the
habit that produces a typist who looks down, hunts, and never passes 30 wpm.
Speed is deferred, not skipped — it belongs in the boss, where it is earned.

Three things follow, each a decision rather than an omission:

- **No countdown.** Three-two-one exists to start a race fairly. Nothing is
  being raced.
- **The script is finite and never wraps.** A lesson is a fixed amount of work
  and running out of it is the goal.
- **A wrong key does not advance the cursor.** The tutor's rule, not the game's:
  letting a miss slide teaches the wrong finger as firmly as the right one
  teaches the right one.

Accuracy is shown but deliberately quiet. A percentage ticking down on every
fumble teaches the same fear a clock does.

### Every module ends in a boss, on a restricted alphabet

A bot whose entire vocabulary uses only keys that module has taught. Learn the
home row, then duel somebody who can only speak in home-row words.

**This is the reason to build the path here rather than link to Typing Club.** A
tutor can teach the home row; it structurally cannot then put you in front of an
opponent restricted to it, because it has no game on the other side.

The invariant is absolute: **every character the boss shows must already have
been taught.** One stray letter and the victory lap becomes the thing the path
exists to prevent. So the alphabet is checked, not trusted — `bossWords` filters
at runtime so a typo cannot produce an unfair fight, and `unspellable` must come
back empty in tests so the typo fails the build instead of being dropped
silently.

Boss alphabets are **cumulative**, not per-module: module three's boss may use
the home row it can assume you still know. Otherwise the path reads as
disconnected exercises rather than a keyboard being assembled.

The boss reuses the multiplayer script path rather than new sentence machinery —
`start` takes an optional script — so the restriction holds for the whole fight
rather than only its opening pair. The bot is fed from the same bank, or it
paces itself against words the player never sees.

**It touches no rating and no leaderboard**, inherited by leaving `multiplayer`
absent, exactly as bot practice does.

### Finger guidance

`game/fingers.ts` maps every key the curriculum teaches to the finger that owns
it, and the lesson screen shows it for the key being asked for *right now* — per
keystroke, not per word, because a hint that appears only when you are stuck is
one you consult after already reaching with the wrong finger.

A browser cannot see hands, so this cannot be enforced. It can only be kept in
front of somebody continuously, so the correct habit is always the easiest one
to follow.

Capitals do not move a letter to a different finger — the same finger does the
same reach, and only the shift hand is new. `shiftHandFor` returns the
**opposite** hand, which is module 8's whole lesson: shifting with the hand that
types the letter is the commonest self-taught habit and it caps somebody's speed
permanently.

### Milestones sit where people quit

Rewards at modules 1, 2, 6, 9 and 12, plus one for three-starring everything.
Deliberately uneven: module 2 is where novelty wears off, 6 is the long middle,
and 9 is numbers — the hardest and most abandoned. Evenly spaced rewards would
miss all three.

One that costs nothing and lands harder than any cosmetic: measure them against
the bots. *"You can now beat Rookie"* is checkable, earned, and it is the
sentence that moves somebody off the path and into the game.

### Nothing existing is gated behind the path

Additive only.

### The ladder, and the keyboard beside it

Both views were built rather than one being chosen from a description, and they
turned out not to be competing. The **list** is navigation — twelve named
things, in order, with the next one marked; it says *what to do now*. The
**keyboard** is the picture — key groups lighting up; it says *how much of the
machine you own*, which a list structurally cannot show.

The list leads, because the ladder's stated job is "where am I" and a keyboard
answers "how far" — it needs a legend and a caption before a lit key becomes
something you can start.

Three node states and no fourth: done with stars, next up, locked. A
started-but-unpassed state would be true and would blur the one distinction that
has to survive being seen for half a second. Each state is carried by border,
fill, brightness **and an explicit word** — never colour alone.

**SOON is not LOCKED.** A module that is open but unwritten says SOON and
refuses the tap. Showing it as locked would send somebody grinding for a door
that does not exist.

The frontier node is scrolled to on arrival, and a floating button offers the
way back for anybody who has scrolled off to see how much is left — which they
should, because seeing the size of the thing is the other half of what a path is
for.

The background runs a slow ambient loop of home-row letters rising and fading,
written in CSS rather than shipped as a video or sprite sheet: it sits behind a
scrolling list on the screen most likely to be reached on a bad connection, and
an asset would cost a download and a decode to say what a keyframe says. Letters
rather than embers, because this screen is not the arena — the rest of the game
burns, the path should feel patient. It is removed entirely under
`prefers-reduced-motion`.

### The menu entry, and its copy

Learn sits directly under Play, full width, same weight as Weekly. Practice and
Survival stay as the pair beneath.

The copy describes the content and never the reader: **"the whole keyboard, one
row at a time"**. It is aimed at people who cannot yet touch type, and those are
exactly the people who will not press anything that calls them beginners. No
"basics", no "new players", no "start here".

"New here? Read how to play" comes off the menu when Learn is on it — two doors
for one intention means most people pick neither, and Learn is the real answer
to that question. The guide moves one level in, onto the ladder. It returns to
the menu when the path is closed, because then it is the only answer there is.

---

## Operational

### The flag

`LEARN_LIVE` gates the whole feature, the same shape as `TITLES_LIVE`. It
defaults to `false` everywhere.

`getProfile` omits the `learn` block entirely unless the flag is set, so **its
presence is the client's gate too** — there is no second flag in the web repo to
drift out of step, and no way for the menu to offer a path the API would refuse
to record.

Dev is deployed manually:

```bash
LEARN_LIVE=true npx serverless deploy --stage dev
```

### Scoring is client-reported

A lesson is single-player against no opponent and grants only a star, so the
client scores it and the server records what it is told. **This is acceptable
exactly as long as a module awards nothing competitive.** The moment one grants
something touching a rating or a board, it has to become a refereed result. The
note sits in `lessonReducer.ts` and `Lesson.tsx` so it is found before that
changes rather than after.

The write-back is fire-and-forget: the server keeps the best of what it is told,
so a failed save costs a replay rather than progress.

---

## Sequencing

**Build module 1 end to end, then stop and play it before writing any
curriculum.** That is what turns the cost of eleven more modules from an
estimate into a number. If the loop is dull, one module has been lost rather
than a curriculum.

`curriculum.test.ts` asserts that `home-row` is the only authored module — the
rule, made mechanical.

## Known gaps

- **Module 1 has not been played yet.** Nothing here has been verified by a
  human walking it, and the phone layout is written narrow-first but unrendered.
- **`Lesson.tsx` lower-cases every keystroke**, so module 8 (capitals) cannot be
  scored as it stands. Modules 1–7 are lower case throughout, so it holds until
  then; it must be revisited when module 8 is written, not discovered.
- **The boss is pinned to the `rookie` tier.** Against two- and four-letter
  home-row words that may be far too easy. One line to change once it has been
  felt.
- **Milestones are blocked on the unlock moment** (backlog task 38). Rewards are
  granted silently today, and a path built on the feeling of earning something
  needs that moment to land first. `MODULE_UNLOCKS` is deliberately empty until
  then — the mechanism is in place so choosing the rewards is a one-line edit.
