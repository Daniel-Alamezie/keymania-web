import PixelSprite, { type SpriteName } from './PixelSprite';
import styles from './RankFlame.module.css';

export type Podium = 1 | 2 | 3;

/** The three colourways, hottest first. */
export type FlameKind = 'gold' | 'azure' | 'ember';

/**
 * Listed explicitly rather than built from a template string, so a renamed or
 * missing sprite is a type error here instead of a broken image in production.
 */
const FLAMES: Record<FlameKind, [SpriteName, SpriteName, SpriteName]> = {
  gold: ['flame-gold-1', 'flame-gold-2', 'flame-gold-3'],
  azure: ['flame-azure-1', 'flame-azure-2', 'flame-azure-3'],
  ember: ['flame-ember-1', 'flame-ember-2', 'flame-ember-3'],
};

/** Podium position happens to map onto the three colours. */
const BY_RANK: Record<Podium, FlameKind> = { 1: 'gold', 2: 'azure', 3: 'ember' };

const CROWNS: Record<FlameKind, [SpriteName, SpriteName, SpriteName]> = {
  gold: ['crown-gold-1', 'crown-gold-2', 'crown-gold-3'],
  azure: ['crown-azure-1', 'crown-azure-2', 'crown-azure-3'],
  ember: ['crown-ember-1', 'crown-ember-2', 'crown-ember-3'],
};

/**
 * A burning flame, in one of three colours.
 *
 * Keyed on colour rather than on rank, because the same three sprites now mean
 * three different things in three places — a podium finish, a rating tier, and
 * the challenge you are closest to. Tying the component to "podium" would have
 * meant either a second copy of the frame-cycling or callers passing `rank={2}`
 * to mean "azure", which reads as a bug.
 */
export function Flame({ kind, height = 20 }: { kind: FlameKind; height?: number }) {
  return (
    <span className={styles.flame} aria-hidden="true">
      {FLAMES[kind].map((name) => (
        // The first frame sits in normal flow so the span takes its size; the
        // other two stack on top of it.
        <PixelSprite key={name} name={name} height={height} className={styles.frame} />
      ))}
    </span>
  );
}

/**
 * The flame burning beside a podium finisher.
 *
 * Three frames cycled by CSS, the same trick the wall torches use — cheaper
 * than a GIF, and it stops dead for anyone who has asked for reduced motion.
 */
/**
 * The burning crown beside a player at the top of the standings.
 *
 * A crown is affordable *here* precisely because only three exist at a time.
 * The same mark beside everybody's rating would say the same thing about a
 * beginner as about the best player in the game, and would spend the symbol
 * before anybody had won it — which is why a rating gets a tiered flame
 * instead. Scarcity is the whole of what a crown means.
 *
 * Drawn at 17px by default: the sprite is 17 tall, so 1:1. Pixel art scaled by
 * a fraction maps some source rows to two screen pixels and their neighbours
 * to one, and a crown this small cannot spare the wobble.
 */
export default function RankFlame({ rank, height = 17 }: { rank: Podium; height?: number }) {
  return (
    <span className={styles.flame} aria-hidden="true">
      {CROWNS[BY_RANK[rank]].map((name) => (
        <PixelSprite key={name} name={name} height={height} className={styles.frame} />
      ))}
    </span>
  );
}
