import { useEffect, useRef } from "react";
import { useIsDark } from "../theme.js";

const COLORS = [
  ["#f08a24", "#c4521a"],
  ["#f6b73c", "#d98a17"],
  ["#d9441f", "#9e2a16"],
  ["#e86f2c", "#b13f1b"],
  ["#c9822f", "#8a4f1e"],
  ["#e9a23b", "#b86b1d"],
];

const MAPLE = [
  [0, -1], [0.12, -0.6], [0.36, -0.76], [0.3, -0.4], [0.76, -0.56], [0.62, -0.24], [0.96, -0.1],
  [0.56, 0.12], [0.64, 0.36], [0.26, 0.24], [0.08, 0.44], [0, 0.4],
];

function maplePath(g, s) {
  const pts = [...MAPLE, ...MAPLE.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
  g.closePath();
}

function ovalPath(g, s) {
  g.beginPath();
  g.moveTo(0, -s);
  g.bezierCurveTo(s * 0.62, -s * 0.55, s * 0.6, s * 0.35, 0, s * 0.62);
  g.bezierCurveTo(-s * 0.6, s * 0.35, -s * 0.62, -s * 0.55, 0, -s);
  g.closePath();
}

function makeLeaf(shape, [light, deep], dark) {
  const size = 96;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const s = size * 0.44;
  g.translate(size / 2, size / 2);
  (shape === "maple" ? maplePath : ovalPath)(g, s);
  const fill = g.createLinearGradient(-s, -s, s, s);
  fill.addColorStop(0, light);
  fill.addColorStop(1, deep);
  g.fillStyle = fill;
  g.globalAlpha = dark ? 0.88 : 1;
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = "rgba(90,40,10,0.45)";
  g.lineWidth = size * 0.018;
  g.beginPath();
  g.moveTo(0, -s * 0.85);
  g.lineTo(0, s * (shape === "maple" ? 0.95 : 0.85));
  if (shape === "maple") {
    for (const side of [-1, 1]) {
      g.moveTo(0, s * 0.15);
      g.lineTo(side * s * 0.62, -s * 0.42);
      g.moveTo(0, s * 0.25);
      g.lineTo(side * s * 0.7, s * 0.05);
    }
  } else {
    for (const y of [-0.45, -0.1, 0.25]) {
      for (const side of [-1, 1]) {
        g.moveTo(0, s * (y + 0.18));
        g.lineTo(side * s * 0.38, s * y);
      }
    }
  }
  g.stroke();
  return c;
}

export default function Leaffall({ className = "" }) {
  const ref = useRef(null);
  const dark = useIsDark();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = COLORS.flatMap((colors) => [makeLeaf("maple", colors, dark), makeLeaf("oval", colors, dark)]);
    let w = 0;
    let h = 0;
    let leaves = [];
    let raf = 0;
    let last = performance.now();

    const leaf = (anywhere) => {
      const z = Math.random() ** 1.4;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -40,
        sprite: sprites[Math.floor(Math.random() * sprites.length)],
        size: 18 + z * 26,
        alpha: 0.55 + z * 0.45,
        vy: 14 + z * 22,
        drift: (Math.random() - 0.5) * 8,
        sway: 18 + Math.random() * 34,
        freq: 0.25 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.2,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 0.8 + Math.random() * 1.6,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(42, Math.max(14, (w * h) / 36000)));
      leaves = Array.from({ length: count }, () => leaf(true));
    };

    const draw = (time) => {
      const t = time / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const l of leaves) {
        const x = l.x + Math.sin(t * l.freq + l.phase) * l.sway;
        const tilt = Math.cos(t * l.freq + l.phase) * 0.5;
        const flip = Math.cos(l.flip);
        ctx.setTransform(dpr, 0, 0, dpr, x * dpr, l.y * dpr);
        ctx.rotate(l.angle + tilt);
        ctx.scale(Math.sign(flip || 1) * Math.max(0.18, Math.abs(flip)), 1);
        ctx.globalAlpha = l.alpha;
        ctx.drawImage(l.sprite, -l.size / 2, -l.size / 2, l.size, l.size);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const step = (time) => {
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      draw(time);
      const wind = Math.sin(time * 0.00008) * 10 + Math.sin(time * 0.00027) * 5;
      for (const l of leaves) {
        l.y += l.vy * dt;
        l.x += (l.drift + wind * l.alpha) * dt;
        l.angle += l.spin * dt;
        l.flip += l.flipSpeed * dt;
        if (l.y > h + 40) Object.assign(l, leaf(false));
        if (l.x > w + 60) l.x = -60;
        else if (l.x < -60) l.x = w + 60;
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
