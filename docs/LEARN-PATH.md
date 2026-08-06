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

### The stars are a ladder (reversed 2026-08-05)

The original rule was "advancing needs one star, not three" — walkable by
anybody, mastery optional. **That was deliberately reversed** after module 1
was played: the stars are now a ladder, each rung opening the next.

1. **You finished it** — every lesson typed to the end, at any accuracy.
   Written the moment the last lesson completes, not from the boss screen
   (which fixed a stranding bug where backing out before the boss recorded
   nothing).
2. **You were clean about it** — 95% across the module. **The second star
   opens the boss.** Bashing through at 60% used to be rewarded with the fun
   part anyway, which trained exactly the habit the path exists to break;
   now accuracy is the price of the fight.
3. **You beat the boss** — and **the third star opens the next module**.
   Typing is cumulative, and one star per module let somebody skim into a
   wall they could not diagnose five modules later.

Losing to the boss still costs nothing — stars only climb, rematch is right
there.

**What keeps the ladder from being the perfection-wall the original rule
feared is boss calibration, not leniency.** Each module carries its own
`bossWpm`, set for somebody who *just learned that module* — module 1 fights
at 17 wpm, not Rookie's 34, which would be twice the speed of the beginners
it now gates. The pace climbs with the curriculum, and a test pins every
boss below Rookie: these gate learners, not competitors.

The rules are stated once, plainly, on the hand tutorial's closing card —
where somebody meets the path's scoring before any of it applies to them.

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

#### A boss is not recorded as a duel (2026-08-06)

Inheriting from bot practice gave the boss the right rating behaviour and the
wrong record behaviour: it was folded into the duelling record like any other
bot fight. A player found boss fights in their Recent duels and asked whether
the path was moving their rating.

It was not, and never could be — practice is always `ranked: false`. But three
things were wrong underneath the question:

- Recent duels showed a win over eight home-row keys sitting next to real games.
- Win rate and best wpm are figures about duelling. A boss is timed against the
  curriculum's pace rather than a tier's, so its wpm is not comparable to
  anything else on that panel.
- It posted `difficulty: 'rookie'`, because Rookie is the arena it is built out
  of, while the bot typed at the module's own speed. `beatBot` in the API counts
  practice wins by difficulty, so **the home-row boss at 17 wpm was earning
  credit for beating Rookie at 34.** That is the part that was not cosmetic.

So a boss now records nowhere: not the local record, not the POST, and not
`duel_started` or `duel_finished` either, since counting one end of the funnel
and not the other would report bot duels as abandoned more often than they are.
The path's own `learn_boss` event carries the module and the pace. The rule
lives in `saveResult`, where "where does a finished duel go" is already decided
and where it can be tested, rather than in the arena.

The same inheritance was lying on screen. The arena names its opponent after the
bot tier, so every boss introduced itself as ROOKIE, a 34 wpm bot, in front of a
fight running at 17. `BossBank` now carries a `label`, and the plate, the caption
and the start button all read from the boss rather than the tier. A player being
told they are fighting Rookie is a player who reasonably expects a Rookie's
consequences.

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

#### The board and the hands (2026-08-06)

The lesson's guidance graduated from a schematic pair of hands to a full drawn
keyboard with hands resting on it — `RetroKeyboard`, fed the same single `next`
character everything else keys off. The schematic could say WHICH finger; only
a board can show where that finger has to GO, and every module after the first
is reaches.

Decisions that survived a day of prototyping at `/dev/keyboard`:

- **The hands are computed, not drawn.** Knuckles that never move, tips that go
  where they are sent. A picture can show a finger resting; it cannot show one
  leaving, and leaving is the skill.
- **One SVG, one coordinate system**, in key units. A fingertip lands ON a key
  at any rendered size.
- **One shift lights, the far one.** Both lighting taught the exact habit
  module 8 corrects.
- **The reaching finger draws last and slightly thicker.** Paint order is
  depth: a finger crossing the hand lifts over it in life, and drawing it
  under the thumb chopped the one green line on screen into fragments.
- **The hand is flattened before it is faded.** Opacity on the group, opaque
  fills inside; per-shape alpha double-darkens every overlap into a seam.

Where it shows: **lessons always** (the path is desktop-only, so the space is
there), **warm-up on desktop only** — a drawn keyboard above a phone's soft
keyboard is two keyboards half-covering each other, so touch keeps the compact
schematic. The tutorial still uses the schematic pair; its guided flow is built
around that component and swapping it is its own piece of work.

