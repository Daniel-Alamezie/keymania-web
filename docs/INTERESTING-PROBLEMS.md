# Interesting problems

A running log of the bugs and decisions in KeyMania that were worth more than
the time they took to fix — because the cause was somewhere surprising, because
every tool said the code was fine, or because the obvious answer was wrong.

Not a changelog. Routine work does not go here, and neither does styling: a
misplaced rule is a bad afternoon, not a lesson. What earns a place is a problem
somebody could learn from without ever having seen this codebase — a race, a
trust boundary, two systems disagreeing about the time, a cost model read the
wrong way round.

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

## 2. Two clocks, and the words that fell between them

**Symptom.** After pressing "Play again", damage stopped counting. Not always.
Intermittently, and only on a rematch, which made it look like a Lambda problem.

**Cause.** The duel has a countdown before words are accepted. The server used
`COUNTDOWN_MS = 3000`. The client counted its own three ticks at 750ms each and
therefore believed the duel was live after **2250ms**. For three quarters of a
second the player could type, and the server discarded every word that arrived,
because from where it stood the duel had not started.

Both halves were internally correct. Nobody had written down that they had to
agree.

It only showed on a rematch because a fresh duel spends its first seconds with
the player reading the screen, and 750ms of ignored typing looks like nothing at
all. On "Play again" the sentence is already familiar and the fingers are
already moving.

**In plain terms.** Two referees start the same race. One counts three seconds,
the other counts to three at his own pace and gets there in two and a quarter.
Anybody who runs when the fast referee says go is sent back, and only the
runners who already knew the course were quick enough off the line to notice.

**Fix.** The server sends `countdownMs` with the room, and the client spreads
its remaining ticks across whatever it is told (`tickDelay`). The client no
longer has an opinion about how long a countdown is.

**Lesson.** **Two systems that each measure time correctly still disagree unless
one of them is told.** The general shape here is this project's most common
failure by a distance: two correct halves and nothing enforcing the seam. It has
also appeared as a character dropped between three layers, and as a rate limit
that meant something different on each side of a socket.

A second lesson about diagnosis: the bug was reported as "the socket stopped
counting damage", which pointed at the concurrency work in entry 1. It was worth
proving that guard still live *before* touching anything, because the obvious
suspect was innocent and editing it would have produced a second bug on top of
an unfixed first.

`keymania-web/game/countdown.ts` · `keymania-api/src/lib/rooms.ts`

---

## 3. The duel nobody could leave

**Symptom.** Two players sat in a duel that neither could hit nor leave. Every
word answered "not in a duel". The room idled in `playing` until its TTL removed
the evidence.

**Cause.** A websocket dies for reasons nobody can prevent: a phone locking, wifi
handing over to mobile data, and API Gateway's own hard **two-hour cap** on any
connection. The client reconnects and gets a **new connection id**, which the
server had never linked to any room. Every subsequent message was routed by that
id, found nothing, and returned silently.

The obvious recovery — do it in `$disconnect` — does not work either. API
Gateway documents that handler as **best-effort**, and in the production
incident it simply never ran. Diagnosed on 1 August 2026, after exactly that
happened to two people whose sockets hit the two-hour cap within a minute of
each other.

**In plain terms.** You are in a phone call that drops. You call back and get a
new line, but the switchboard still has the old line marked as yours, so nothing
you say reaches the room. And the switchboard's "tell me when a line drops"
service is not guaranteed to fire, so nobody notices you left.

**Fix.** A `rejoin` route driven by the client, because **the only party who
reliably knows a connection died is the one that reconnected.** The reply
carries the whole board rather than a delta: the client has been blind for an
unknown number of exchanges, so the only honest thing to send is the complete
current state.

**The security part is the interesting half.** Identity on rejoin is the token,
never the connection. The whole premise is that the connection id is new and
worthless, so what proves a player owns a seat is the same verified `userId`
that seated them. A guest seat cannot be reclaimed at all — there is nothing to
verify a guest against, and handing a seat to whoever names a room id would let
anybody hijack a duel by guessing five characters.

**Lesson.** Anything that can be described as "the server will notice and clean
up" deserves checking against the platform's actual guarantees. Best-effort
means it will work in testing and fail in production. Recovery belongs to
whichever side has certain knowledge, which is usually not the one you would
prefer.

`keymania-api/src/rejoin.ts`

---

## 4. What a server can actually verify

Less a bug than the constraint the whole game is shaped around, and the one that
comes up in every design conversation.

