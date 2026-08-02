'use client';

import PixelSprite from './PixelSprite';
import { characterFrame, characterHit, type CharacterId } from '@/models/character';
import { MAX_HEALTH } from '@/game/constants';
import { badgeSrc, type PublicCosmetics } from '@/models/cosmetics';
import styles from './HealthBar.module.css';

interface HealthBarProps {
  name: string;
  value: number;
  team: 'blue' | 'red';
  /**
   * Who this fighter is, for the portrait.
   *
   * The plate used to show a wraith regardless, which stopped making sense the
   * moment players could choose who they fight as: the arena showed your
   * character and the bar above it showed somebody else entirely.
   */
  character: CharacterId;
  /**
   * Drop the portrait and the caption.
   *
   * For bars that sit under a fighter in the arena — the figure standing
   * directly above it is a far better portrait than a thumbnail of itself, and
   * repeating it costs the width the name needs.
   */
  compact?: boolean;
  /** 'left' anchors the fill to the left edge; 'right' mirrors it. */
  align: 'left' | 'right';
  /**
   * Where this seat stands, shown under the bar.
   *
   * Absent for a bot duel, which moves nothing, and for anybody the server sent
   * no rating for. A duel that changes your standing should say what is at stake
   * before a word is typed rather than only reporting it on the way out.
   *
   * It began beside the name, small enough that it read as part of the name, and
   * it sat next to a caption that said "player" — a word nobody needed, in the
   * one line under the bar where the eye already goes. So it took that line and
   * the caption lost it. This is the number a ranked duel is about; it should
   * not be the quietest thing on the plate.
   */
  rating?: number;
  /**
   * What this fighter is wearing, resolved by the server.
   *
   * The badge sits by the name and the title under the bar, beside the rating.
   * Both restrained on purpose: this plate already carries a name, a rating, a
   * health figure, a bar and a portrait, and the bar has to stay the loudest
   * thing on it. A badge is a mark, not a second thing to read mid-duel.
   *
   * Name colour is deliberately *not* applied here. The plate speaks in team
   * colours — blue is you, red is the opponent — and a player wearing the
   * other side's colour on their own plate is not self-expression, it is
   * misinformation. Colours stay on the boards, where nothing else is saying
   * anything with hue.
   */
  cosmetics?: PublicCosmetics;
  /** Optional caption under the name, e.g. live WPM or the bot's speed. */
  caption?: string;
  /**
   * This is the fighter your blade is currently flying at.
   *
   * Only meaningful past two players, where the target is chosen for you and
   * moves as the lead changes — the marking is how that rule is taught.
   */
  targeted?: boolean;
  /** Knocked out. Stays on the board so the slot order never shifts. */
  defeated?: boolean;
  /**
   * Bumped whenever this fighter takes a hit, to retrigger the flinch.
   *
   * Only used by the stripped-down layout, where the plate is the only body a
   * duellist has left: with no sprite in an arena to blanch and stagger, the
   * portrait has to do that job or a landed word has nothing to land on.
   *
   * A counter rather than a boolean for the same reason `Fighter` uses one. Two
   * blades arriving in quick succession each need their own flash, and a boolean
   * that is already true cannot restart an animation.
   */
  hitTick?: number;
  /**
   * Give the plate the room it needs to be the main event.
   *
   * A 44px thumbnail is right when a full-height fighter is standing underneath
   * it and this is a legend. When the plate *is* the fighter it has to carry the
   * weight the sprite used to.
   */
  big?: boolean;
}

/**
 * A fighter's status plate: portrait, name and a chunky segmented health bar.
 * The two plates mirror each other so the player's side is unmistakable.
 */
export default function HealthBar({
  name, value, team, align, character, caption, compact, targeted, defeated, rating, cosmetics,
  hitTick = 0, big,
}: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (value / MAX_HEALTH) * 100));
  const state = pct > 55 ? 'high' : pct > 25 ? 'mid' : 'low';

  return (
    <div
      className={styles.plate}
      data-align={align}
      data-team={team}
      data-targeted={targeted || undefined}
      data-defeated={defeated || undefined}
      data-compact={compact || undefined}
      data-big={big || undefined}
    >
      {!compact && (
        // Keyed on the tick so a hit remounts this and restarts the flinch from
        // the top, which is what lets two quick blades read as two hits rather
        // than the second being swallowed by the first. Same trick as Fighter.
        // `data-hit` gates the flinch, so the plate does not jiggle once on the
        // initial mount before anybody has been hit.
        <div
          key={`h${hitTick}`}
          className={styles.portrait}
          data-team={team}
          data-hit={hitTick > 0 || undefined}
        >
          <PixelSprite name={characterFrame(character, 1)} height={big ? 72 : 44} />

          {/*
            * The blanched frame, laid over and faded out by CSS.
            *
            * No state and no timer: the wrapper above is already keyed on
            * hitTick, so a new tick restarts the animation by remounting. The
            * arena's fighters take exactly this approach, and driving it from an
            * effect there meant setting state synchronously inside one.
            */}
          {hitTick > 0 && (
            <div className={styles.blanch} aria-hidden="true">
              <PixelSprite name={characterHit(character)} height={big ? 72 : 44} />
            </div>
          )}
        </div>
      )}

      <div className={styles.info}>
        <div className={styles.top}>
          {cosmetics?.badge && (
            <span className={styles.plateBadge}>
              <img src={badgeSrc(cosmetics.badge)} alt="" width={12} height={12} />
            </span>
          )}
          <span className={`${styles.name} pixel-font`} data-team={team}>{name}</span>
          <span className={`${styles.value} pixel-font`} data-state={state}>{Math.ceil(value)}</span>
        </div>

        <div className={styles.track}>
          <div className={styles.fill} data-state={state} style={{ width: `${pct}%` }} />
          <div className={styles.notches} aria-hidden="true" />
        </div>

        {/*
          * Under the bar: what this seat is rated, and whatever the caption has
          * to say. One row rather than two, because a plate is already carrying
          * a name, a number, a bar and a portrait, and the space under it is
          * worth about one line.
          *
          * Labelled. A bare number under a health bar is one more number, and a
          * player seeing it for the first time has no way to know it is the
          * thing the duel is about to move.
          */}
        {!compact && (rating !== undefined || caption) && (
          <span className={styles.below}>
            {rating !== undefined && (
              <span className={styles.rating}>
                <span className={styles.ratingLabel}>RATING</span>
                <span className={`${styles.ratingValue} pixel-font`}>{rating}</span>
              </span>
            )}
            {cosmetics?.title && <span className={styles.title}>{cosmetics.title}</span>}
            {caption && <span className={styles.caption}>{caption}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
