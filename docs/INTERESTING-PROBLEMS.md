# Interesting problems

A running log of the bugs and decisions in KeyMania that were worth more than
the time they took to fix — because the cause was somewhere surprising, because
every tool said the code was fine, or because the obvious answer was wrong.

Not a changelog. Routine work does not go here. An entry earns its place if
somebody could learn something from it without ever having seen this codebase.

Each entry carries a **plain-language** version as well as a technical one. That
is not padding: if you cannot explain a bug to somebody who has never
programmed, you probably have not finished understanding it. It also means this
file is usable in a conversation, an interview, or a write-up, not only at a
terminal.

> Companion documents: [GAME.md](GAME.md) is how the game works. This is what
> went wrong on the way there.

---

## 1. Damage that silently vanished — a lost update

**Symptom.** In four-player duels, damage sometimes did not count. The blade
flew, the animation played, the health bar did not move.

**Cause.** Every `wordComplete` read the room, applied its damage, and wrote the
whole room back. Two blades landing in the same tick meant two Lambdas read the
same room state, each applied only its own damage, and the second write
clobbered the first. Rare in a 1v1, where two people seldom commit a word in the
same instant. Increasingly likely as the room fills — which is exactly why it
surfaced when four-player mode arrived.

**In plain terms.** Four people share one paper scoreboard. Two glance at it at
the same moment and both see "100". One does their sum and writes 90; the other,
still working from 100, writes 92. The first hit has been erased — not lost in
transit, but overwritten by someone using a stale number.

**Fix.** Optimistic concurrency. Rooms carry a `version`. `saveRoom` writes with
`ConditionExpression: version = :seen` and throws `RoomConflict` if it has
moved; `withRoom` re-reads and re-runs the mutation, up to five times.

One constraint falls out of it and is easy to violate later:

> **A `withRoom` mutate function must have no side effects — it can run several
> times.** A broadcast or a second write inside one would fire twice on every
> retry.

**Lesson.** Read-modify-write across concurrent workers is a bug waiting for
enough traffic to become visible. The test is the interesting part: it stands up
a fake DynamoDB that *enforces* condition expressions and counts writes, so the
race reproduces deterministically. The fix was reverted to confirm the test
fails — **a concurrency test nobody has watched fail is decorative.**

`keymania-api/src/lib/rooms.ts`, `src/lib/tests/roomStore.test.ts`

---

## 2. The index that could not be changed — and took the deploy with it

**Symptom.** A production deploy failed and rolled back, cancelling several
unrelated changes shipping alongside it: a new friends table, routes, log groups.

**Cause.** A change to a DynamoDB global secondary index's projection. I had
predicted CloudFormation would delete and recreate the index with a brief
backfill. It does not:

```
Cannot update GSI's properties other than Provisioned Throughput
and Contributor Insights Specification
```

It refuses outright, and the **whole stack update** rolls back.

**In plain terms.** A library's card index is sorted by author. You decide you
would rather have it by publication year. You cannot relabel the drawers — you
have to build a second index from scratch. And when you tried to relabel it
anyway, the librarians cancelled the entire day's renovation and put everything
back exactly as it was.

**Fix.** Reverted the projection and fetched the missing field per row instead.

**Lesson.** A live index's key schema and projection are effectively immutable.
**Your access patterns are a deploy-time decision, not a configuration tweak.**
This is still shaping the product: the leaderboard sorts on best-wpm rather than
on rating, because switching means a new index and a deliberate migration.

A second, sharper lesson: I stated the failure mode confidently and wrongly, and
the cost landed on unrelated work in the same deploy. **Being wrong about
infrastructure is more expensive than being wrong about code, because the blast
radius is everything else in the change set.**

---

## 3. The word rubberband — a visual bug with no cause in the renderer

**Symptom.** The typing stream lurched and re-jumped as sentences scrolled past.

**What everyone looked at.** The scrolling and easing code. Twice. It was
correct both times, and confirming that was not progress.

**Cause.** Power words carry `padding: 0 4px`. So **"is this word charged?" is a
layout fact, not a colour one.** The reducer decided a sentence's charges at the
moment the player rolled onto it — meaning in a single frame every arriving word
grew 8px and every departing word shrank by the same amount. The caret stayed
pinned by the snap logic, so what you actually saw was the line lurching *around*
the caret.

**In plain terms.** Highlighted words are physically a few pixels wider than
plain ones. The game was deciding which words to highlight at the exact instant
they slid into view — so picture a queue shuffling past you where some people
pull on a puffy coat the moment they draw level. Everyone behind them shifts.

**Why it survived an earlier fix.** It only ever happened in solo play. In
multiplayer the server sends charges for the whole script before the duel
starts, so a word's width is settled long before it is drawn.

**Fix.** Decide a sentence's charges while it is still `upcoming` — one roll
before it is reached — and never revise them. Indices that scroll out of sight
are pruned so a long session does not accumulate a charge per word.

**Lesson.** When a symptom is visual, the cause is not necessarily in the code
that draws. Ask what else, anywhere in the system, can change a size. The test
walks a solo duel through six rolls and asserts no word's charge changes while
it is on screen; it fails against the old behaviour with
`word 0 changed charge while visible: expected undefined to be 'ward'`.