**The problem.** A typing game is a stream of claims from a client: I typed this
word, in this long, at this accuracy. Almost none of it can be checked.

**What is refereed.** In a human duel the server owns the script, the clock and
both health totals. A client may only claim "I finished this word in this long";
it never says how much damage it dealt. The server checks the word really is the
one that player owed, clamps an implausible duration, computes the damage itself.
A tampered client gains nothing.

**What is not, and is accepted.** Bot practice runs entirely in the browser.
There is no server-side truth to fall back on, so every result written from it is
stored `ranked: false` and can never reach the leaderboard. That is a deliberate
trade, and it has a cost that grew after it was made: **four character unlocks
read practice tallies**, so a crafted `POST /duels` with `wpm: 300, accuracy: 100,
maxCombo: 999` unlocks four of them at once. Documented, accepted, and worth
revisiting now that there is a cosmetic economy attached.

**Design that makes cheating visible instead of impossible.** Survival's heat
mechanic forces the required pace up as a run goes on, so distance is itself a
claim about speed — the board prints the speed beside the run, and an impossible
combination is legible on the row rather than needing a report. The weekly
sprint's macro detector ships in "watch" mode: it measures every run and takes
nothing away, so the threshold can be set from real players rather than from a
guess about one.

**What is never allowed to decide anything.** Accuracy. It is on screen
everywhere and is used for ordering nowhere, because it is derived from a
keystroke count the server cannot audit. When leaderboard ties needed breaking,
accuracy was the obvious secondary on the speed board and was rejected for
exactly this reason: **a tie-break nobody can audit is a quiet way to cheat.**
Rating broke the tie instead.

**In plain terms.** You cannot watch somebody's hands through a web browser. So
you referee what you can see, you refuse to let the rest decide anything that
matters, and where you must accept a player's word you make the lie visible
rather than pretending you have prevented it.

**Lesson.** "Can the server verify this?" is not a security question you ask at
the end. It decides which numbers may rank people, which may unlock things, and
which are decoration. Getting it wrong is not usually a breach; it is a
leaderboard that quietly stops meaning anything.

`keymania-api/src/wordComplete.ts` · `src/reportDuel.ts` · `src/lib/players.ts`

---

## 5. Unlocks that cannot be forged, because they are not stored

**The decision.** Character unlocks and challenge progress are **derived from the
player record on every read**, never stored as a list.

The obvious design is a `unlocked: []` array on the account. It is also wrong in
three ways at once, and all three were avoided by not having it:

- **Nothing to forge.** Every input is a figure the server wrote itself. There is
  no "unlocked" field to tamper with because there is no such field.
- **Nothing to migrate.** A challenge added next month needs no backfill.
- **Retroactive by construction.** A new challenge credits everyone whose record
  already qualifies. A stored list would silently have meant "unlocked since we
  started counting", and every player who had already earned something would have
  had to earn it again.

**Where it does not work, and why.** Cosmetics awarded by the weekly tournament
are *stored*, not derived, and the difference is the point. A character can be
recomputed from current statistics at any time. A closed tournament cannot: the
week that qualified somebody is over, so deriving it would either hand the prize
to latecomers or take it from the people who earned it.

**In plain terms.** Instead of keeping a list of badges you own, the game works
out what you have earned by looking at what you have done, every time it asks.
So there is no list to edit, and adding a new badge tomorrow instantly gives it
to everybody who already qualified. Except for prizes for winning a particular
week — those have to be written down, because you cannot re-run last week.

**Lesson.** Ask whether a fact is *recomputable from things you already trust*.
If it is, computing it removes a migration, a forgery surface and a whole class
of drift. If it is not — because it is a record of a moment rather than a
description of a state — storing it is not laziness, it is the only correct
answer.

`keymania-api/src/lib/challenges.ts` · `src/lib/cosmetics.ts`

---

## 6. A rate limit you could reset by reconnecting

**Symptom.** None. Found by reading, during a security pass.

**Cause.** The websocket meter keys on `connectionId` and is folded into the
same DynamoDB round trip that reads which room a caller is in, which is a good
piece of engineering: metering costs no extra request on the hottest path in the
game. But `$connect` requires no token, so opening a new socket is free — and a
new socket is a **new budget**.

The stated purpose of the per-connection meter was that API Gateway's throttle is
stage-level and therefore shared, so one abuser exhausting it starves everybody
else. Reconnecting defeated precisely that.

