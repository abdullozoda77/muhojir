import { useEffect, useState } from "react";
import { LazyMotion, MotionConfig, animate, domAnimation, m, useReducedMotion } from "motion/react";

// All animations of the site in one place. LazyMotion + "m" load only the small DOM animation part of the
// library, and reducedMotion="user" turns movement off for people who asked their phone for less motion.
export function MotionProvider({ children }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const EASE = [0.22, 1, 0.36, 1]; // fast start, soft landing

// Content must never depend on an animation to become visible: a tab opened in the background pauses animations,
// so there everything starts in its final state (initial={false}) instead of transparent.
export const startShown = () => typeof document !== "undefined" && document.visibilityState === "hidden";

// A page appearing: fades in and rises a little. Keyed by the address, so it replays on every page change.
export function PageTransition({ children, pageKey }) {
  return (
    <m.div key={pageKey} initial={startShown() ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </m.div>
  );
}

// A list whose items appear one after another (cards, rows, tiles).
const listVariants = { hidden: {}, shown: { transition: { staggerChildren: 0.06 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

export function Stagger({ as = "div", className = "", children, ...props }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={listVariants} initial={startShown() ? false : "hidden"} animate="shown" {...props}>
      {children}
    </Tag>
  );
}

// Like Stagger, but it starts when the group scrolls into view (once), e.g. the footer columns.
const revealVariants = { hidden: {}, shown: { transition: { staggerChildren: 0.12 } } };

export function RevealGroup({ as = "div", className = "", children, ...props }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={revealVariants} initial={startShown() ? false : "hidden"} whileInView="shown" viewport={{ once: true, amount: 0.2 }} {...props}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ as = "div", className = "", children, ...props }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={itemVariants} {...props}>
      {children}
    </Tag>
  );
}

// A number counting up from 0 (days left on the deadline ring). In a tab that is not visible the browser
// pauses animations, so there the real number is shown at once: "0 days" must never be left on screen.
export function CountUp({ value, duration = 0.9 }) {
  const reduce = useReducedMotion();
  const skip = reduce || startShown();
  const [shown, setShown] = useState(skip ? value : 0);
  useEffect(() => {
    if (skip) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, duration, skip]);
  return shown;
}

export { m, EASE };
