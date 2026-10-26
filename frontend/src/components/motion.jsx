import { useEffect, useState } from "react";
import { LazyMotion, MotionConfig, animate, domAnimation, m, useReducedMotion } from "motion/react";

export function MotionProvider({ children }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

const EASE = [0.22, 1, 0.36, 1];

export const startShown = () => typeof document !== "undefined" && document.visibilityState === "hidden";

export function PageTransition({ children, pageKey }) {
  return (
    <m.div key={pageKey} initial={startShown() ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </m.div>
  );
}

const listVariants = { hidden: {}, shown: { transition: { staggerChildren: 0.06 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

export function Stagger({ as = "div", className = "", inView = false, children, ...props }) {
  const Tag = m[as];
  const play = inView ? { whileInView: "shown", viewport: { once: true, amount: 0.15 } } : { animate: "shown" };
  return (
    <Tag className={className} variants={listVariants} initial={startShown() ? false : "hidden"} {...play} {...props}>
      {children}
    </Tag>
  );
}

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

export function Reveal({ as = "div", className = "", delay = 0, children, ...props }) {
  const Tag = m[as];
  return (
    <Tag
      className={className}
      initial={startShown() ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      {...props}
    >
      {children}
    </Tag>
  );
}

const introVariants = { hidden: {}, shown: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const introItemVariants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
};

export function Intro({ as = "div", className = "", children, ...props }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={introVariants} initial={startShown() ? false : "hidden"} animate="shown" {...props}>
      {children}
    </Tag>
  );
}

export function IntroItem({ as = "div", className = "", children, ...props }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={introItemVariants} {...props}>
      {children}
    </Tag>
  );
}

export function CountUp({ value, duration = 0.9, format = String }) {
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
  return format(shown);
}

export { m, EASE };
