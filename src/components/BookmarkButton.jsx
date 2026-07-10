import { Heart } from 'lucide-react';

export default function BookmarkButton({ isBookmarked, onToggle, className = '', size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const btnSize = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`${btnSize} rounded-full transition-colors ${
        isBookmarked
          ? 'bg-red-50 text-red-500 hover:bg-red-100'
          : 'bg-white/80 text-gray-400 hover:text-red-400 hover:bg-white'
      } ${className}`}
      aria-label={isBookmarked ? 'Remove from saved' : 'Save opportunity'}
    >
      <Heart
        className={`${sizeClass} transition-all ${
          isBookmarked ? 'fill-red-500 scale-110' : 'fill-transparent'
        }`}
      />
    </button>
  );
}
