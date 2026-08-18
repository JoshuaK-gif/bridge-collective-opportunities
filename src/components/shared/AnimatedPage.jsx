export const AnimatedPage = ({ children }) => (
  <div className="animate-fade-in">
    {children}
  </div>
);

export const AnimatedChild = ({ children, className }) => (
  <div className={className}>
    {children}
  </div>
);