`keymania-web/game/duelReducer.ts` · `01e06d4`

---

## 4. Valid CSS that silently deleted a rule

**Symptom.** Two health bars, both players on full health, one roughly five
times longer than the other.

**Cause.** A refactor left two selectors without braces:

```css
.foe[data-targeted]
.foe[data-out]

.foes { display: flex; flex: 1; ... }
```

CSS does not treat this as an error. It reads all three as one descendant
selector — `.foe[data-targeted] .foe[data-out] .foes` — which nothing in the
tree can ever match. `.foes` therefore received **no rules at all**: no
`display: flex`, no `flex: 1`. It fell back to its content width.

**In plain terms.** I left a sentence unfinished. The computer joined my half
sentence to the next one and read the result as a single instruction. That
combined instruction was perfectly good grammar — so no spell-checker
complained — it just described a situation that can never occur. The styling
quietly stopped applying to anything.

**How it was found.** Not by tooling. It compiled, `lint` passed, all 123 tests
passed, and the only symptom was a layout that looked deliberate. It was found
by measuring the rendered elements in a live browser: **891px and 190px**. After
deleting the two orphaned lines: **540px and 540px**.

**Lesson.** Linters catch what is *broken*. They cannot catch what is *valid but
not what you meant* — and no CSS linter would flag that merged selector, because
there is nothing wrong with it. When a layout looks like a decision, measure it
before assuming somebody decided it.

`keymania-web/components/Duel.module.css` · `67c1309`

---

## 5. Locked out of a name you never chose

**Symptom.** A player reported that a brand new account could not change its
username.

**Cause.** Two features colliding. There is a cooldown on changing your handle —
an anti-impersonation measure, so a name cannot be worn, seen and dropped
repeatedly. Separately, the server *seeds* you a handle the first time you open
your profile. Both went through the same `claimHandle`, which stamps
`handleChangedAt`. So the cooldown clock started on a name the player had never
seen, **in the same request that created their account.** The first change was
never free — and the comment in the code claimed the opposite, describing an
intention the code did not implement.

**In plain terms.** A school assigns you an email address and then tells you you
cannot change it for a month because "you have already changed it once." You had
not. They had.

**Fix.** Record whether the handle was actually *chosen* (`handleChosen`), and
key the cooldown off that rather than off merely having a handle.

The pleasing part: the flag is **absent on every record written before it
existed** — and those are precisely the players who were stuck. Reading
"unknown" as "not chosen yet" frees all of them, with no migration and no
backfill. **The missing data did the work.**

**Lesson.** When two features touch the same field, one of them is probably
making an assumption the other breaks. And a comment asserting a behaviour is
not evidence the behaviour exists — this one had been wrong since it was
written.

`keymania-api/src/lib/handles.ts` · `49e548d`

---

## 6. The character choice that was being thrown away

**Symptom.** Pick a character, start a duel against a bot, and the default
appears instead.

**Cause.** The starting state is server-rendered, so it cannot read a player
profile — it builds both fighters with the default character. Nothing ever came
back and substituted the player's actual choice once it was known. The pick was
not failing to render. It was being discarded.

**What made it look worse.** The default character was also the easiest bot's
character. So the common case was two identical figures on screen, which reads
as the picker being completely broken rather than as one value not being passed.

**Fix.** Carry the character on the `start` action instead of baking it into the
server-rendered initial state. Give each bot its own character so the three tell
apart on sight, and if a bot's character collides with the player's, **the bot
moves** — the player chose theirs, the bot did not choose its.

**Lesson.** Server-rendered initial state cannot depend on per-user data, and
anything that does has to arrive later by another route. Also: a bug's *apparent*
severity is set by what the user sees. The same missing value would have looked
like a minor glitch if the default had not happened to duplicate the opponent.

`keymania-web/game/duelReducer.ts` · `61f63fc`

---

## 7. A find-and-replace that matched nothing, and took down a feature

**Symptom.** In production, the friends list returned "Could not load your
friends." CloudWatch showed `AccessDenied ... dynamodb:Query`.

**Cause.** An edit to `serverless.yml` was anchored on text that did not exist —
it expected `- Fn::GetAtt` after a comment, where the real next line was
`- Fn::Sub:`. The replacement **matched nothing, changed nothing, and reported
nothing.** The IAM grant was never added. Everything else about the feature
shipped fine, so it looked complete right up until a real user tried it.

**In plain terms.** I did a find-and-replace for a phrase that was not in the
document, so nothing changed — and I never checked whether it had. The
permission was simply never granted.

**Fix.** Re-read the block and made the edit with an assertion that it actually
applied.

**Lesson.** This is the highest-cost recurring mistake in the project, and it has
recurred: a silent no-op edit also failed to add a `character` field to a type
later (caught that time only because the type checker noticed). **Every
programmatic edit needs to assert it changed something.** An edit that quietly
does nothing is worse than one that fails, because it leaves you believing the
work is done.

---

