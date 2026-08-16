'use client';

import ParagraphView from './ParagraphView';
import SentenceView from './SentenceView';
import { useScriptView } from '@/game/useScriptView';
import type { PowerKind } from '@/models/powers';

/**
 * The script, in whichever shape the player reads it.
 *
 * One place makes this choice so that six screens do not each make it slightly
 * differently — which is this codebase's recurring failure, and the reason the
 * weekly and survival were still folding case long after the duel had stopped.
 * A screen asks for "the script"; what that looks like is not its business.
 *
 * Both renderers are given the same things because they are two views of one
 * state, not two states. The tape reads the three-line window; the page reads
 * the script and the line index. Every screen already holds all of it.
 */
export default function ScriptView({
  script, scriptIndex, previous, sentence, upcoming, cursor, missTick,
  powers = {}, wordOffset = 0,
}: {
  /**
   * The whole passage, for the page.
   *
   * Nullable because a duel genuinely has no script until the server sends
   * one — the countdown runs first. Widened here rather than coerced at that
   * call site, so the gap is handled once and in the place that knows what to
   * do about it.
   */
  script: string[] | null | undefined;
  scriptIndex: number;
  /** The three-line window, for the tape. */
  previous?: string;
  sentence: string;
  upcoming?: string;
  cursor: number;
  missTick: number;
  powers?: Record<number, PowerKind>;
  /** Flat index of the current line's first word. */
  wordOffset?: number;
}) {
  const view = useScriptView();

  /*
   * The page needs the script to render at all, and a screen can be mid-setup
   * with an empty one — a countdown before `begin` has landed, or a reconnect.
   * Falling back rather than rendering nothing keeps the words on screen
   * through the gap; the tape has its own sentence and does not care.
   */
  if (view === 'paragraph' && script && script.length > 0) {
    return (
      <ParagraphView
        script={script}
        scriptIndex={scriptIndex}
        cursor={cursor}
        missTick={missTick}
        powers={powers}
      />
    );
  }

  return (
    <SentenceView
      previous={previous}
      sentence={sentence}
      upcoming={upcoming}
      cursor={cursor}
      missTick={missTick}
      powers={powers}
      wordOffset={wordOffset}
    />
  );
}
