'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import styles from './WordFlight.module.css';

export interface WordFlightHandle {
  /**
   * Throw a word.
   *
   * `from` is the live token in the sentence, which is cloned rather than read:
   * a copy carries the real glyphs, the real font and the charged-word tint, so
   * what leaves the line is unmistakably the word that was just typed rather
   * than a label that resembles it.
   */
  send: (from: Element, to: DOMRect, heavy: boolean) => void;
}

/** Matches PROJECTILE_FLIGHT_MS closely enough that the drain still feels caused. */
const FLIGHT_MS = 420;

/**
 * The layer where committed words fly at their target.
 *
 * This is the answer to the hardest question in the stripped-down layout: with
 * no fighters and no blade sprite, what shows that typing is doing damage? The
 * word itself does. It lifts off the line where the player's eyes already are,
 * crosses to the opponent's plate, and the health drops as it lands.
 *
 * That also happens to be a better causal story than the arena's. A blade
 * currently spawns from a sprite the player was not looking at, so the link
 * between finishing a word and hurting somebody is learned. Here it is shown.
 *
 * The clones are created and removed imperatively, outside React's knowledge.
 * That is deliberate rather than lazy: they are short-lived, purely decorative,
 * and there are up to a couple per second, so putting them in state would mean a
 * render for every keystroke and a reconciliation pass for nodes that only ever
 * animate and die. React owns this component's single container; nothing owns
 * what is briefly inside it.
 */
const WordFlight = forwardRef<WordFlightHandle, { className?: string }>(
  function WordFlight({ className }, ref) {
    const layer = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      send: (from, to, heavy) => {
        const host = layer.current;
        if (!host) return;

        const start = from.getBoundingClientRect();
        // A token mid-glide can report a zero box; there is nothing to throw.
        if (start.width === 0) return;

        const clone = from.cloneNode(true) as HTMLElement;
        // The source is already faded to 'done' by the time it is committed, and
        // a ghost is not what should be flying. Position and opacity are the only
        // things overridden; everything else is inherited from the real token.
        clone.removeAttribute('data-word');
        clone.className = `${clone.className} ${styles.flyer}`;
        clone.style.left = `${start.left}px`;
        clone.style.top = `${start.top}px`;
        clone.style.width = `${start.width}px`;
        clone.style.height = `${start.height}px`;
        host.appendChild(clone);

        const dx = to.left + to.width / 2 - (start.left + start.width / 2);
        const dy = to.top + to.height / 2 - (start.top + start.height / 2);

        /**
         * How high the arc lifts, as a share of the word's own height.
         *
         * It was a flat 42px, which was right while the sentence was a fixed
         * size. The line scales with the window now and has grown by half
         * again, so a fixed rise had quietly become a nudge — on a large
         * screen the word barely cleared its own baseline before setting off,
         * which is the difference between a throw and a slide.
         */
        const rise = start.height * 0.62;

        const animation = clone.animate(
          [
            /**
             * Starts at exactly the size of the word it replaces.
             *
             * The clone sits directly over the real token, so anything other
             * than 1 here is a visible jump at the instant of launch — the one
             * frame where the swap must not be noticeable.
             */
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            {
              // Rises before it crosses, so the path bends away from the line of
              // text rather than sliding along it.
              //
              // Grows on the way up. The peak is where the throw is legible,
              // and a heavier blade earns more of it -- that difference is the
              // only thing separating a big hit from an ordinary one at a
              // glance, since both take the same path in the same time.
              transform: `translate(${dx * 0.55}px, ${dy * 0.4 - rise}px) scale(${heavy ? 1.42 : 1.24})`,
              opacity: 1,
              offset: 0.55,
            },
            {
              /**
               * And shrinks into the plate it lands on.
               *
               * The shrink is perspective rather than decoration: the word is
               * travelling away from the reader toward the far corner, and
               * arriving at full size would read as it being pasted onto the
               * plate rather than thrown at it. Eased up alongside the peak so
               * the whole arc grew rather than only its middle.
               */
              transform: `translate(${dx}px, ${dy}px) scale(${heavy ? 0.58 : 0.7})`,
              opacity: 0,
            },
          ],
          { duration: FLIGHT_MS, easing: 'cubic-bezier(0.3, 0, 0.7, 1)', fill: 'forwards' },
        );

        animation.onfinish = () => clone.remove();
        // A cancelled animation still has to clean up, or a duel that ends
        // mid-flight leaves a word stuck on screen over the result panel.
        animation.oncancel = () => clone.remove();
      },
    }), []);

    return <div ref={layer} className={`${styles.layer} ${className ?? ''}`} aria-hidden="true" />;
  },
);

export default WordFlight;
