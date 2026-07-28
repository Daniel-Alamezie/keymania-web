'use client';

import { useState } from 'react';
import {
  CHARACTER_LIST, characterById, characterFrame, type CharacterId,
} from '@/models/character';
import PixelSprite from './PixelSprite';
import styles from './CharacterPicker.module.css';

/**
 * Choosing who you fight as.
 *
 * Every option is drawn at full size rather than as a name in a list, because
 * the whole decision is visual — nobody picks "Baron" over "Sprout" by reading
 * the words. The grid costs more room than a dropdown and is the entire point.
 *
 * Selecting is local; saving is a button. The first version wrote on every
 * click, on the reasoning that a wrong choice only costs another click — which
 * missed that with a visual picker, *browsing is the normal interaction*. Every
 * look was a write, six characters was six writes, and the profile rate limit
 * answered "slow down" to somebody who had done nothing but look. Trying things
 * on has to be free; only deciding costs anything.
 */
export default function CharacterPicker({ current, onChoose }: {
  current: CharacterId;
  onChoose: (id: CharacterId) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [selected, setSelected] = useState<CharacterId>(current);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [problem, setProblem] = useState<string | null>(null);

  // No effect syncing this to `current`: the component is only rendered once the
  // profile has loaded, so useState seeds correctly on the first render, and
  // after a save `current` catches up on its own.
  const dirty = selected !== current;

  async function save() {
    setStatus('saving');
    setProblem(null);

    const result = await onChoose(selected);
    if (result.ok) {
      setStatus('saved');
    } else {
      setStatus('idle');
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
              data-chosen={character.id === selected || undefined}
              // Marks the one actually saved, so a browsed grid still shows
              // what you will walk away as if you change your mind.
              data-current={character.id === current || undefined}
              aria-pressed={character.id === selected}
              aria-label={`${character.name} — ${character.blurb}`}
              onClick={() => {
                setSelected(character.id);
                setStatus('idle');
                setProblem(null);
              }}
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

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || status === 'saving'}
          onClick={save}
        >
          {status === 'saving' ? 'Saving' : 'Save character'}
        </button>

        <p className={styles.hint} aria-live="polite">
          {problem ? <span className={styles.error}>{problem}</span>
            : status === 'saved' ? (
              <span className={styles.ok}>Saved — you fight as {characterById(current).name}.</span>
            )
            : dirty ? `${characterById(selected).name} selected. Save to lock it in.`
            : `You fight as ${characterById(current).name}.`}
        </p>
      </div>
    </section>
  );
}
