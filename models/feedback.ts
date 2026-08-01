/**
 * What a player can tell us, and the shape of saying it.
 *
 * Mirrors the API's lib/feedback.ts. Duplicated rather than shared because the
 * two repositories deploy separately, and the only alternative is a package
 * neither of them wants yet — but the limits have to agree or the form accepts
 * something the server then rejects, which is the worst version of this feature:
 * a player writes a paragraph, presses send, and is told no by a box that had
 * every chance to say so first.
 */

export const FEEDBACK_KINDS = ['bug', 'feature'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Must match MESSAGE_MIN and MESSAGE_MAX in the API's lib/feedback.ts. */
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;

/**
 * What each option says on the form.
 *
 * The label is what somebody picks; the hint is what tells them which one they
 * want without having to think about it. "Something is broken" and "Something
 * could be better" are answerable in the state of mild annoyance that produces
 * most feedback, which "bug" and "feature request" are not.
 */
export const FEEDBACK_OPTIONS: {
  kind: FeedbackKind; label: string; hint: string; placeholder: string;
}[] = [
  {
    kind: 'bug',
    label: 'Something is broken',
    hint: 'It did the wrong thing',
    placeholder: 'What happened, and what were you doing when it did?',
  },
  {
    kind: 'feature',
    label: 'Something could be better',
    hint: 'An idea, or a rough edge',
    placeholder: 'What would you change?',
  },
];

/** Whether this message is long enough to send. The form and the server agree. */
export const isSendable = (message: string): boolean =>
  message.trim().length >= MESSAGE_MIN;
