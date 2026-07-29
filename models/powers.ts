/**
 * Charged-word powers.
 *
 * A word glows; typing it correctly fires the power immediately. The keyboard
 * stays the only input — a typing game should never ask you to reach for a
 * hotkey.
 *
 * In multiplayer the server decides which words are charged and applies every
 * effect, because it owns health. Mirrors `lib/powers.ts` in keymania-api.
 */
/**
 * The roster, and the type derived from it.
 *
 * One list, not a list and a union written out beside it. Those were two
 * declarations of the same fact in this file *and* two more in
 * keymania-api/src/lib/powers.ts — four copies, none derived from any other,
 * so adding a power meant remembering all four and a mismatch failed silently.
 * Deriving the type means the array is the only thing to edit, and a contract
 * test pins it against the server's copy.
 */
export const POWERS = ['ward', 'surge', 'mend'] as const;

export type PowerKind = (typeof POWERS)[number];

/**
 * Whether a power is *held* until it is used, or fires the moment it lands.
 *
 * The HUD only draws the held ones — an instant power has nothing to show,
 * because by the time you could look at it, it has already happened.
 */
export const HELD_POWERS: readonly PowerKind[] = ['ward', 'surge'];

/**
 * Adding a power: what is easy now, and what is still not.
 *
 * **Easy.** Add an id to POWERS above and TypeScript walks you through the
 * rest: `POWER_META` is a `Record<PowerKind, …>` and will not compile without
 * an entry, and the HUD draws its slots from `HELD_POWERS`, so a new held power
 * appears without anybody editing a component. A contract test on each side
 * pins the two rosters against each other.
 *
 * **Still not.** Held powers are stored as one boolean field per power —
 * `ward` and `surge` on both `DuelState` here and `Player` on the server — and
 * the wire carries them as parallel `wards` / `surges` arrays. A fourth held
 * power therefore still needs a field in two repos, an entry in `setPowers`,
 * and another array in the `hit` message.
 *
 * Turning those into a single `held: PowerKind[]` is the remaining piece, and
 * it is deliberately not done in the same change as the rest: it alters the
 * protocol, so client and server have to agree across a deploy, and this
 * project has already been bitten twice by exactly that. It wants its own
 * change, sending both shapes for one release.
 *
 * An *instant* power — one that fires and is gone, like mend — needs none of
 * that and can be added today.
 */
