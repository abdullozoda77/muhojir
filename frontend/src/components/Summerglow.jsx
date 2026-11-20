import { useEffect, useRef } from "react";
import { useIsDark } from "../theme.js";

function makeGlow() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,220,1)");
  grad.addColorStop(0.12, "rgba(245,255,150,0.95)");
  grad.addColorStop(0.3, "rgba(200,240,90,0.45)");
  grad.addColorStop(0.6, "rgba(160,220,60,0.12)");
  grad.addColorStop(1, "rgba(140,200,40,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function makeSeed() {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const cx = size / 2;
  const top = size * 0.3;
  g.lineCap = "round";
  g.strokeStyle = "rgba(120,110,90,0.75)";
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(cx, top);
  g.lineTo(cx, size * 0.78);
  g.stroke();
  g.fillStyle = "rgba(120,95,60,0.85)";
  g.beginPath();
  g.ellipse(cx, size * 0.84, 2.2, 5, 0, 0, Math.PI * 2);
  g.fill();
  const rays = 26;
  for (let i = 0; i < rays; i++) {
    const a = Math.PI + (Math.PI * i) / (rays - 1);
    const len = size * (0.24 + Math.random() * 0.05);
    const ex = cx + Math.cos(a) * len;
    const ey = top + Math.sin(a) * len * 0.75;
    g.strokeStyle = "rgba(105,115,135,0.85)";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(ex, ey);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.strokeStyle = "rgba(120,130,150,0.6)";
    g.lineWidth = 0.6;
    g.beginPath();
    g.arc(ex, ey, 1.7, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = "rgba(140,130,110,0.8)";
  g.beginPath();
  g.arc(cx, top, 1.6, 0, Math.PI * 2);
  g.fill();
  return c;
}

export default function Summerglow({ className = "", density = 1 }) {
  const ref = useRef(null);
  const dark = useIsDark();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glow = makeGlow();
    const seeds = [makeSeed(), makeSeed(), makeSeed()];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let items = [];
    let raf = 0;
    let last = performance.now();

    const firefly = () => {
      const z = Math.random() ** 1.3;
      return {
        x: Math.random() * w,
        y: h * 0.15 + Math.random() * h * 0.85,
        size: 20 + z * 34,
        alpha: 0.6 + z * 0.4,
        speed: 6 + Math.random() * 12,
        heading: Math.random() * Math.PI * 2,
        turn: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        pulse: 0.5 + Math.random() * 1.1,
      };
    };

    const seed = (anywhere) => {
      const z = Math.random() ** 1.4;
      return {
        x: anywhere ? Math.random() * w : -40 - Math.random() * 60,
        y: Math.random() * h,
        sprite: seeds[Math.floor(Math.random() * seeds.length)],
        size: 30 + z * 38,
        alpha: 0.7 + z * 0.3,
        vx: 10 + z * 22,
        bob: 10 + Math.random() * 26,
        rise: (Math.random() - 0.6) * 6,
        freq: 0.2 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const base = dark ? Math.min(46, Math.max(16, (w * h) / 26000)) : Math.min(28, Math.max(12, (w * h) / 40000));
      const count = Math.max(4, Math.round(base * density));
      items = items.slice(0, count);
      while (items.length < count) items.push(dark ? firefly() : seed(true));
    };

    const draw = (time) => {
      const t = time / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const f of items) {
        if (dark) {
          const beat = 0.5 + 0.5 * Math.sin(t * f.pulse + f.phase);
          const light = beat ** 1.6;
          ctx.globalAlpha = Math.min(1, f.alpha * (0.18 + light * 1.1));
          const size = f.size * (0.75 + light * 0.35);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.drawImage(glow, f.x - size / 2, f.y - size / 2, size, size);
        } else {
          const y = f.y + Math.sin(t * f.freq + f.phase) * f.bob;
          ctx.globalAlpha = f.alpha;
          ctx.setTransform(dpr, 0, 0, dpr, f.x * dpr, y * dpr);
          ctx.rotate(Math.sin(t * f.freq * 1.4 + f.phase) * 0.35 + 0.25);
          ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size);
        }
      }
      ctx.globalAlpha = 1;
    };

    const step = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      draw(time);
      const t = time / 1000;
      const gust = 1 + Math.sin(t * 0.12) * 0.5 + Math.sin(t * 0.37) * 0.25;
      for (const f of items) {
        if (dark) {
          f.heading += Math.sin(t * f.turn + f.phase) * dt * 1.4;
          f.x += Math.cos(f.heading) * f.speed * dt;
          f.y += Math.sin(f.heading) * f.speed * dt * 0.7;
          if (f.x < -20) f.x = w + 20;
          else if (f.x > w + 20) f.x = -20;
          if (f.y < h * 0.1) f.heading = Math.abs(f.heading) % Math.PI;
          else if (f.y > h + 10) f.heading = -Math.abs(f.heading) % Math.PI;
        } else {
          f.x += f.vx * gust * dt;
          f.y += f.rise * dt;
          if (f.x > w + 60 || f.y < -60 || f.y > h + 60) Object.assign(f, seed(false));
        }
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
  }, [dark, density]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
