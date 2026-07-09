import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Search, Grid3X3, Mail, ArrowUp } from 'lucide-react';

const tabs = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Search', icon: Search, path: '/?search=' },
  { label: 'Categories', icon: Grid3X3, path: '/?category=Scholarship' },
  { label: 'Contact', icon: Mail, path: '/contact' },
];

export default function BottomNav({ onSearchTap }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' && !searchParams.get('category') && !searchParams.get('search');
    if (path.includes('category=')) return !!searchParams.get('category');
    if (path.includes('search=')) return !!searchParams.get('search');
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            to={tab.path}
            onClick={(e) => {
              if (tab.label === 'Search') {
                e.preventDefault();
                onSearchTap?.();
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive(tab.path)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
