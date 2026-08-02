'use client';

import { useState } from 'react';
import { badgeSrc, COSMETIC_GROUPS, type Cosmetic } from '@/models/cosmetics';
import { useServerProfile } from '@/game/serverProfile';
import styles from './CosmeticsPicker.module.css';

/**
 * Where a player chooses how they appear to everyone else.
 *
 * Follows the character picker's precedent, which this project already got
 * right: locked entries are shown in full with how to earn them, rather than
 * hidden behind question marks. A grid of unknowns tells somebody there is
 * more without telling them how to get it, which is the frustrating half of a
 * progression system with none of the pull.
 *
 * Every choice is a toggle. Clicking what you already wear takes it off, which
 * is the only way to go back to plain and needs no separate "none" tile
 * competing with the real options.
 */
export default function CosmeticsPicker() {
  const { profile, saveCosmetics } = useServerProfile();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const worn = profile?.cosmetics;
  if (!worn) return null;

  const owns = (id: string) => worn.earned.includes(id);
  const equipped = (kind: Cosmetic['kind']) =>
    (kind === 'badge' ? worn.badge : kind === 'title' ? worn.title : worn.nameColour);

  async function choose(item: Cosmetic) {
    if (!owns(item.id) || saving) return;
    setSaving(item.id);
    setError(null);

    // Clicking what is already on takes it off. One control, two directions.
    const next = equipped(item.kind) === item.id ? null : item.id;
    const result = await saveCosmetics({ [item.kind]: next });
    if (!result.ok) setError(result.error ?? 'Could not save that.');
    setSaving(null);
  }

  return (
    <div className={styles.picker}>
      {COSMETIC_GROUPS.map((group) => {
        const items = worn.catalogue.filter((c) => c.kind === group.kind);
        if (items.length === 0) return null;

        return (
          <section key={group.kind} className={styles.group}>
            <h3 className={`${styles.heading} pixel-font`}>{group.heading}</h3>
            <p className={styles.blurb}>{group.blurb}</p>

            <div className={styles.grid}>
              {items.map((item) => {
                const mine = owns(item.id);
                const on = equipped(item.kind) === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.tile}
                    data-owned={mine || undefined}
                    data-on={on || undefined}
                    disabled={!mine || saving !== null}
                    onClick={() => void choose(item)}
                    /* The hint is the whole reason a locked tile is worth
                       showing, so it must reach a screen reader too. */
                    aria-label={mine ? item.label : `${item.label}, locked. ${item.hint}`}
                  >
                    <span className={styles.face}>
                      {item.kind === 'badge' && item.value && (
                        <img src={badgeSrc(item.value)} alt="" width={24} height={24} />
                      )}
                      {item.kind === 'nameColour' && (
                        /* Shown as a name rather than a swatch: a colour in
                           isolation tells a player nothing about how it will
                           read next to everything else on a board row. */
                        <span className={styles.sample} style={{ color: item.value }}>Abc</span>
                      )}
                      {item.kind === 'title' && (
                        <span className={styles.sampleTitle}>{item.label}</span>
                      )}
                    </span>

                    <span className={styles.label}>{item.label}</span>
                    {!mine && <span className={styles.hint}>{item.hint}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {error && <p className={styles.error} role="status">{error}</p>}
    </div>
  );
}