## 8. Reading a price list off by a factor of a thousand

**What happened.** I estimated about **$6/month** for a presence feature at
scale. The pricing is per *request*; I had read 1.2 million requests and talked
about it as 1.2 million *users*. One user generates hundreds of requests. The
real figure at a million daily active players is closer to **$5,900/month**.

**In plain terms.** I quoted the cost of a thousand phone calls as though it were
the cost of a thousand customers.

**Lesson.** Cloud pricing is denominated per action; product thinking is
denominated per person. **Convert units before the number reaches a decision.**
Being out by 1000× is not a rounding error, it is a different architecture.

---

## 9. Fusing two sounds by removing the middle

Not a bug — a design problem where the obvious answer is actively wrong, which
makes it worth keeping.

**The ask.** A player suggested combining the "creamy" and "thocky" keyboard
sounds.

**Why averaging fails.** One profile centres around 1350Hz, the other around
520Hz. Split the difference and you land near 900Hz — the boxy region *both*
profiles are deliberately shaped to avoid. The result is muddier than either
parent.

**In plain terms.** Mixing two nice paint colours usually gives you brown.

**What actually works.** Keep both ends and hollow out the space between: a low
body around 168Hz, a smooth band from 620Hz upward, and deliberate emptiness in
the middle. **The gap is the effect** — it is why expensive keyboards sound
expensive.

**Lesson.** "Combine A and B" rarely means "average A and B". Find out what each
one is actually doing before blending them.

`keymania-web/game/keyProfiles.ts`

---

## 10. Fixing empty space by making things smaller

**Symptom.** The duel screen had a lot of unused room.

**My first attempt.** Cap the arena's height and centre it. This did not fill
anything — it shrank the frame, so the empty space moved *outside* the border
and became margin instead. Worse, with the health bars still pinned to the top
of the window, it pushed health and the words you type **738px apart, further
than before** — the exact problem the change was meant to solve.

**In plain terms.** The room felt empty, so I made the room smaller instead of
buying bigger furniture.

**The actual fix.** The opposite instinct: a bigger actor, not a smaller stage.
The sprite height became a clamp against viewport height so the fighter grows
with the arena, and the typing stream moved *into* the arena so the fight and
the words share one glance. Fighters went from 14% of the stage to about half.

**Lesson.** "There is too much empty space" and "the layout is wrong" are
different diagnoses with opposite fixes. The reason the space felt wasted was
not that it existed — it was that the three things a player needs were spread
across three bands, and you can only look at one.

`keymania-web/components/Duel.module.css` · `7407889`

---

## Smaller ones worth remembering

- **`overflow: visible` is not neutral.** Setting `overflow-y: auto` silently
  resolves the *other* axis to `auto` too. A chart drawing slightly outside its
  box was then enough to put a horizontal scrollbar on a page with nothing to
  see sideways. Fixed with an explicit `overflow-x: hidden`, which looks
  redundant and is not.

- **A styling rule that only makes sense in a crowd.** Opponents are dimmed and
  scaled down when you are not aimed at them — but the rule that *undoes* it
  only ever applied when there was more than one opponent. So in every ordinary
  duel your opponent was permanently faint and small, with nothing that could
  bring them forward. It read as a rendering fault, and it was one.

- **Trim after slicing, not before.** `sanitiseHandle` trimmed trailing
  underscores and *then* truncated to the maximum length, which could
  reintroduce one. `sanitiseName` still has the equivalent bug with spaces.

- **Two repos, no enforcement.** Several values are duplicated across the web
  and API repos because they deploy separately — character ids, bot
  difficulties, scoring constants. A mismatch fails *quietly*: a fighter that
  renders as nothing, or progress that never advances. Each pair is now guarded
  by a contract test that **pins the values literally rather than deriving
  them**, since a derived test would agree with itself while both sides drifted.

---

## The through-line

Most of these were cheap to fix and expensive to find, and for nearly all of
them **every automated check was green.** The habits that actually paid:

1. **Measure the running thing.** The health-bar bug, the fighter sizing and the
   layout work were all resolved by reading real numbers out of a live browser,
   not by reasoning about the code.
2. **Watch your test fail.** Every regression test here was reverted against the
   old behaviour to confirm it catches it. Two of them were nearly wrong.
3. **Assert your edits changed something.** The single most expensive recurring
   mistake in this project has been a replacement that matched nothing.
4. **Suspect the layer you have not looked at.** The stream bug was in the
   reducer. The health-bar bug was a missing brace. Neither was in the code that
   draws.

---

## Adding to this file

Add an entry when the *cause* was somewhere you would not have predicted, when
the tooling was confidently wrong, or when the obvious fix was the wrong one.

Use the shape above: **Symptom → Cause → In plain terms → Fix → Lesson**, plus
file paths and a commit where there is one.

Two things to keep honest:

- **Write the plain-language version properly.** It is the part that proves the
  problem is understood, and the part that survives being retold.
- **Record your own wrong turns.** The capped-arena attempt and the misread
  pricing are more useful here than the fixes are, because the reasoning that
  produced them was reasonable at the time and will be again.
