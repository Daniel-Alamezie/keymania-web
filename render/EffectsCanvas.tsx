'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { PROJECTILE_FLIGHT_MS } from '@/game/constants';
import type { BladeTier, Side } from '@/game/types';

export interface EffectsHandle {
  /** Send a blade flying from one fighter toward the other. */
  launch: (from: Side, tier: BladeTier) => void;
  /** Pixel debris burst at a fighter's position. */
  burst: (at: Side, tier: BladeTier) => void;
}

interface Blade {
  from: Side;
  tier: BladeTier;
  startedAt: number;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
}

const TIER_COLORS: Record<BladeTier, string[]> = {
  1: ['#9aa4b2', '#c6d0de', '#6b7280'],
  2: ['#c0ccdc', '#e6eefc', '#8b97a8'],
  3: ['#deecfc', '#ffffff', '#9fc4e8'],
  4: ['#a8dcff', '#e0f4ff', '#4fa8e8'],
  5: ['#ffd66e', '#fff3c4', '#ff9d3c'],
};

/**
 * Where each fighter stands, as a fraction of canvas width.
 * The player is always on the left so their side of the screen never moves.
 */
const LANE = { player: 0.17, opponent: 0.83 };

const EffectsCanvas = forwardRef<EffectsHandle, { className?: string }>(function EffectsCanvas(
  { className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bladesRef = useRef<Blade[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const spritesRef = useRef<Record<number, HTMLImageElement>>({});
  const frameRef = useRef<number>(0);

  // Preload the blade sprites once.
  useEffect(() => {
    for (let tier = 1; tier <= 5; tier++) {
      const img = new Image();
      img.src = `/sprites/blade-${tier}.png`;
      spritesRef.current[tier] = img;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    launch: (from, tier) => {
      bladesRef.current.push({ from, tier, startedAt: performance.now() });
    },
    burst: (at, tier) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const x = canvas.clientWidth * LANE[at];
      const y = canvas.clientHeight * 0.52;
      const palette = TIER_COLORS[tier];
      const count = 14 + tier * 4;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * (120 + tier * 30);
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          life: 0,
          maxLife: 380 + Math.random() * 320,
          size: 2 + Math.floor(Math.random() * 3),
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
    },
  }), []);

  // One animation loop drives every transient effect.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      // --- blades in flight -------------------------------------------------
      bladesRef.current = bladesRef.current.filter((blade) => {
        const t = (now - blade.startedAt) / PROJECTILE_FLIGHT_MS;
        if (t >= 1) return false;

        const fromX = w * LANE[blade.from];
        const toX = w * LANE[blade.from === 'player' ? 'opponent' : 'player'];
        const x = fromX + (toX - fromX) * t;
        // A shallow arc reads as a throw rather than a slide.
        const y = h * 0.52 - Math.sin(t * Math.PI) * h * 0.16;
        const sprite = spritesRef.current[blade.tier];
        if (!sprite?.complete) return true;

        const scale = 0.55;
        const sw = sprite.width * scale;
        const sh = sprite.height * scale;
        const travellingLeft = toX < fromX;

        // Motion trail: a few fading ghosts behind the blade.
        for (let g = 3; g >= 1; g--) {
          const gt = Math.max(0, t - g * 0.045);
          const gx = fromX + (toX - fromX) * gt;
          const gy = h * 0.52 - Math.sin(gt * Math.PI) * h * 0.16;
          ctx.globalAlpha = 0.1 * (4 - g);
          drawSprite(ctx, sprite, gx, gy, sw, sh, travellingLeft);
        }

        ctx.globalAlpha = 1;
        drawSprite(ctx, sprite, x, y, sw, sh, travellingLeft);
        return true;
      });

      // --- impact particles -------------------------------------------------
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life += dt;
        if (p.life >= p.maxLife) return false;
        const k = dt / 1000;
        p.x += p.vx * k;
        p.y += p.vy * k;
        p.vy += 420 * k; // gravity
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        return true;
      });

      ctx.globalAlpha = 1;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
});

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  flip: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export default EffectsCanvas;
