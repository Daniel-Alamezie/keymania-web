# Analytics

PostHog, for the questions this service cannot answer. CloudWatch on
`keymania-api` sees everything the *server* did — see
[OBSERVABILITY.md](../../keymania-api/docs/OBSERVABILITY.md) — and is blind to
everything that happens in a browser: whether somebody who landed ever started
a duel, whether they finished it, and whether they came back.

**It is inert until a key is configured.** No key means every call is a no-op,
so a fork, a preview branch and local development report nothing without a
single `if` at a call site.

---

## 1. Getting a key

1. Sign up at **[posthog.com](https://posthog.com)** — the free tier is 1M
   events and 5k replays a month, which is far beyond this game's scale.
2. Choose the **EU** region unless you have a reason not to. Most players will
   be closer to it, and it keeps EU data in the EU.
3. Create a project. PostHog shows a **Project API key** starting `phc_…`.

That key is *public* by design — it ships in the browser bundle and can only
write events, never read them. It is still kept out of git, because rotating a
key that is committed means a new deploy rather than a click.

## 2. Where to put it

**Locally**, in `.env.local` (already git-ignored). Do not paste it into a chat
or a commit:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Use `https://us.i.posthog.com` instead if you chose the US region. The host
defaults to EU, so that line is only needed if you did.

**In production**, Vercel → the project → Settings → Environment Variables →
add both for **Production** — then redeploy, because `NEXT_PUBLIC_*` values are
baked into the bundle at build time rather than read at run time. This is the
step people miss: adding the variable alone changes nothing until something
rebuilds.

## 3. What is tracked

Deliberately short. Analytics rots by accretion — somebody adds an event for a
question they had once, nobody deletes it, and a year later half the dashboard
measures things that have changed meaning. Every event here answers a question
worth acting on. If one stops earning its place, delete it.

| Event | Properties | The question it answers |
|---|---|---|
| `duel_started` | mode, difficulty, touch | Do people who land actually play? Which bot? On a phone? |
| `duel_finished` | mode, won, wpm, accuracy, seconds | Do they see it through, and how did it go? |
| `duel_abandoned` | mode, at_word | **The strongest negative signal.** They quit mid-duel, and how long it took to decide. |
| `rematch_taken` | mode | **The strongest positive signal.** They chose to go again. |
| `guide_opened` | — | Was it obvious how to play? |
| `character_saved` | character | Did progression register as something worth engaging with? |

Events are a **typed union** in `game/analytics.ts`. A mistyped event name is a
compile error rather than a second event nobody notices for a month.

`$pageview` is sent by hand on route change. PostHog's automatic version fires
on load, which in an App Router application means once per session however many
pages somebody visits — the profile pages would have looked unvisited.

## 4. The three questions worth asking on launch day

Everything above exists to answer these. Build them as **Insights → Funnel**:

1. **Does anybody play?** `$pageview` → `duel_started`. If this is low, the
   landing page is the problem, not the game.
2. **Is it any good?** `duel_started` → `duel_finished`, against
   `duel_started` → `duel_abandoned`. A high abandon rate with a low `at_word`
   means people bounced off immediately; a high one with a *high* `at_word`
   means duels drag.
3. **Do they want more?** `duel_finished` → `rematch_taken`. This is the number
   that predicts whether anything else matters.

Break all three down by the `touch` property — you have just added mobile
support and have no idea yet whether it is usable.

## 5. Privacy

- **Anonymous visitors get no person profile.** `person_profiles:
  'identified_only'`. The costly default creates a durable profile for every
  visitor who ever loads the page — thousands of them on a launch day, for
  people who bounced in four seconds. Their *events* are still recorded, so
  funnels are unaffected.
- **Identification is by opaque id only** — the Kinde `sub`, never an email, a
  display name or a handle. Following one player across two devices is a fair
  question; keeping a copy of who they are in a third-party tool that does not
  need it is not.
- **Replays mask all inputs**, which covers the name and handle fields, and
  mask anything marked `ph-no-capture` — currently the friends list, which is
  other people's names. Masking *all* text was the first instinct and the wrong
  trade: a replay of a typing game with the words blanked out shows nothing
  worth watching.

## 6. Checking it works

With the key set, run the app and open PostHog → **Activity**. Events appear
within a few seconds. If nothing arrives:

- **Ad blockers block PostHog by default.** This is the usual answer, and it
  also means your real numbers undercount by however many players run one. Try
  a clean browser profile before assuming the setup is wrong.
- Confirm the key reached the bundle: in devtools, `window.posthog` should be
  defined. If it is `undefined`, the variable was not present at *build* time.
