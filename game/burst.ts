/**
 * Pixel confetti.
 *
 * Fired when a charged word is claimed, and nowhere else. Powers are the one
 * thing in the stream worth chasing, so the reward for taking one has to be
 * bigger than the reward for typing well — otherwise the risk of breaking a
 * combo on a long word buys you nothing you can see.
 *
 * Particles live in a fixed layer on the body rather than inside the word that
 * spawned them. The stream clips to a single line (`overflow: hidden` is what
 * makes it a stream at all), so anything parented to a word would be sliced off
 * within a few pixels. A detached layer also means the confetti stays where it
 * was thrown while the text glides on underneath — which is what confetti does.
 */

/** Enough to read as a shower, few enough to stay cheap on a mid-duel frame. */
const COUNT = 18;
/** Radians either side of straight up. Wide, but never downward at the start. */
const SPREAD = Math.PI * 0.9;

let layer: HTMLDivElement | null = null;

/**
 * Whether the player has asked for less movement.
 *
 * Checked here in JavaScript because the global `prefers-reduced-motion` rule
 * in globals.css only reaches CSS animations and transitions. Everything driven
 * by the Web Animations API — this, and every flare in the stream — ignores it
 * completely, so the stylesheet gives a false impression of coverage.
 */
function reducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureLayer(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  // isConnected rather than a plain null check: React can replace the body's
  // contents on a route change and leave this holding a detached node, which
  // would silently swallow every burst from then on.
  if (layer?.isConnected) return layer;

  layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '60',
  });
  document.body.appendChild(layer);
  return layer;
}

/**
 * Throw a handful of sparks from a point on screen, in a power's colour.
 *
 * Coordinates are viewport-relative, straight from getBoundingClientRect, so
 * the caller does not have to know that the text it came from is mid-glide
 * under a transform.
 */
export function burst(x: number, y: number, tint: string): void {
  if (reducedMotion()) return;
  const host = ensureLayer();
  if (!host) return;

  for (let i = 0; i < COUNT; i++) {
    // Squares, not circles, and unrounded — the same call Embers makes. A
    // circular particle is the one thing on screen that would give away that
    // this is not really a sprite-based game.
    const size = 3 + Math.floor(Math.random() * 4);
    const spark = document.createElement('span');
    Object.assign(spark.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      // A quarter fly white-hot. A single flat colour reads as a shape breaking
      // apart; the mix reads as sparks.
      background: i % 4 === 0 ? '#ffffff' : tint,
      boxShadow: `0 0 8px ${tint}`,
    });
    host.appendChild(spark);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * SPREAD;
    const speed = 60 + Math.random() * 130;
    const driftX = Math.cos(angle) * speed;
    const peakY = Math.sin(angle) * speed;
    const fall = 110 + Math.random() * 90;

    // Three keyframes rather than two, so the sparks arc: out and up hard, then
    // over and down. A straight line from origin to resting point looks like a
    // diagram of an explosion rather than one.
    const flight = spark.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${driftX * 0.62}px, ${peakY}px) scale(1)`,
          opacity: 1,
          offset: 0.42,
        },
        {
          transform: `translate(${driftX}px, ${peakY + fall}px) scale(0.55)`,
          opacity: 0,
        },
      ],
      {
        duration: 620 + Math.random() * 280,
        easing: 'cubic-bezier(0.16, 0.72, 0.38, 1)',
        fill: 'forwards',
      },
    );

    // Removed on both outcomes: cancel fires if the tab is torn down mid-flight,
    // and without it these accumulate on the body for the life of the page.
    flight.onfinish = () => spark.remove();
    flight.oncancel = () => spark.remove();
  }
}
