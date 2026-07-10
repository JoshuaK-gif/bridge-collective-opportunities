import { useState, useEffect, useRef } from 'react';
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
  SheetDescription,
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
  CheckCircle2,
  Heart,
  FileText,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

const navCategories = [
  { label: 'Scholarships', icon: BookOpen, path: '/category/scholarships' },
  { label: 'Grants', icon: DollarSign, path: '/category/grants' },
  { label: 'Jobs', icon: Briefcase, path: '/category/jobs' },
  { label: 'Internships', icon: GraduationCap, path: '/category/internships' },
  { label: 'Fellowships', icon: Award, path: '/category/fellowships' },
  { label: 'Training', icon: Users, path: '/category/training' },
  { label: 'Volunteering', icon: Handshake, path: '/category/volunteer' },
];

const pageLinks = [
  { label: 'BCO Assistant', icon: Sparkles, path: '/ai-assistant' },
  { label: 'About Us', icon: Info, path: '/about' },
  { label: 'Services', icon: Settings, path: '/services' },
  { label: 'Contact', icon: Mail, path: '/contact' },
];

const userLinks = [
  { label: 'Saved', icon: Heart, path: '/saved' },
  { label: 'My Apps', icon: CheckCircle2, path: '/my-applications' },
];

const cvLinks = [
  { label: 'CV Builder', icon: FileText, path: '/cv-builder' },
  { label: 'CV Review', icon: Search, path: '/cv-review' },
  { label: 'CV Tips', icon: Lightbulb, path: '/cv-tips' },
];

// --- Desktop Dropdown ---
function DropdownMenu({ label, icon: Icon, items, location, searchParams }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isItemActive = (itemPath) => {
    if (itemPath.startsWith('/category/')) {
      return location.pathname === itemPath;
    }
    return location.pathname === itemPath;
  };

  const isAnyActive = items.some((i) => isItemActive(i.path));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isAnyActive
            ? 'text-primary bg-primary/5'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
          {items.map(({ label: itemLabel, icon: ItemIcon, path }) => (
            <Link
              key={itemLabel}
              to={path}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isItemActive(path)
                  ? 'text-primary bg-primary/5'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <ItemIcon className="w-4 h-4" /> {itemLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Mobile Accordion Group ---
function MobileAccordion({ label, icon: Icon, items, location, searchParams }) {
  const [expanded, setExpanded] = useState(false);

  const isItemActive = (itemPath) => {
    if (itemPath.startsWith('/category/')) {
      return location.pathname === itemPath;
    }
    return location.pathname === itemPath;
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-500" /> {label}
        </span>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-3 pl-6 border-l-2 border-gray-100 space-y-0.5 mb-1">
          {items.map(({ label: itemLabel, icon: ItemIcon, path }) => (
            <SheetClose asChild key={itemLabel}>
              <Link
                to={path}
                onClick={() => setExpanded(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isItemActive(path)
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ItemIcon className="w-4 h-4" /> {itemLabel}
              </Link>
            </SheetClose>
          ))}
        </div>
      )}
    </div>
  );
}

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
                <SheetDescription className="sr-only">
                  Navigation menu for Bridge Collective Opportunities
                </SheetDescription>
                <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
                  <SheetTitle className="text-left text-lg">
                    <img src="/BCO.png" alt="BCO" className="h-10 md:h-12 w-auto" />
                  </SheetTitle>
                  <SheetClose className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </SheetHeader>

                {/* Mobile nav - grouped with accordion dropdowns */}
                <div className="p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-13rem)]">
                  {/* Home - no dropdown */}
                  <SheetClose asChild>
                    <Link
                      to="/"
                      className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                        isActive('/')
                          ? 'text-primary bg-primary/10'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Home className="w-5 h-5" /> Home
                    </Link>
                  </SheetClose>

                  {/* Opportunities - accordion dropdown */}
                  <MobileAccordion
                    label="Opportunities"
                    icon={Briefcase}
                    items={navCategories}
                    location={location}
                    searchParams={searchParams}
                  />

                  {/* Resume / CV - accordion dropdown */}
                  <MobileAccordion
                    label="Resume / CV"
                    icon={FileText}
                    items={cvLinks}
                    location={location}
                    searchParams={searchParams}
                  />

                  <hr className="my-1 border-gray-100" />

                  {/* Other pages */}
                  {pageLinks.map(({ label, icon: Icon, path }) => (
                    <SheetClose asChild key={label}>
                      <Link
                        to={path}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                          isActive(path)
                            ? 'text-primary bg-primary/10'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" /> {label}
                      </Link>
                    </SheetClose>
                  ))}

                  <hr className="my-1 border-gray-100" />

                  {/* User links */}
                  {userLinks.map(({ label, icon: Icon, path }) => (
                    <SheetClose asChild key={label}>
                      <Link
                        to={path}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                          location.pathname === path
                            ? 'text-red-500 bg-red-50'
                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" /> {label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>

                {/* Search */}
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

                {/* Admin */}
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
      <div className="md:hidden border-b border-gray-100 bg-gray-50/50 overflow-x-auto scrollbar-none" style={{ width: '100%', overscrollBehaviorX: 'contain' }}>
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

      {/* Desktop nav with dropdowns */}
      <nav className="hidden md:block border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-1">
          {/* Home - no dropdown */}
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

          {/* Opportunities - dropdown with categories */}
          <DropdownMenu
            label="Opportunities"
            icon={Briefcase}
            items={navCategories}
            location={location}
            searchParams={searchParams}
          />

          {/* Resume / CV - dropdown */}
          <DropdownMenu
            label="Resume / CV"
            icon={FileText}
            items={cvLinks}
            location={location}
            searchParams={searchParams}
          />

          <span className="w-px h-5 bg-gray-200 mx-1" />

          {/* Other pages */}
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

          <span className="w-px h-5 bg-gray-200 mx-1" />

          {/* User links */}
          {userLinks.map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location.pathname === path
                  ? 'text-red-500 bg-red-50'
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
