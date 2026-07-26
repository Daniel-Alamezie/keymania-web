import PixelSprite, { type SpriteName } from './PixelSprite';
import styles from './RankFlame.module.css';

export type Podium = 1 | 2 | 3;

/**
 * Listed explicitly rather than built from a template string, so a renamed or
 * missing sprite is a type error here instead of a broken image in production.
 */
const FLAMES: Record<Podium, [SpriteName, SpriteName, SpriteName]> = {
  1: ['flame-gold-1', 'flame-gold-2', 'flame-gold-3'],
  2: ['flame-azure-1', 'flame-azure-2', 'flame-azure-3'],
  3: ['flame-ember-1', 'flame-ember-2', 'flame-ember-3'],
};

/**
 * The flame burning beside a podium finisher.
 *
 * Three frames cycled by CSS, the same trick the wall torches use — cheaper
 * than a GIF, and it stops dead for anyone who has asked for reduced motion.
 */
export default function RankFlame({ rank, height = 20 }: { rank: Podium; height?: number }) {
  return (
    <span className={styles.flame} aria-hidden="true">
      {FLAMES[rank].map((name) => (
        // The first frame sits in normal flow so the span takes its size; the
        // other two stack on top of it.
        <PixelSprite key={name} name={name} height={height} className={styles.frame} />
      ))}
    </span>
  );
}
