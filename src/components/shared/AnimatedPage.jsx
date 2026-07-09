import { motion } from 'framer-motion';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
};

export const AnimatedPage = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="hidden"
    animate="visible"
    exit={{ opacity: 0, transition: { duration: 0.4 } }}
  >
    {children}
  </motion.div>
);

export const AnimatedChild = ({ children, className }) => (
  <motion.div
    variants={childVariants}
    className={className}
  >
    {children}
  </motion.div>
);
