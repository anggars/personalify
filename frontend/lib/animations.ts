import { Variants, Transition } from "framer-motion";

// Spring configs
export const springSmooth: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 24
};

export const springBouncy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 17
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30
};

// Stagger container for children animations
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
};

// Fade up animation
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: springSmooth
  }
};

// Fade in animation (no movement)
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1,
    transition: { duration: 0.3 }
  }
};

// Scale pop effect
export const scalePop: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: springBouncy
  }
};

// Scale fade (subtle)
export const scaleFade: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: springSmooth
  }
};

// Slide from left
export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: springSmooth
  }
};

// Slide from right
export const slideRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: springSmooth
  }
};

// Bar slide animation (for progress bars)
export const barSlide: Variants = {
  hidden: { opacity: 0, scaleX: 0 },
  show: { 
    opacity: 1, 
    scaleX: 1,
    transition: {
      ...springSmooth,
      delay: 0.1
    }
  }
};

// Hover effects
export const hoverLift = {
  y: -4,
  transition: springBouncy
};

export const hoverScale = {
  scale: 1.02,
  transition: springBouncy
};

export const hoverScaleSmall = {
  scale: 1.05,
  transition: springSnappy
};

export const tapScale = {
  scale: 0.98
};

// Page transition variants
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.2 }
  }
};

// List item stagger (for artist/track lists)
export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { 
    opacity: 1, 
    x: 0,
    transition: springSmooth
  }
};

// Card reveal (for glass cards)
export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  show: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20
    }
  }
};

// Icon pop (for social icons, buttons)
export const iconPop: Variants = {
  hidden: { opacity: 0, scale: 0 },
  show: { 
    opacity: 1, 
    scale: 1,
    transition: springBouncy
  }
};
