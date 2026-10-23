import { useEffect, useRef } from "react";
import { useIsDark } from "../theme.js";

// Slowly falling snow drawn on a canvas. Far flakes are small and dim, near ones bigger and brighter, and a few
// big blurred flakes float right in front, like out of focus. Each flake rocks gently side to side and shimmers a
// little. With "reduce motion" on the phone the snow stands still.
// Every flake is a ready-made picture (sprite), so even 200 flakes cost little on a phone.
function makeSprite(dark, soft) {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (soft) {
    // A blurred flake close to the eye: no hard edge at all.
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.4, "rgba(230,240,255,0.45)");
    grad.addColorStop(1, "rgba(210,225,255,0)");
  } else if (dark) {
    // A bright core with a cold blue glow around it.
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.22, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.4, "rgba(205,225,255,0.35)");
    grad.addColorStop(1, "rgba(160,195,255,0)");
  } else {
    // On a light sky a white dot alone is lost, so it gets a soft blue rim.
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.6, "rgba(120,150,215,0.35)");
    grad.addColorStop(1, "rgba(120,150,215,0)");
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export default function Snowfall({ className = "" }) {
  const ref = useRef(null);
  const dark = useIsDark();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprite = makeSprite(dark, false);
    const softSprite = makeSprite(dark, true);
    let w = 0;
    let h = 0;
    let flakes = [];
    let raf = 0;
    let last = performance.now();

    const flake = (anywhere) => {
      const z = Math.random() ** 1.8; // most flakes are far away
      const soft = Math.random() < 0.035;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -30,
        soft,
        r: soft ? 7 + Math.random() * 8 : 0.9 + z * 3.2,
        alpha: soft ? 0.1 + Math.random() * 0.12 : 0.45 + z * 0.55,
        vy: soft ? 9 + Math.random() * 5 : 5 + z * 14, // pixels per second: a slow, quiet fall
        drift: (Math.random() - 0.5) * 4,
        rock: 6 + Math.random() * 18, // how far it rocks side to side, in pixels
        phase: Math.random() * Math.PI * 2,
        freq: 0.25 + Math.random() * 0.5,
        shimmer: 0.6 + Math.random() * 1.6,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(260, Math.max(70, (w * h) / 5500)));
      flakes = Array.from({ length: count }, () => flake(true));
    };

    const draw = (time) => {
      const t = time / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        const x = f.x + Math.sin(t * f.freq + f.phase) * f.rock;
        const size = f.r * 4.4;
        ctx.globalAlpha = f.alpha * (0.82 + 0.18 * Math.sin(t * f.shimmer + f.phase));
        ctx.drawImage(f.soft ? softSprite : sprite, x - size / 2, f.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const step = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      draw(time);
      // A light wind that slowly turns now and then.
      const wind = Math.sin(time * 0.0001) * 4 + Math.sin(time * 0.00031) * 2;
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.x += (f.drift + wind * (0.3 + f.alpha)) * dt;
        if (f.y > h + 30) Object.assign(f, flake(false));
        if (f.x > w + 30) f.x = -30;
        else if (f.x < -30) f.x = w + 30;
      }
      raf = requestAnimationFrame(step);
    };

    resize();
    if (still) draw(0);
    else raf = requestAnimationFrame(step);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [dark]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