### Milestones sit where people quit

Rewards at modules 1, 2, 6, 9 and 12, plus one for three-starring everything.
Deliberately uneven: module 2 is where novelty wears off, 6 is the long middle,
and 9 is numbers — the hardest and most abandoned. Evenly spaced rewards would
miss all three.

**Every existing cosmetic in the game is earned by competing.** Duellist needs a
ranked win, Swift needs 80 wpm, Mint needs ten ranked wins. So a player who
cannot yet touch type owns nothing and cannot earn anything — and they are
exactly who the path is for. That makes these the first cosmetics many of these
players will ever hold, which is the argument for granting *real* catalogue
items rather than path-only trinkets that quietly mark somebody as a beginner.

| After | Why here | Reward | Kind |
|---|---|---|---|
| Module 1 — Home row | The loop must visibly pay before anyone has invested anything | **Spark** | name colour |
| Module 2 — Home row complete | Where novelty wears off | **Grounded** | title |
| Module 6 — Bottom row, common | The long middle | **Keysmith** | badge |
| Module 9 — Numbers | Hardest and most abandoned | **Ten Fingers** | title |
| Module 12 — Rhythm | The path is walked | **The Path** | badge |
| All 36 stars | Many hours, over weeks | **Forged** + the white flame | title **and** badge |

**The kinds alternate on purpose** — colour, title, badge, title, badge. A second
name colour at module 2 would read as "the same thing again" at precisely the
point where novelty dying is the problem being solved.

#### The 36-star flame is earned, and may be worn

The only milestone granting two things, because it is the only one that costs
many hours spread over weeks rather than an evening.

The badge is a **white animated flame, with a shine and embers coming off it**.
It is a genuine cosmetic: stored, granted by the server, and shown beside a name
where other people can see it.

**This does not conflict with the leaderboard's flame, and the distinction is
the whole point.** The board's ember/azure/gold marks a *rating* — grind through
ranked duels. This marks a *mastered path* — a different grind, honestly earned,
and it says something the board's flame cannot: not "this player is rated
highly" but "this player learned the whole keyboard properly". Two grinds, two
marks, neither devaluing the other.

