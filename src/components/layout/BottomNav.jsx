import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Search, Heart, CheckCircle2, FileText, GraduationCap } from 'lucide-react';

const tabs = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Search', icon: Search, path: '/?search=' },
  { label: 'Courses', icon: GraduationCap, href: 'https://bcocourses.vercel.app/' },
  { label: 'Saved', icon: Heart, path: '/saved' },
  { label: 'My Apps', icon: CheckCircle2, path: '/my-applications' },
  { label: 'CV', icon: FileText, path: '/cv-builder' },
];

export default function BottomNav({ onSearchTap }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' && !searchParams.get('category') && !searchParams.get('search');
    if (path.includes('search=')) return !!searchParams.get('search');
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => (
          tab.href ? (
            <a
              key={tab.label}
              href={tab.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </a>
          ) : (
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
              <tab.icon className={`w-5 h-5 ${tab.label === 'Saved' || tab.label === 'My Apps' ? 'text-red-500' : ''}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        ))}
      </div>
    </nav>
  );
}
