'use client';

import Reddit from './icons/Reddit';
import { track } from '@/game/analytics';
import styles from './CommunityLink.module.css';

/**
 * The way to the subreddit, from inside the game.
 *
 * Deliberately not a fourth faint underlined link in the row beneath it. The
 * menu already carries three, and a player scanning that row reads them as
 * housekeeping — the lobby, the guide, the bug box. This one is asking for
 * something different: come and be somewhere with the other players. So it is
 * shaped like an invitation, with the mark that says where it goes before the
 * words do.
 *
 * Quiet enough to stay under Play, which remains the loudest thing on the
 * screen. Nothing here should compete with starting a game.
 */
export default function CommunityLink({ className }: { className?: string }) {
  return (
    <a
      className={`${styles.link} ${className ?? ''}`}
      href="https://www.reddit.com/r/keymania/"
      // Opens away from the game: a player mid-session should not lose the
      // page they were on, and a duel in progress lives in this tab.
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track({ name: 'community_opened' })}
    >
      <Reddit className={styles.mark} width={18} height={18} />
      <span className={styles.words}>
        <span className={styles.name}>r/keymania</span>
        <span className={styles.blurb}>Updates, best runs, and where bugs get fixed</span>
      </span>
    </a>
  );
}