It is white rather than gold precisely so nobody reads it as the board's top
tier. See [the ambient flame](#the-ladder-and-the-keyboard-beside-it) for the
separate, ungranted fire that burns behind the ladder — that one is decoration
and is never worn.

> **Art needed.** The badge is a new sprite and has no art yet. It must match
> the pixel style of the existing badges, which are produced by the Python
> generator in `tools/`.

#### The line that costs nothing

Alongside the cosmetics, and worth more than any of them: **measure them against
the bots**. The boss fight is a real timed duel, so it produces a wpm, and
`botLadder.ts` already holds the thresholds — Rookie 34, Rival 55, Master 80.

> *"42 wpm. That clears Rookie. Try a duel."*

Checkable, earned, and it is the sentence that moves somebody off the path and
into the game — which is the entire reason the path exists. It needs no art, no
catalogue entry and no API change, and it is **not blocked on #38**, because it
is a statement on a results screen rather than a granted reward.

#### What is live, and what is not

**Granted and served** (dev, as of 2026-08-05): Spark, Grounded, Ten Fingers and
Forged. `MODULE_UNLOCKS` names the first three; Forged hangs off its own
`MASTERY_UNLOCK` hook, because three-starring the path is not a module and
attaching it to `rhythm` would hand it to somebody who scraped one star on the
last module with eleven left half-done.

`TITLES_LIVE` was flipped to make the titles servable. That launched the whole
deferred titles wave, not just the path's share — Duellist, Swift, Unbroken,
Baron, and the dated weekly champion titles all became earnable and wearable in
the same commit. A test in `cosmetics.test.ts` existed precisely to force that
to be said out loud, and it did its job.

**All three badges built** (2026-08-05): Keysmith, The Path — a staircase
climbed with a flag planted, the game's ladder metaphor made literal — and the
White Flame, all animated APNGs from `scripts/badges_podium.py`, which already
did shine-and-sparkle and gained an embers extension for the flame.

One sequencing note the ladder rule created: reaching module 12 now requires
modules 1–11 at three stars, so The Path lands when module 12's lessons finish
and the mastery pair (Forged + White Flame) lands minutes later when its boss
falls. Two beats at the summit rather than one, which is the right shape for
the end of a long walk.

**Not built, and not blocked: the bot line.** See above. It is a statement on a
results screen rather than a grant, so nothing stops it.

#### The unlock moment (built 2026-08-05)

Beating a boss now lands on a completion screen instead of teleporting to the
ladder mid-kill-blow. Three staged beats, in a deliberate order: the stars pop
in first (earned by skill), the reward reveals second (a consequence, not the
point), and the bot line lands last — because it is the door out of the path
and into the game, which is what the path is for.

**The reveal is server truth.** `saveModule` diffs the earned list before and
after the PUT — the route re-reads the record before answering — so the screen
shows exactly what was granted, and there is no client-side mirror of
`MODULE_UNLOCKS` to drift. A defeat stays on the duel's own card with rematch
right there; losing costs nothing and the screen never pretends otherwise.

The bot line is the one from the original design: *"42 wpm — that clears
Rookie. Try a duel."* The boss is a real timed duel, so the number is earned,
and the thresholds come from `botLadder`'s own table.

Still open beyond the path: rewards granted outside the learn flow (weekly
podium, challenges) have no equivalent moment — that is the rest of backlog
#38, and it is not this feature's to solve.

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

The ladder is its own scroll container, because `html, body` are locked
`overflow: hidden` app-wide so a duel cannot rubber-band under a thumb. The
frontier node is scrolled to on arrival, and a floating button offers the
way back for anybody who has scrolled off to see how much is left — which they
should, because seeing the size of the thing is the other half of what a path is
for.

### The fire behind the path

The ladder and the module panel share a background flame that grows as the path
is walked. Twelve rows of a list is an inventory, and an inventory is not
something anybody feels like returning to.

**Measured in stars, not modules.** Twelve modules would give twelve steps and
eleven would be invisible — something that moves once every five minutes is a
progress bar, not encouragement. Thirty-six stars means the fire answers a
three-star run on a module already passed, which is exactly what the star
economy exists to reward.

**It never starts at nothing.** A screen that lights up only once you have
achieved something rewards the people who least need it and greets everybody
else with a void. There is always a spark; the growth is the encouragement.
Growth is front-loaded, because nothing-to-one-star is the moment somebody
decides whether this was worth opening.

**A bigger fire is a different fire, not a zoomed one.** Each of the five stages
has its own silhouette *and* palette — an ember is squat and all skin, an
inferno is tall, ragged and mostly white heart. Embers spark off the bigger
fires only, starting at `burning`: a coal does not throw sparks, and their
arrival is itself a reward, because something new appears that was not there
before.

**Its colours are deliberately not the leaderboard's.** The path runs fire's own
temperature scale — coal, amber, azure, white — and leaves ember/azure/gold to
the board. See [the 36-star flame](#the-36-star-flame-is-earned-and-may-be-worn)
for the one flame on the path that *is* granted and worn.

Everything is drawn: a silhouette function quantised onto a 19×26 grid, eight
frames, swapped with hard `steps(1)` cuts rather than eased — pixel art flickers
by cutting between drawn frames, and easing is what makes a sprite look like
vector art in a costume. A looping video would have outweighed the rest of the
feature on the screen most likely to be opened on a bad connection.

Under `prefers-reduced-motion` the fire stays but stops moving; the parallax
goes entirely, since scroll-coupled motion is the part most likely to make
somebody feel ill.

`/dev/flame` shows every stage side by side with a slider, and 404s in
production. The growth curve is the whole design and is otherwise invisible from
inside the app — seeing the top of it would mean earning 36 stars.

### The menu entry, and its copy

Four buttons, each full width, stacked:

| | |
| --- | --- |
| **Play** | find a duel at your level |
| **Learn to type** | the keyboard from scratch, or a warm-up |
| **Weekly** | same script, resets Monday |
| **Survival** | one mistake ends it |

**Revised twice on 2026-08-06,** and the second revision is the one that
mattered. The first tried a two-by-two grid pairing by stakes. That was a better
arrangement of five things; what actually fixed the menu was there being four.

Practice used to unfold a six-rung bot roster **inside the menu**. So one of the
five options was secretly a whole screen, and every layout that treated it as a
peer of the others was wrong before it was drawn. Moving it behind the hub is
what let the rest sit down a column at full width.

Ordered by how much is at stake, descending: Play is a ranked duel, Learn asks
nothing of anybody, and the two in between keep their own colours — Weekly gold,
Survival warm — so the ones that can cost you something still say so.

**Learn is second, not last.** Beginners scan top to bottom, and Survival above
Learn puts "one mistake ends it" in front of exactly the person least able to
survive it.

The label describes the content and never the reader. It is aimed at people who
cannot yet touch type, and those are exactly the people who will not press
anything that calls them beginners. No "basics", no "new players", no "start
here".

The sub-line does a different job: **it is the whole mitigation for having moved
the bot ladder.** A player who has typed for years will not look for practice
behind a button that says Learn, so the button has to tell them. "Or a warm-up"
is buying back discoverability, not describing a feature.

When the path is unavailable — the flag is dark, or this is a phone — the button
falls back to **Practice / "warm up, or take on a bot"**, because that is
honestly what is behind it then.

### The hub, and its three doors

`LearnHub`, behind the one menu entry:

| Door | Copy |
| --- | --- |
| **The path** | twelve modules, the whole keyboard, one row at a time |
| **Warm-up** | no clock, no health, no end. Words keep coming; keep the streak alive |
| **Bots** | six opponents, 34 to 150 words a minute. Beat one, then pick the next |

Ordered by how much each asks of you, which is also the order a nervous typist
needs them in: a curriculum that starts from nothing, a screen with no pressure
at all, then an opponent.

Rows rather than tiles, unlike the bot roster below. These are not three of a
kind to be compared at a glance, they are three different amounts of
commitment, and each needs a full sentence to explain itself. The roster is a
grid for the opposite reason: six things differing in one number, where picking
one means comparing them.

**Only the path is gated on `learn`.** The screen is not. Bots predate the path
by a long way, and the kill switch is meant to close a new feature rather than
take an old one down with it — same for touch, where the path is hidden by
design but a phone still gets a warm-up and a bot.

Implemented as a sub-state of `screen === 'learn'` rather than three new screen
values, so the `?learn=1` restore and the browser-Back trap keep working off one
condition instead of four. Back unwinds the same steps forward took: out of a
room to the hub, out of the hub to the menu.

### The bots get their faces

The roster was six text buttons unfolding in the menu. It is now a screen with
portraits.

**The art already existed.** `BOT_CHARACTERS` gave every difficulty its own
character a while ago, so a bot duel would stop being two identical figures
throwing knives at each other. It was drawn in the arena and nowhere else, which
meant the one moment you actually chose an opponent was the one moment you could
not see them.

Locked tiers dim rather than disappear: knowing who is waiting up there is the
reason to reach the speed that opens them, and the card still says how far away
that is. "20 wpm away" is a target; a padlock is a closed door.

### Warm-up: the mode with nothing at stake

Endless words, no clock, no health, no end. The session is over when the player
leaves.

**The streak is not the combo.** The arena's combo is explicitly about chaining
words *fast* — a speed mechanic wearing a counter — and with the time pressure
gone it has nothing left to measure. So this counts something else with the same
word, under a rule a player can hold in their head: **every clean word adds one;
any typo puts you back to zero.** A word you mistyped inside does not count even
if you then fix it, which is what `wordClean` is for; without it the counter
would climb through mistakes, which is the one thing it must not do.

**No speed is shown anywhere**, live or in the summary. A speed on screen is a
speed being judged, and this mode's claim is that nothing here is.

**It records a best streak, locally, and nothing else.** Not the duel record,
not `bestWpm`. Same rule as the boss, for a sharper reason: `bestSpeed` feeds
the bot unlock ladder, so a figure earned with no clock and no opponent leaking
into it would silently open Champion for somebody who had never fought anybody.
A streak count cannot be mistaken for a speed, which is the other reason it is
the only thing kept. It is deliberately not on the account either — the fastest
way to put something at stake is to sync a number somewhere it can be compared.

The reducer stays pure and cannot draw its own sentences: the screen feeds it a
buffer. There is a floor under that buffer which repeats the last line if it
ever runs dry, because an endless mode that can reach an empty sentence is one
that can stop dead, and a repeated line is a far cheaper failure than a screen
nobody can type on.

**Second pass, not built:** restrict the words to keys the player has learned on
the path, so a module-3 student warms up on module-3 letters. `taughtBy` gives
it almost free now the mode exists.

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
