import type { ReactNode } from 'react';
import styles from './ArenaScene.module.css';

interface ArenaSceneProps {
  children?: ReactNode;
  /** Dim the scene so foreground UI (menus, overlays) stays readable on top. */
  dim?: boolean;
  className?: string;
}

/** Three stacked frames cycled by CSS — cheaper than re-rendering React 3x/second. */
function Torch({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={styles.torch} data-side={side} aria-hidden="true">
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
export default function ArenaScene({ children, dim, className }: ArenaSceneProps) {
  return (
    <div className={`${styles.scene} ${className ?? ''}`} data-dim={dim || undefined}>
      <div className={styles.wall} aria-hidden="true" />
      <Torch side="left" />
      <Torch side="right" />
      <div className={styles.floor} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      {children}
    </div>
  );
}
