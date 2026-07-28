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
export default function RankFlame({ rank, height = 20 }: { rank: Podium; height?: number }) {
  return <Flame kind={BY_RANK[rank]} height={height} />;
}
