# models

Data shapes, one file per domain concept.

## What belongs here

Anything that describes **data** — above all, anything that crosses the network.
If you are asking "what does this endpoint actually return?", the answer is in
this folder and nowhere else.

- `protocol.ts` — the WebSocket duel protocol, both directions
- `room.ts` — lobby rooms and their sizes
- `profile.ts` — `GET`/`PUT /api/me/profile`, plus the browser-local record
- `leaderboard.ts` — `GET /api/board`
- `duel.ts` — the duel's own state, actions and fighters
- `scoring.ts` — blades, damage and word attempts
- `bot.ts` — difficulty tiers and what a bot emits
- `powers.ts` — charged-word powers

## What does not

**Component props stay with their component.** `WpmChartProps` next to
`WpmChart` is not mess — moving it means opening two files to read one
component, which is the opposite of why this folder exists.

The same goes for handles and hook return types (`EffectsHandle`, `BotHandle`,
`ProfileState`, `MessageHandler`). Those describe an *interface to code*, not a
shape of data.

## Keeping it clean

One file per domain concept, named after the thing. When a new type appears the
question is "what is this about?", not "where do types go?" — the second
question is what produced the old `game/types.ts`, a single file holding
scoring, rendering, lifecycle and bot types with nothing in common.

Files here import only from each other. Nothing in `models/` imports from
`game/` or `components/`, so there is never a cycle to unpick.

## A warning

These shapes are duplicated in `keymania-api` and **nothing enforces that the
two agree** — `DuelResult`, `Tally`, `RoomSummary`, `RoomSize` and `BoardEntry`
all exist in both repos. If the server renames a field, nothing here fails to
compile; the UI just renders `undefined`. A contract test is the cheap fix when
it starts to bite.
