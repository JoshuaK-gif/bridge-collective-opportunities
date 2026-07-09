import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import {
  LogOut,
  Shield,
  Menu,
  Search,
  Briefcase,
  GraduationCap,
  BookOpen,
  Users,
  Handshake,
  Award,
  DollarSign,
  Home,
  Info,
  Settings,
  Mail,
  X,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const navCategories = [
  { label: 'Scholarships', icon: BookOpen, path: '/?category=Scholarship' },
  { label: 'Grants', icon: DollarSign, path: '/?category=Grant' },
  { label: 'Jobs', icon: Briefcase, path: '/?category=Job' },
  { label: 'Internships', icon: GraduationCap, path: '/?category=Internship' },
  { label: 'Fellowships', icon: Award, path: '/?category=Fellowship' },
  { label: 'Training', icon: Users, path: '/?category=Training' },
  { label: 'Volunteering', icon: Handshake, path: '/?category=Volunteer' },
];

const pageLinks = [
  { label: 'About Us', icon: Info, path: '/about' },
  { label: 'Services', icon: Settings, path: '/services' },
  { label: 'Contact', icon: Mail, path: '/contact' },
];

const mobileCategories = [
  { label: 'All Opportunities', icon: Home, path: '/' },
  ...navCategories,
  ...pageLinks,
];

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (path) => {
    if (path.startsWith('/?category=')) {
      const cat = path.split('=')[1];
      return location.pathname === '/' && searchParams.get('category') === cat;
    }
    if (path === '/') {
      return location.pathname === '/' && !searchParams.get('category');
    }
    return location.pathname === path;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    const cat = searchParams.get('category');
    if (cat) params.set('category', cat);
    navigate(`/?${params.toString()}`);
  };

  return (
    <header className={`sticky top-0 z-50 transition-shadow ${scrolled ? 'shadow-md bg-white' : 'bg-white'}`}>
      {/* Top bar */}
      <div className="border-b border-gray-100 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between text-xs text-gray-500">
          <span>Empowering Youth through Access to Information and Opportunities</span>
          <div className="flex items-center gap-4">
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/admin-bridgejobs" className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                <Shield className="w-3 h-3" /> Admin
              </Link>
            )}
            {isAuthenticated && user?.role === 'admin' ? (
              <button onClick={logout} className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0" hideClose>
                <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
                  <SheetTitle className="text-left text-lg"><img src="/BCO.png" alt="BCO" className="h-10 md:h-12 w-auto" /></SheetTitle>
                  <SheetClose className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </SheetHeader>
                <div className="p-3 space-y-0.5">
                  {mobileCategories.map(({ label, icon: Icon, path }) => (
                    <SheetClose asChild key={label}>
                      <Link
                        to={path}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                          isActive(path)
                            ? 'text-primary bg-primary/10'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" /> {label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>
                <div className="border-t p-4">
                  <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search opportunities..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="pl-9 h-10 text-base"
                    />
                  </form>
                </div>
                {isAuthenticated && user?.role === 'admin' && (
                  <div className="border-t p-4 space-y-2">
                    <SheetClose asChild>
                      <Link
                        to="/admin-bridgejobs"
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        <Shield className="w-5 h-5" /> Admin Dashboard
                      </Link>
                    </SheetClose>
                    <button
                      onClick={() => { logout(); setSheetOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5" /> Sign Out
                    </button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link to="/" className="shrink-0">
              <img src="/BCO.png" alt="BCO" className="h-12 md:h-16 w-auto" />
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => {
                const input = document.querySelector('#mobile-search-input');
                input?.focus();
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </Button>
            <form onSubmit={handleSearch} className="hidden md:flex relative w-56 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search opportunities..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9 h-9 text-sm bg-gray-50 border-gray-200 focus-visible:bg-white"
              />
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!subEmail) return;
                setSubscribing(true);
                try {
                  await api.subscribers.subscribe(subEmail);
                  toast.success('Subscribed to daily updates!');
                  setSubEmail('');
                } catch {
                  toast.error('Failed to subscribe');
                } finally {
                  setSubscribing(false);
                }
              }}
              className="hidden lg:flex items-center gap-1.5"
            >
              <span className="text-xs text-gray-500 whitespace-nowrap">Daily Updates</span>
              <Input
                type="email"
                placeholder="your@email.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                required
                className="h-7 w-32 text-xs bg-gray-50 border-gray-200"
              />
              <Button type="submit" size="sm" disabled={subscribing} className="h-7 w-7 p-0 shrink-0">
                <Bell className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile category pills */}
      <div className="md:hidden border-b border-gray-100 bg-gray-50/50 overflow-x-auto scrollbar-none">
        <div className="flex gap-1.5 px-3 py-2.5 min-w-0">
          {[{ label: 'All', icon: Home, path: '/' }, ...navCategories].map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive(path)
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden border-b border-gray-100 bg-gray-50/50 px-4 py-2 space-y-2">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="mobile-search-input"
            placeholder="Search opportunities..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9 text-sm bg-white"
          />
        </form>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!subEmail) return;
            setSubscribing(true);
            try {
              await api.subscribers.subscribe(subEmail);
              toast.success('Subscribed to daily updates!');
              setSubEmail('');
            } catch {
              toast.error('Failed to subscribe');
            } finally {
              setSubscribing(false);
            }
          }}
          className="flex items-center gap-1.5"
        >
          <span className="text-xs text-gray-500 whitespace-nowrap">
            Daily Updates
          </span>
          <Input
            type="email"
            placeholder="your@email.com"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            required
            className="h-8 text-xs flex-1 bg-white"
          />
          <Button type="submit" size="sm" disabled={subscribing} className="h-8 w-8 p-0 shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>

      {/* Category nav */}
      <nav className="hidden md:block border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive('/')
                ? 'text-primary bg-primary/5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
          {navCategories.map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(path)
                  ? 'text-primary bg-primary/5'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </Link>
          ))}
          <span className="w-px h-5 bg-gray-200 mx-1" />
          {pageLinks.map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(path)
                  ? 'text-primary bg-primary/5'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
