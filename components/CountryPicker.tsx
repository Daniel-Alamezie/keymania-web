'use client';

import { useEffect, useState } from 'react';
import { countryName, countryOptions } from '@/models/countries';
import CountryChip from './CountryChip';
import chip from './CountryChip.module.css';
import styles from './CountryPicker.module.css';

/**
 * Choosing the country shown beside your name.
 *
 * **Nothing is stored until somebody picks.** The edge knows roughly where a
 * request came from and this offers that as a starting point, but a suggestion
 * on screen and a value on a public profile are different things — so the
 * server is told only when a player acts. That is why this is a form and not a
 * fact quietly written on first sign-in.
 *
 * The practical payoff is accuracy, not just principle. A country derived from
 * an address is wrong for anybody on a VPN and wrong for anybody on holiday,
 * and it would be wrong *permanently* with no way to say so. A flag means "where
 * I am from", which is a thing only the person knows.
 *
 * Clearing is a first-class action for the same reason. Somebody who set a
 * country must be able to stop showing one without support.
 */
export default function CountryPicker({ current, onSave }: {
  current?: string;
  onSave: (country: string | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [suggested, setSuggested] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Asked for once, and only when there is nothing set.
   *
   * Somebody who has already chosen does not need to be told where we think
   * they are — the suggestion exists to save a first-timer scrolling a list of
   * 249, not to second-guess a decision they have made.
   */
  useEffect(() => {
    if (current) return;
    let live = true;
    void fetch('/api/geo')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { country?: string }) => { if (live) setSuggested(data.country); })
      // A missing suggestion is not an error worth showing. The dropdown below
      // works perfectly well without one; it is a shortcut, not the mechanism.
      .catch(() => {});
    return () => { live = false; };
  }, [current]);

  async function choose(country: string | null) {
    setSaving(true);
    setError(null);
    const result = await onSave(country);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setSuggested(undefined);
    } else {
      setError(result.error ?? 'Could not save that.');
    }
  }

  return (
    <div className={styles.picker}>
      {current ? (
        <div className={styles.current}>
          <CountryChip code={current} className={chip.large} />
          <span className={styles.currentName}>{countryName(current)}</span>
          <button
            type="button"
            className={styles.clear}
            disabled={saving}
            onClick={() => void choose(null)}
          >
            Remove
          </button>
        </div>
      ) : (
        <p className={styles.none}>No country shown beside your name.</p>
      )}

      {/*
        * The suggestion, offered only to somebody who has not chosen.
        *
        * Phrased as a guess rather than a statement, because it is one. "We
        * think you're in X" invites a correction in a way "Your country: X"
        * does not, and the whole point of this control is that the player is
        * the authority on the answer.
        */}
      {!current && suggested && (
        <div className={styles.suggestion}>
          <span className={styles.suggestionText}>
            We think you are in {countryName(suggested)}.
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => void choose(suggested)}
          >
            Use {suggested}
          </button>
        </div>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{current ? 'Change it' : 'Or choose one'}</span>
        <select
          className={styles.select}
          // Uncontrolled by design: this is an action, not a draft. Every
          // change saves, so there is no pending state for a value to be out
          // of step with.
          value=""
          disabled={saving}
          onChange={(event) => { if (event.target.value) void choose(event.target.value); }}
        >
          <option value="">Pick a country…</option>
          {countryOptions().map(({ code, name }) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </label>

      {saved && !error && <p className={styles.saved}>Saved.</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
