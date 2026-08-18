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
  Wand2,
  Edit3,
  ShieldCheck,
  Send,
  Sun,
  Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useTheme } from 'next-themes';
import { getFeatures } from '@/lib/features';

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
  { label: 'About Us', icon: Info, path: '/about' },
  { label: 'Services', icon: Settings, path: '/services' },
  { label: 'Contact', icon: Mail, path: '/contact' },
];

const aiLinks = [
  { label: 'Generate', icon: Wand2, path: '/ai-assistant/generate' },
  { label: 'Funder Check', icon: ShieldCheck, path: '/ai-assistant/check' },
  { label: 'Polish', icon: Edit3, path: '/ai-assistant/polish' },
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

// --- Desktop Dropdown (pure CSS group-hover — no JS timers needed) ---
function DropdownMenu({ label, icon: Icon, items, location }) {
  const isItemActive = (itemPath) => {
    if (itemPath.startsWith('/category/')) {
      return location.pathname === itemPath;
    }
    return location.pathname === itemPath;
  };

  const isAnyActive = items.some((i) => isItemActive(i.path));

  return (
    <div className="relative group">
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
          isAnyActive
            ? 'text-primary bg-primary/5'
            : 'text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10'
        }`}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
        <ChevronDown className="w-3 h-3 transition-transform group-hover:rotate-180" />
      </button>
      <div
        className="absolute top-full left-0 mt-1 min-w-max whitespace-nowrap bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 opacity-0 invisible translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0"
      >
        {items.map(({ label: itemLabel, icon: ItemIcon, path }) => (
          <Link
            key={itemLabel}
            to={path}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              isItemActive(path)
                ? 'text-primary bg-primary/5'
                : 'text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10'
            }`}
          >
            <ItemIcon className="w-4 h-4" /> {itemLabel}
          </Link>
        ))}
      </div>
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
        className="flex items-center justify-between w-full px-3 py-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" /> {label}
        </span>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-3 pl-6 border-l-2 border-gray-100 dark:border-gray-700 space-y-0.5 mb-1">
          {items.map(({ label: itemLabel, icon: ItemIcon, path }) => (
            <SheetClose asChild key={itemLabel}>
              <Link
                to={path}
                onClick={() => setExpanded(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isItemActive(path)
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
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
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [subEmail, setSubEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [features, setFeatures] = useState(null);

  useEffect(() => {
    getFeatures().then(setFeatures);
  }, []);

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
    const q = searchValue.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const visibleAiLinks = features?.grantAssistant === false
    ? aiLinks.filter((l) => l.path !== '/ai-assistant/check')
    : aiLinks;

  return (
    <header className={`sticky top-0 z-50 transition-shadow ${scrolled ? 'shadow-md bg-white dark:bg-gray-900' : 'bg-white dark:bg-gray-900'}`}>
      {/* Top bar */}
      <div className="border-b border-gray-100 dark:border-gray-800 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Empowering Youth through Access to Information and Opportunities</span>
          <div className="flex items-center gap-4">
            {isAuthenticated && user?.role === 'admin' && (
              <Link to="/admin-bridgejobs" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                <Shield className="w-3 h-3" /> Admin
              </Link>
            )}
            {isAuthenticated && user?.role === 'admin' ? (
              <button onClick={logout} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between gap-2 md:gap-4">
          {/* Left: Logo + Menu */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
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
                  <SheetTitle className="text-left">
                    <Link to="/" className="flex items-center gap-0">
                      <img src="https://res.cloudinary.com/et33rup2/image/upload/w_256,f_auto,q_auto/v1786959015/BCO.png" alt="BCO" className="h-16 md:h-20 w-auto" />
                      <span className="font-bold text-[10px] md:text-xs leading-tight text-accent">
                        BRIDGE COLLECTIVE<br />OPPORTUNITIES
                      </span>
                    </Link>
                  </SheetTitle>
                  <SheetClose className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </SheetHeader>

                {/* Mobile nav - grouped with accordion dropdowns */}
                <div className="p-3 space-y-0.5 overflow-y-auto max-h-[calc(100vh-13rem)]">
                  <SheetClose asChild>
                    <Link
                      to="/"
                      className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                        isActive('/')
                          ? 'text-primary bg-primary/10'
                          : 'text-gray-700 dark:text-gray-200 hover:text-accent hover:bg-accent/10'
                      }`}
                    >
                      <Home className="w-5 h-5" /> Home
                    </Link>
                  </SheetClose>

                  <MobileAccordion
                    label="Opportunities"
                    icon={Briefcase}
                    items={navCategories}
                    location={location}
                    searchParams={searchParams}
                  />
                  <MobileAccordion
                    label="Resume / CV"
                    icon={FileText}
                    items={cvLinks}
                    location={location}
                    searchParams={searchParams}
                  />

                  <hr className="my-1 border-gray-100 dark:border-gray-700" />

                  {features?.ai !== false && (
                    <MobileAccordion
                      label="AI Assistant"
                      icon={Sparkles}
                      items={visibleAiLinks}
                      location={location}
                      searchParams={searchParams}
                    />
                  )}

                  {pageLinks.map(({ label, icon: Icon, path }) => (
                    <SheetClose asChild key={label}>
                      <Link
                        to={path}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                          isActive(path)
                            ? 'text-primary bg-primary/10'
                            : 'text-gray-700 dark:text-gray-200 hover:text-accent hover:bg-accent/10'
                        }`}
                      >
                        <Icon className="w-5 h-5" /> {label}
                      </Link>
                    </SheetClose>
                  ))}

                  <hr className="my-1 border-gray-100 dark:border-gray-700" />

                  {userLinks.map(({ label, icon: Icon, path }) => (
                    <SheetClose asChild key={label}>
                      <Link
                        to={path}
                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                          location.pathname === path
                            ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                            : 'text-gray-700 dark:text-gray-200 hover:text-accent hover:bg-accent/10'
                        }`}
                      >
                        <Icon className="w-5 h-5" /> {label}
                      </Link>
                    </SheetClose>
                  ))}

                  <hr className="my-1 border-gray-100 dark:border-gray-700" />

                  {/* Post Opp - mobile */}
                  <SheetClose asChild>
                    <Link
                      to="/submit-opportunity"
                      className="btn-fill flex items-center gap-3 w-full px-3 py-3 rounded-lg text-base font-semibold text-white"
                    >
                      <Send className="w-5 h-5" /> Post Opportunity
                    </Link>
                  </SheetClose>
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
                  <div className="border-t p-4">
                    <button
                      onClick={() => { logout(); setSheetOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-base font-medium text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" /> Sign Out
                    </button>
                  </div>
                )}
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-0 shrink-0 min-w-0">
              <img src="https://res.cloudinary.com/et33rup2/image/upload/w_256,f_auto,q_auto/v1786959015/BCO.png" alt="BCO" className="h-12 md:h-20 w-auto" />
              <span className="hidden sm:block font-bold text-[9px] md:text-xs leading-tight text-accent">
                BRIDGE COLLECTIVE<br />OPPORTUNITIES
              </span>
            </Link>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="relative shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              aria-label="Toggle dark mode"
            >
              <div className="relative w-4 h-4 md:w-5 md:h-5">
                <Sun
                  className={`absolute inset-0 w-full h-full text-amber-500 transition-all duration-300 ${
                    theme === 'dark' ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
                  }`}
                />
                <Moon
                  className={`absolute inset-0 w-full h-full text-indigo-400 transition-all duration-300 ${
                    theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
                  }`}
                />
              </div>
            </button>

            {/* Search icon (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0 w-8 h-8"
              onClick={() => {
                const input = document.querySelector('#mobile-search-input');
                input?.focus();
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </Button>

            {/* Post Opp - desktop header (spaced from search) */}
            <Link
              to="/submit-opportunity"
              className="btn-fill hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white shrink-0"
            >
              <Send className="w-3 h-3" /> Post Opp
            </Link>

            {/* Search bar (desktop) */}
            <form onSubmit={handleSearch} className="hidden md:flex relative w-40 lg:w-56 xl:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9 h-8 md:h-9 text-xs md:text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus-visible:bg-white dark:focus-visible:bg-gray-800"
              />
            </form>

            {/* Daily Updates (desktop large) */}
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
              className="hidden xl:flex items-center gap-1.5"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Daily Updates</span>
              <Input
                type="email"
                placeholder="your@email.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                required
                className="h-7 w-28 text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
              <Button type="submit" size="sm" disabled={subscribing} className="h-7 w-7 p-0 shrink-0">
                <Bell className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile category pills */}
      <div className="md:hidden border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 overflow-x-auto scrollbar-none" style={{ width: '100%', overscrollBehaviorX: 'contain' }}>
        <div className="flex gap-1.5 px-3 py-2 min-w-0">
          {[{ label: 'All', icon: Home, path: '/' }, ...navCategories].map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive(path)
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-2 space-y-2">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="mobile-search-input"
            placeholder="Search opportunities..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9 text-sm bg-white dark:bg-gray-800"
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
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Daily Updates
          </span>
          <Input
            type="email"
            placeholder="your@email.com"
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            required
            className="h-8 text-xs flex-1 bg-white dark:bg-gray-800"
          />
          <Button type="submit" size="sm" disabled={subscribing} className="h-8 w-8 p-0 shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>

      {/* Desktop nav with dropdowns — hover-activated, one at a time */}
      <nav className="hidden md:block border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
        onMouseLeave={() => setActiveDropdown(null)}>
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center gap-1 flex-nowrap">
          {/* Home */}
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
              isActive('/')
                ? 'text-primary bg-primary/5'
                : 'text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>

          <DropdownMenu
            label="Opportunities"
            icon={Briefcase}
            items={navCategories}
            location={location}
            isOpen={activeDropdown === 'Opportunities'}
            onOpen={() => setActiveDropdown('Opportunities')}
            onClose={() => setActiveDropdown(prev => prev === 'Opportunities' ? null : prev)}
          />
          <DropdownMenu
            label="Resume / CV"
            icon={FileText}
            items={cvLinks}
            location={location}
            isOpen={activeDropdown === 'Resume / CV'}
            onOpen={() => setActiveDropdown('Resume / CV')}
            onClose={() => setActiveDropdown(prev => prev === 'Resume / CV' ? null : prev)}
          />
          {features?.ai !== false && (
            <DropdownMenu
              label="AI Assistant"
              icon={Sparkles}
              items={visibleAiLinks}
              location={location}
              isOpen={activeDropdown === 'AI Assistant'}
              onOpen={() => setActiveDropdown('AI Assistant')}
              onClose={() => setActiveDropdown(prev => prev === 'AI Assistant' ? null : prev)}
            />
          )}

          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {pageLinks.map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                isActive(path)
                  ? 'text-primary bg-primary/5'
                  : 'text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </Link>
          ))}

          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {userLinks.map(({ label, icon: Icon, path }) => (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${
                location.pathname === path
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'text-gray-600 dark:text-gray-300 hover:text-accent hover:bg-accent/10'
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
