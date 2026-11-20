import { useEffect, useRef } from "react";
import { useIsDark } from "../theme.js";

const TONES = [
  ["#ffffff", "#f7c9d6"],
  ["#fff6f8", "#f2a9bf"],
  ["#fdeef3", "#e98aa8"],
  ["#ffffff", "#f9dbe3"],
];

const LIGHT_TONES = [
  ["#ffe1eb", "#ee86aa"],
  ["#ffd2e0", "#e2729a"],
  ["#fff0f5", "#f29ab9"],
  ["#ffe8ef", "#f4a7c1"],
];

function petalPath(g, s) {
  g.beginPath();
  g.moveTo(0, s * 0.95);
  g.bezierCurveTo(s * 0.75, s * 0.5, s * 0.72, -s * 0.55, s * 0.16, -s * 0.9);
  g.quadraticCurveTo(0, -s * 0.72, -s * 0.16, -s * 0.9);
  g.bezierCurveTo(-s * 0.72, -s * 0.55, -s * 0.75, s * 0.5, 0, s * 0.95);
  g.closePath();
}

function fillPetal(g, s, [light, deep], edge = 0.35) {
  const grad = g.createLinearGradient(0, s * 0.95, 0, -s * 0.9);
  grad.addColorStop(0, deep);
  grad.addColorStop(0.45, light);
  grad.addColorStop(1, light);
  petalPath(g, s);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = `rgba(200,100,135,${edge})`;
  g.lineWidth = s * 0.04;
  g.stroke();
  g.strokeStyle = "rgba(210,120,150,0.25)";
  g.beginPath();
  g.moveTo(0, s * 0.8);
  g.lineTo(0, -s * 0.5);
  g.stroke();
}

function makePetal(tone, edge) {
  const size = 72;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.translate(size / 2, size / 2);
  fillPetal(g, size * 0.42, tone, edge);
  return c;
}

function makeBlossom(tone, edge) {
  const size = 120;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.translate(size / 2, size / 2);
  const s = size * 0.2;
  g.shadowColor = "rgba(180,80,110,0.25)";
  g.shadowBlur = 4;
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate((Math.PI * 2 * i) / 5);
    g.translate(0, -s * 0.95);
    fillPetal(g, s, tone, edge);
    g.restore();
  }
  g.shadowBlur = 0;
  const heart = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.55);
  heart.addColorStop(0, "#d9466f");
  heart.addColorStop(1, "rgba(217,70,111,0)");
  g.fillStyle = heart;
  g.beginPath();
  g.arc(0, 0, s * 0.55, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.2;
    const r = s * (0.45 + Math.random() * 0.25);
    g.strokeStyle = "rgba(190,90,110,0.7)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    g.stroke();
    g.fillStyle = "#f2c230";
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export default function Blossomfall({ className = "", density = 1 }) {
  const ref = useRef(null);
  const dark = useIsDark();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tones = dark ? TONES : LIGHT_TONES;
    const edge = dark ? 0.35 : 0.6;
    const petals = tones.map((tone) => makePetal(tone, edge));
    const blossoms = tones.map((tone) => makeBlossom(tone, edge));
    let w = 0;
    let h = 0;
    let dpr = 1;
    let items = [];
    let raf = 0;
    let last = performance.now();

    const item = (anywhere) => {
      const z = Math.random() ** 1.4;
      const flower = Math.random() < 0.22;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -40,
        sprite: (flower ? blossoms : petals)[Math.floor(Math.random() * TONES.length)],
        size: flower ? 26 + z * 26 : 12 + z * 16,
        alpha: (dark ? 0.7 : 0.95) * (0.65 + z * 0.35),
        vy: flower ? 16 + z * 18 : 10 + z * 16,
        drift: 4 + Math.random() * 10,
        sway: 14 + Math.random() * 30,
        freq: 0.3 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (flower ? 0.8 : 2.2),
        flip: Math.random() * Math.PI * 2,
        flipSpeed: flower ? 0.4 + Math.random() * 0.6 : 1.2 + Math.random() * 2,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const count = Math.max(6, Math.round(Math.min(70, Math.max(22, (w * h) / 22000)) * density));
      items = items.slice(0, count);
      while (items.length < count) items.push(item(true));
    };

    const draw = (time) => {
      const t = time / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of items) {
        const x = p.x + Math.sin(t * p.freq + p.phase) * p.sway;
        const flip = Math.cos(p.flip);
        ctx.setTransform(dpr, 0, 0, dpr, x * dpr, p.y * dpr);
        ctx.rotate(p.angle + Math.cos(t * p.freq + p.phase) * 0.4);
        ctx.scale(1, Math.max(0.2, Math.abs(flip)));
        ctx.globalAlpha = p.alpha;
        ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    };

    const step = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      draw(time);
      const wind = Math.sin(time * 0.00009) * 9 + Math.sin(time * 0.00029) * 4;
      for (const p of items) {
        p.y += p.vy * dt;
        p.x += (p.drift + wind * p.alpha) * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        if (p.y > h + 40) Object.assign(p, item(false));
        if (p.x > w + 50) p.x = -50;
        else if (p.x < -50) p.x = w + 50;
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
