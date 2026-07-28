'use client';

import { useState } from 'react';
import { CHARACTER_LIST, characterFrame, type CharacterId } from '@/models/character';
import PixelSprite from './PixelSprite';
import styles from './CharacterPicker.module.css';

/**
 * Choosing who you fight as.
 *
 * Every option is drawn at full size rather than as a name in a list, because
 * the whole decision is visual — nobody picks "Baron" over "Sprout" by reading
 * the words. The grid costs more room than a dropdown and is the entire point.
 *
 * The choice saves the instant it is clicked. A picker with a Save button
 * underneath invites choosing one and forgetting to commit it, and there is
 * nothing here worth confirming: the cost of a wrong click is another click.
 */
export default function CharacterPicker({ current, onChoose }: {
  current: CharacterId;
  onChoose: (id: CharacterId) => Promise<{ ok: boolean; error?: string }>;
}) {
  /**
   * What is shown as selected, ahead of the server agreeing.
   *
   * Without this the sprite you clicked stays unhighlighted until a round trip
   * finishes, which reads as the click having missed. Reverted if the save
   * fails, so the screen never claims something the account does not hold.
   */
  const [pending, setPending] = useState<CharacterId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = pending ?? current;

  async function choose(id: CharacterId) {
    if (id === chosen) return;
    setPending(id);
    setProblem(null);

    const result = await onChoose(id);
    if (!result.ok) {
      setPending(null);
      setProblem(result.error ?? 'Could not save that character.');
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={`${styles.heading} pixel-font`}>Character</h2>
      <p className={styles.muted}>
        Who you fight as. Opponents see this too — it is drawn in the arena, not
        just here.
      </p>

      <ul className={styles.grid}>
        {CHARACTER_LIST.map((character) => (
          <li key={character.id}>
            <button
              type="button"
              className={styles.option}
              data-chosen={character.id === chosen || undefined}
              aria-pressed={character.id === chosen}
              aria-label={`${character.name} — ${character.blurb}`}
              onClick={() => choose(character.id)}
            >
              {/* Frame 1 only. The idle bob belongs in the arena; six of them
                  breathing out of step in a grid is a distraction, not charm. */}
              <PixelSprite name={characterFrame(character.id, 1)} height={92} />
              <span className={styles.name}>{character.name}</span>
              <span className={styles.blurb}>{character.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.hint} aria-live="polite">
        {problem && <span className={styles.error}>{problem}</span>}
      </p>
    </section>
  );
}