**In plain terms.** A shop lets each customer take ten free samples. The tally is
kept on a ticket you are handed at the door, and the door is unattended, so
anybody can walk out and come back in for a fresh ticket.

**Fix, and the part worth keeping.** *Not* by moving the hot path onto an
account-keyed meter: that would add a second database round trip to every single
word typed, in order to guard against somebody who must already hold a seat to
send anything at all. The budget was moved only onto the routes that **acquire**
a seat — matchmaking, creating a room, joining one — which are the only socket
routes with a verified identity to charge anyway.

Two routes were deliberately left alone: `rejoin`, which reclaims a seat the
caller's own account already occupies and can therefore acquire nothing, and
where a false refusal would lock somebody out of a duel they are in — the exact
failure entry 3 exists to fix.

**Lesson.** A rate limit is only as good as the cost of getting a new bucket. Key
it on the most expensive identity the caller has, not the most convenient one.
And when tightening something on a hot path, ask what the limit is actually
protecting against: here the answer made two thirds of the obvious fix
unnecessary and one third of it harmful.

`keymania-api/src/lib/rateLimit.ts` · `src/lib/guard.ts`

---

## 7. The index that could not be changed — and took the deploy with it

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
This still shapes the product years of decisions later: when leaderboard ties
needed breaking, folding the tie-break into the sort key — the correct answer,
and the one the weekly board already uses — was rejected because it means a new
index under a new name, a backfill of every player, and one index change per
deploy. The ties are broken in memory over a fetched page instead, with the
limitation written down.

A second, sharper lesson: I stated the failure mode confidently and wrongly, and
the cost landed on unrelated work in the same deploy. **Being wrong about
infrastructure is more expensive than being wrong about code, because the blast
radius is everything else in the change set.**

---

## 8. A tie that looked like a rule

**Symptom.** A player tied the top survival score at 177 words with a *higher*
speed, and stayed at second. He beat 177 outright before reporting it, so the
report could not be read as self-interest.

**Cause.** Each board is a single backwards query against a sparse index, ordered
by one range key. That orders the board and says **nothing at all** about two
players holding the same number: DynamoDB returns equal range keys in whatever
order it stores them.

The dangerous property is that this order is *stable*. It does not shuffle
between requests, so it does not look random. It looks like a rule — and a player
who ties the top score and stays second is reading a rule that is not there.

The boards were also already inconsistent about it. The weekly had resolved ties
since it shipped, by packing both facts into one number (`chars * 100_000 +
(100_000 - elapsed)`), so characters dominate and the faster finish wins within a
tie. The other four boards had nothing, which is why the expectation existed to
be disappointed.

**In plain terms.** Two runners cross the line together. The scoreboard lists one
above the other because that is the order their names happen to sit in the
database, and it lists them the same way every time you look — so it reads as a
verdict rather than a coin toss that landed the same way twice.

**Fix.** One shared helper, and every board now states its ordering in the same
place. Two rules govern what may break a tie: it has to be something the **server
measured** (which is why accuracy is excluded — see entry 4), and something the
**row already shows**, so a player who loses a tie can see why from the two lines.

**Lesson.** Undefined order is not neutral. If it is stable enough to look
deliberate, users will read intent into it and they will be right to. Either
define the order or make the arbitrariness visible; do not leave it to storage
layout.

`keymania-api/src/lib/boardOrder.ts`

---

## 9. The word rubberband — a visual bug with no cause in the renderer

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
before it is reached — and never revise them.

**Lesson.** When a symptom is visual, the cause is not necessarily in the code
that draws. Ask what else, anywhere in the system, can change a size.

`keymania-web/game/duelReducer.ts` · `01e06d4`

---

## 10. Locked out of a name you never chose

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

## 11. Verifying the thing you changed, not the thing you broke

**Symptom.** A player: "we broke the arena look". The duel's stone room had
collapsed and the words had fallen down the screen. In production, within the
hour.

**Cause.** Moving two small controls into the arena's grid row. Making them
`position: relative` turned them into a real grid item, so they claimed row 2.
The arena was auto-placed into row 3, the deck into an implicit row 4, and the
arena went from 616px tall to 240.

**The interesting part is not the bug. It is that I had verified it.** Before
pushing, I checked two things in a live duel: that the controls landed where
intended, and that they overlapped nothing. Both were true. Neither could ever
have caught this, because **a displaced element does not overlap anything — it
just moves.** I measured what I had added and never re-measured what was already
there.

**In plain terms.** I moved a chair into a room, then carefully checked the chair
was in the right place and not touching anything. It was. I did not notice the
table had been pushed into the next room to make space.

