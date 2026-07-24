import Image from 'next/image';
import manifest from '@/game/sprites.generated.json';

export type SpriteName = keyof typeof manifest;

interface PixelSpriteProps {
  name: SpriteName;
  alt?: string;
  /** Rendered height in px. Width always follows the sprite's true aspect. */
  height?: number;
  className?: string;
}

/**
 * The single way pixel art is rendered.
 *
 * Sizes come from `sprites.generated.json`, written by tools/gen_sprites.py, so
 * a component can never quietly disagree with the art it is drawing — declaring
 * sizes by hand is exactly how sprites end up stretched.
 *
 * `unoptimized` matters just as much: Next.js would otherwise resample these
 * through its image pipeline with smooth interpolation, which destroys crisp
 * pixel edges in production while dev looks fine.
 */
export default function PixelSprite({ name, alt = '', height, className }: PixelSpriteProps) {
  const intrinsic = manifest[name];
  const scale = height ? height / intrinsic.height : 1;

  return (
    <Image
      src={`/sprites/${name}.png`}
      alt={alt}
      width={intrinsic.width}
      height={intrinsic.height}
      unoptimized
      className={className}
      style={height ? { width: Math.round(intrinsic.width * scale), height } : undefined}
    />
  );
}
