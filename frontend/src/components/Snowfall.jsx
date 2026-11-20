import { useEffect, useRef } from "react";
import { useIsDark } from "../theme.js";

const SPRITE = 192;
const VARIANTS = 8;

function hexagon(g, r) {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

function crystalDesign() {
  const pick = (a, b) => a + Math.random() * (b - a);
  const count = 3 + Math.floor(Math.random() * 3);
  const branches = Array.from({ length: count }, (_, i) => {
    const at = 0.26 + (i / count) * 0.6 + pick(-0.03, 0.03);
    return { at, len: pick(0.2, 0.36) * (1.2 - at * 0.8), width: pick(0.03, 0.055), twigs: Math.random() < 0.6 };
  });
  return {
    arm: pick(0.86, 0.97),
    width: pick(0.07, 0.11),
    branches,
    tip: Math.random() < 0.5 ? pick(0.06, 0.1) : 0,
    core: pick(0.16, 0.26),
    rings: 1 + Math.floor(Math.random() * 2),
  };
}

function spike(g, x, y, angle, len, w0, w1) {
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const nx = -dy;
  const ny = dx;
  const ex = x + dx * len;
  const ey = y + dy * len;
  g.moveTo(x + nx * w0, y + ny * w0);
  g.lineTo(ex + nx * w1, ey + ny * w1);
  g.lineTo(ex + dx * w1 * 1.6, ey + dy * w1 * 1.6);
  g.lineTo(ex - nx * w1, ey - ny * w1);
  g.lineTo(x - nx * w0, y - ny * w0);
  g.closePath();
  return [ex, ey];
}

function armShape(g, d, R) {
  const L = d.arm * R;
  const w = d.width * R;
  const ridges = [];
  g.beginPath();
  spike(g, 0, 0, 0, L, w * 0.55, w * 0.22);
  ridges.push([0, -d.core * R * 0.6, 0, -L]);
  for (const b of d.branches) {
    const y = -b.at * L;
    const len = b.len * R;
    const bw = b.width * R;
    for (const side of [-1, 1]) {
      const [ex, ey] = spike(g, 0, y, (side * Math.PI) / 3, len, bw, bw * 0.35);
      ridges.push([0, y, ex, ey]);
      if (b.twigs) {
        const mx = ex * 0.55;
        const my = y + (ey - y) * 0.55;
        spike(g, mx, my, 0, len * 0.4, bw * 0.6, bw * 0.25);
        spike(g, mx, my, (side * 2 * Math.PI) / 3, len * 0.3, bw * 0.55, bw * 0.22);
      }
    }
  }
  if (d.tip) {
    const r = d.tip * R;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, -L + Math.sin(a) * r);
    }
    g.closePath();
  }
  return ridges;
}

function makeCrystal(d, dark, soft) {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const g = c.getContext("2d");
  const R = SPRITE * 0.44;
  g.translate(SPRITE / 2, SPRITE / 2);
  g.lineCap = "round";
  g.lineJoin = "round";
  if (soft) g.filter = "blur(5px)";

  const ice = dark
    ? { fill: "rgba(185,215,255,0.32)", edge: "rgba(235,245,255,0.95)", ridge: "rgba(255,255,255,0.9)", glow: "rgba(140,190,255,0.85)" }
    : { fill: "rgba(150,185,235,0.42)", edge: "rgba(70,115,195,0.9)", ridge: "rgba(255,255,255,0.95)", glow: "rgba(90,135,215,0.45)" };

  const ridges = [];
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((Math.PI / 3) * i);
    const list = armShape(g, d, R);
    g.shadowColor = ice.glow;
    g.shadowBlur = 8;
    g.fillStyle = ice.fill;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = ice.edge;
    g.lineWidth = 1.1;
    g.stroke();
    g.restore();
    ridges.push(...list.map((r) => [i, r]));
  }

  g.strokeStyle = ice.ridge;
  g.lineWidth = 0.9;
  for (const [i, [x0, y0, x1, y1]] of ridges) {
    g.save();
    g.rotate((Math.PI / 3) * i);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.restore();
  }

  const core = d.core * R;
  hexagon(g, core);
  const plate = g.createRadialGradient(0, 0, 0, 0, 0, core);
  plate.addColorStop(0, dark ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.95)");
  plate.addColorStop(0.6, ice.fill);
  plate.addColorStop(1, dark ? "rgba(200,225,255,0.5)" : "rgba(130,170,230,0.55)");
  g.fillStyle = plate;
  g.fill();
  g.strokeStyle = ice.edge;
  g.lineWidth = 1.2;
  g.stroke();
  for (let k = 1; k <= d.rings; k++) {
    hexagon(g, core * (1 - k * 0.32));
    g.strokeStyle = ice.ridge;
    g.lineWidth = 0.8;
    g.stroke();
  }
  return c;
}

export default function Snowfall({ className = "", density = 1 }) {
  const ref = useRef(null);
  const dark = useIsDark();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const designs = Array.from({ length: VARIANTS }, crystalDesign);
    const sprites = designs.map((d) => makeCrystal(d, dark, false));
    const softSprites = designs.slice(0, 3).map((d) => makeCrystal(d, dark, true));
    const any = (list) => list[Math.floor(Math.random() * list.length)];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let flakes = [];
    let raf = 0;
    let last = performance.now();

    const flake = (anywhere) => {
      const z = Math.random() ** 1.6;
      const soft = Math.random() < 0.04;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -40,
        sprite: soft ? any(softSprites) : any(sprites),
        size: soft ? 56 + Math.random() * 40 : 10 + z * 30,
        alpha: soft ? 0.12 + Math.random() * 0.12 : 0.5 + z * 0.5,
        vy: soft ? 10 + Math.random() * 5 : 6 + z * 16,
        drift: (Math.random() - 0.5) * 4,
        rock: 6 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        freq: 0.25 + Math.random() * 0.5,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * (0.35 + (1 - z) * 0.6),
        tilt: 0.2 + Math.random() * 0.45,
        shimmer: 0.6 + Math.random() * 1.6,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const count = Math.max(6, Math.round(Math.min(120, Math.max(36, (w * h) / 11000)) * density));
      flakes = flakes.slice(0, count);
      while (flakes.length < count) flakes.push(flake(true));
    };

    const draw = (time) => {
      const t = time / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const f of flakes) {
        const x = f.x + Math.sin(t * f.freq + f.phase) * f.rock;
        const squash = 1 - f.tilt * (0.5 - 0.5 * Math.cos(t * f.freq * 1.3 + f.phase));
        ctx.globalAlpha = f.alpha * (0.85 + 0.15 * Math.sin(t * f.shimmer + f.phase));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(x, f.y);
        ctx.rotate(f.rot);
        ctx.scale(1, squash);
        ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size);
      }
      ctx.globalAlpha = 1;
    };

    const step = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      draw(time);
      const wind = Math.sin(time * 0.0001) * 4 + Math.sin(time * 0.00031) * 2;
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.x += (f.drift + wind * (0.3 + f.alpha)) * dt;
        f.rot += f.spin * dt;
        if (f.y > h + 40) Object.assign(f, flake(false));
        if (f.x > w + 40) f.x = -40;
        else if (f.x < -40) f.x = w + 40;
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