**Fix.** `position: absolute` instead. An out-of-flow child occupies no grid
track and creates none, but a `grid-row` still hands it that row as its
containing block. And the verification changed: the assertion is now on the
layout as a whole, compared against numbers recorded *before* the change was
written.

**Lesson.** **Assert on what you might have broken, not only on what you added.**
A test that only inspects the new thing will pass for every bug whose symptom is
somewhere else — which is most of them. Recording the baseline before you start
costs one command and is the only way to tell "correct" from "unchanged".

---

## 12. Reading a price list off by a factor of a thousand

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

## 13. A find-and-replace that matched nothing, and took down a feature

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

**Lesson.** This is the highest-cost recurring mistake in the project, and it has
recurred: a silent no-op edit also failed to add a `character` field to a type
later (caught that time only because the type checker noticed). **Every
programmatic edit needs to assert it changed something.** An edit that quietly
does nothing is worse than one that fails, because it leaves you believing the
work is done.

---

## 14. Fusing two sounds by removing the middle

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

## Smaller ones worth remembering

- **Reading a field off an index that does not carry it.** A board row was about
  to read `rating` from an item fetched out of a projection that omits it. Every
  row would have rendered the starting rating of 300 and looked entirely
  plausible. Caught before shipping by checking the projection rather than the
  code — the type system cannot help, because the shape says the field exists.

- **Trim after slicing, not before.** `sanitiseHandle` trimmed trailing
  underscores and *then* truncated to the maximum length, which could
  reintroduce one. `sanitiseName` still has the equivalent bug with spaces.

- **Two repos, no enforcement.** Several values are duplicated across the web
  and API repos because they deploy separately — character ids, bot
  difficulties, scoring constants. A mismatch fails *quietly*: a fighter that
  renders as nothing, or progress that never advances. Each pair is now guarded
  by a contract test that **pins the values literally rather than deriving
  them**, since a derived test would agree with itself while both sides drifted.

- **A practice mode must not produce a number the ladder reads.** The warm-up is
  safe from feeding the bot unlock ladder because it only ever keeps a *streak*,
  which cannot be mistaken for a speed. The typing test added later produces
  exactly the dangerous quantity, so the rule had to be held deliberately
  instead: its record is per-length, on the device, and no path from it writes
  to a profile.

- **Turning on a stricter check can be an outage.** Token audience validation is
  correct and currently off, because the tokens carry no `aud` claim at all —
  switching it on before the client requests one would 401 every request on
  every route at once. The rollout order is written into the code, and the
  failure is instrumented by cause so the mistake is visible in a metric rather
  than as a mystery.

---

## The through-line

Most of these were cheap to fix and expensive to find, and for nearly all of
them **every automated check was green.** The habits that actually paid:

1. **Two correct halves, and nothing holding the seam.** The single most common
   shape in this file: a client and a server each counting time correctly, a
   character passed through three layers and dropped by one, two repos agreeing
   about a constant until they did not. Whenever two things must agree, ask what
   *enforces* it. Usually the honest answer is nothing.
2. **Ask what the server can actually verify.** It decides which numbers may
   rank people and which are decoration, and it is a product decision disguised
   as a security one.
3. **Measure the running thing, and record the baseline first.** The layout
   regression was shipped precisely because the measurement taken was of the new
   thing rather than of everything around it.
4. **Watch your test fail.** Every regression test here was reverted against the
   old behaviour to confirm it catches it. Two of them were nearly wrong.
5. **Assert your edits changed something.** The most expensive recurring mistake
   in this project has been a replacement that matched nothing.
6. **Undefined is not the same as random.** Storage order, missing fields and
   best-effort handlers all behave consistently enough in testing to look like
   guarantees. They are not.

---

## Adding to this file

Add an entry when the *cause* was somewhere you would not have predicted, when
the tooling was confidently wrong, or when the obvious fix was the wrong one.

Do **not** add styling or layout bugs unless the lesson is about something else —
entry 11 is here for how the verification failed, not for the CSS.

Use the shape above: **Symptom → Cause → In plain terms → Fix → Lesson**, plus
file paths and a commit where there is one.

Two things to keep honest:

- **Write the plain-language version properly.** It is the part that proves the
  problem is understood, and the part that survives being retold.
- **Record your own wrong turns.** The misread pricing and the layout regression
  are more useful here than the fixes are, because the reasoning that produced
  them was reasonable at the time and will be again.
