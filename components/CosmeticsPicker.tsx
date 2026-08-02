'use client';

import { useState } from 'react';
import { badgeSrc, COSMETIC_GROUPS, FOUNDER_BADGE, type Cosmetic, type PublicCosmetics } from '@/models/cosmetics';
import { useServerProfile } from '@/game/serverProfile';
import CosmeticsPreview from './CosmeticsPreview';
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
 *
 * **Selecting and saving are separate**, and that is the important thing here.
 * Each click used to be its own write. Trying on four badges to see which read
 * best was four requests against a budget meant for one considered change, and
 * a player comparing options — the entire purpose of the panel — was the one
 * most likely to be told to stop. Batching also means the three slots are
 * written together, so a look is applied as a look rather than arriving in
 * pieces on somebody else's screen.
 */

type Slot = 'title' | 'badge' | 'nameColour';
const SLOTS: Slot[] = ['title', 'badge', 'nameColour'];

/** A whole appearance. `null` is a slot deliberately left empty. */
type Slots = Record<Slot, string | null>;

export default function CosmeticsPicker() {
  const { profile, saveCosmetics } = useServerProfile();
  /**
   * The pending selection, or null for "nothing changed since the last save".
   *
   * Null rather than a copy of what is saved, so a change arriving from
   * anywhere else — a challenge completing, another tab — is picked up by a
   * player who has not touched anything, and cannot silently overwrite one who
   * has.
   */
  const [draft, setDraft] = useState<Slots | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const worn = profile?.cosmetics;
  if (!worn) return null;

  const stored: Slots = {
    title: worn.title ?? null,
    badge: worn.badge ?? null,
    nameColour: worn.nameColour ?? null,
  };
  const chosen = draft ?? stored;
  const dirty = SLOTS.some((slot) => chosen[slot] !== stored[slot]);

  const owns = (id: string) => worn.earned.includes(id);
  const byId = (id: string | null) => (id ? worn.catalogue.find((c) => c.id === id) : undefined);

  /**
   * The pending selection as the rest of the game would receive it.
   *
   * Resolved here rather than on the server because nothing has been sent yet
   * — that is the point of a preview. The rendered surfaces still take values
   * rather than ids, exactly as they do from a real board response, so they
   * cannot tell the difference between this and the genuine article.
   */
  const preview: PublicCosmetics = {
    title: byId(chosen.title)?.label,
    badge: byId(chosen.badge)?.value,
    badgeLabel: byId(chosen.badge)?.label,
    nameColour: byId(chosen.nameColour)?.value,
    badgeNumber: chosen.badge === FOUNDER_BADGE ? worn.founderNumber : undefined,
  };

  function choose(item: Cosmetic) {
    if (!owns(item.id) || saving) return;
    setError(null);
    setSaved(false);
    // Clicking what is already on takes it off. One control, two directions.
    setDraft({ ...chosen, [item.kind]: chosen[item.kind] === item.id ? null : item.id });
  }

  async function save() {
    setSaving(true);
    setError(null);

    /**
     * All three slots every time, including the empty ones.
     *
     * `null` is how a cosmetic is taken off and is meaningfully different from
     * an omitted field, which means "leave this alone" — so a player who
     * removed their title and picked a badge in the same visit needs both
     * stated or half of what they did is dropped.
     */
    const result = await saveCosmetics(chosen);
    if (result.ok) {
      setDraft(null);
      setSaved(true);
    } else {
      setError(result.error ?? 'Could not save that.');
    }
    setSaving(false);
  }

  return (
    <div className={styles.picker}>
      <CosmeticsPreview
        name={profile.displayName || 'You'}
        character={profile.character ?? 'wraith'}
        rating={profile.rating}
        cosmetics={preview}
      />

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
                const on = chosen[item.kind] === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.tile}
                    data-owned={mine || undefined}
                    data-on={on || undefined}
                    aria-pressed={mine ? on : undefined}
                    disabled={!mine || saving}
                    onClick={() => choose(item)}
                    /* The hint is the whole reason a locked tile is worth
                       showing, so it must reach a screen reader too. */
                    aria-label={mine ? item.label : `${item.label}, locked. ${item.hint}`}
                  >
                    <span className={styles.face}>
                      {item.kind === 'badge' && item.value && (
                        <>
                          <img src={badgeSrc(item.value)} alt="" width={32} height={32} />
                          {/* Your number, on your tile. The rest of the app
                              shows it to other people; this is the one place
                              it is shown to you, and hiding it here made the
                              tile the only surface that undersold the badge
                              it was selling. */}
                          {item.id === FOUNDER_BADGE && worn.founderNumber !== undefined && (
                            <span className={styles.faceNo}>{worn.founderNumber}</span>
                          )}
                        </>
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
                    {/* On every tile, not only locked ones. It reads as "how
                        to get this" while locked and flips to "what this is"
                        once owned — a grid of owned marks with bare names
                        assumed everybody remembers why they have things. */}
                    <span className={styles.hint}>{item.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/*
        * Sticky, because the grids are longer than the panel and the control
        * that commits a change must not be somewhere a player has to go and
        * look for. It keeps its space when there is nothing to save so the
        * grid does not jump under the cursor the moment something is picked.
        */}
      <div className={styles.bar} data-dirty={dirty || undefined}>
        <p className={styles.state} role="status">
          {error ? <span className={styles.error}>{error}</span>
            : dirty ? 'Unsaved changes'
              : saved ? 'Saved.'
                : 'Pick what you want to wear, then save.'}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.discard}
            onClick={() => { setDraft(null); setError(null); setSaved(false); }}
            disabled={!dirty || saving}
          >
            Discard
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
