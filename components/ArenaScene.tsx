import type { ReactNode } from 'react';
import styles from './ArenaScene.module.css';

interface ArenaSceneProps {
  children?: ReactNode;
  /** Dim the scene so foreground UI (menus, overlays) stays readable on top. */
  dim?: boolean;
  /**
   * Pin the scene to the viewport, behind everything else.
   *
   * A prop rather than something the caller does with a class of its own. The
   * menu used to pass `position: fixed; inset: 0` in its own CSS module, which
   * left two single-class rules — `.scene` and the caller's — fighting over
   * `position` at equal specificity, so the winner was whichever the bundler
   * happened to emit last. Dev and production order module CSS differently, so
   * it worked locally and collapsed the scene to zero height in production.
   */
  fixed?: boolean;
  /**
   * Stop the torches flickering.
   *
   * They are atmosphere, and atmosphere is free on a menu. Mid-duel they are two
   * pieces of the screen that move constantly without ever meaning anything, at
   * the edges of vision of somebody reading. Part of what the arena treatments
   * are testing, so it is a prop rather than a decision made here.
   */
  stillTorches?: boolean;
  className?: string;
}

/** Three stacked frames cycled by CSS — cheaper than re-rendering React 3x/second. */
function Torch({ side, still }: { side: 'left' | 'right'; still?: boolean }) {
  return (
    <div
      className={styles.torch}
      data-side={side}
      data-still={still || undefined}
      aria-hidden="true"
    >
      {[1, 2, 3].map((frame) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={frame} src={`/sprites/torch-${frame}.png`} alt="" className={styles.frame} />
      ))}
      <div className={styles.glow} />
    </div>
  );
}

/**
 * The stone arena: tiled brick wall, flagstone floor and flickering torches.
 *
 * Shared by the duel and the menu so both screens read as the same physical
 * place rather than two separately designed pages.
 */
export default function ArenaScene({
  children, dim, fixed, stillTorches, className,
}: ArenaSceneProps) {
  return (
    <div
      className={`${styles.scene} ${className ?? ''}`}
      data-dim={dim || undefined}
      data-fixed={fixed || undefined}
    >
      <div className={styles.wall} aria-hidden="true" />
      <Torch side="left" still={stillTorches} />
      <Torch side="right" still={stillTorches} />
      <div className={styles.floor} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      {children}
    </div>
  );
}
