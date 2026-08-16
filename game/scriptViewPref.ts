/**
 * Whether the script reads as a stream or as a page.
 *
 * A reading preference, not a game setting: it changes nothing about what is
 * typed, scored or refereed, only where the words sit while you type them.
 * That is why it lives on the machine rather than on the account — it is about
 * the screen somebody is looking at, the same reasoning that puts the keyboard
 * layout here. A phone and a desktop want different answers, and an account
 * that carried one to the other would be wrong half the time.
 */

export type ScriptView = 'tape' | 'paragraph';

const KEY = 'keymania.scriptView.v1';

/**
 * The tape, and not by coin toss.
 *
 * It is the treatment every screen has shipped with, the only one that fits a
 * phone, and the one that survives a narrow window. A player who has never
 * expressed a preference gets the thing that cannot be wrong.
 */
export const DEFAULT_VIEW: ScriptView = 'tape';

export const asScriptView = (value: string | null | undefined): ScriptView | undefined =>
  (value === 'tape' || value === 'paragraph' ? value : undefined);

/**
 * What the settings sheet calls them, kept beside the type rather than in the
 * component — the same arrangement `ARENA_FX` uses, so the wording for a
 * setting lives with the setting.
 *
 * "Page" rather than "paragraph" in the label: the stored value describes the
 * layout, but the word a player reads should describe what they get.
 */
export const SCRIPT_VIEWS: readonly ScriptView[] = ['tape', 'paragraph'];

export const SCRIPT_VIEW_META: Record<ScriptView, { label: string; blurb: string }> = {
  tape: {
    label: 'Tape',
    blurb: 'One line running sideways, at the biggest type. Nothing else to look at.',
  },
  paragraph: {
    label: 'Page',
    blurb: 'Several lines of prose, moving up as you go. Smaller type, more of what is coming.',
  },
};

export function readScriptView(): ScriptView | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return asScriptView(window.localStorage.getItem(KEY));
  } catch {
    /* Private browsing, or storage disabled. Not worth a broken screen. */
    return undefined;
  }
}

/**
 * An external store, for the reason `layoutPref` documents: this is something
 * the server cannot know, and reading it any other way means either lying
 * during hydration or setting state inside an effect.
 *
 * The `storage` event covers the same preference changing in another tab; the
 * local notify covers this one, which that event deliberately does not fire
 * for.
 */
const listeners = new Set<() => void>();

export function subscribeScriptView(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function writeScriptView(view: ScriptView): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, view);
  } catch {
    /* As above: the preference is a convenience, not a requirement. */
  }
  for (const notify of listeners) notify();
}

/**
 * The narrowest width the page is allowed on.
 *
 * The page needs several lines of prose at a readable size and a viewport tall
 * enough to hold them. On a phone that is a column three or four words wide,
 * which is not prose — it is the tape with extra steps and worse ergonomics.
 *
 * 720 rather than the stylesheet's 560: this is asking "is there room to read
 * a paragraph", which is a different question from "is this a phone layout",
 * and answering it with the same number would tie two decisions together that
 * will want to move independently.
 */
export const PAGE_MIN_WIDTH = 720;

/**
 * What to actually render, given the preference and the room available.
 *
 * **The width wins, and it is not a fallback.** A narrow screen gets the tape
 * whatever is stored, because the page does not work there — and because
 * somebody who chose the page on a desktop has not thereby asked for an
 * unreadable column on their phone. The preference is remembered rather than
 * overwritten, so the same account on the same browser goes back to the page
 * the moment the window is wide enough again.
 *
 * Kept pure and separate from the hook so this rule can be tested without a
 * browser, which is the half most likely to be got wrong.
 */
export const resolveScriptView = (
  chosen: ScriptView | undefined,
  wideEnough: boolean,
): ScriptView => (wideEnough ? chosen ?? DEFAULT_VIEW : 'tape');
