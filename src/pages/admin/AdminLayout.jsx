import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, List, Tags, Mail, Settings, Users, LogOut, RefreshCw, Sliders, BookOpen, Menu, X, FileText, Newspaper, Copy, Lightbulb } from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nav = [
    { label: 'Dashboard', path: '/admin-bridgejobs', icon: LayoutDashboard },
    { label: 'Opportunities', path: '/admin-bridgejobs/opportunities', icon: List },
    { label: 'Curated Lists', path: '/admin-bridgejobs/lists', icon: BookOpen },
    { label: 'Categories', path: '/admin-bridgejobs/categories', icon: Tags },
    { label: 'Messages', path: '/admin-bridgejobs/messages', icon: Mail },
    { label: 'Site Settings', path: '/admin-bridgejobs/settings', icon: Settings },
    { label: 'Pages', path: '/admin-bridgejobs/pages', icon: FileText },
    { label: 'CV Tips', path: '/admin-bridgejobs/cv-tips', icon: Lightbulb },
    { label: 'News', path: '/admin-bridgejobs/news', icon: Newspaper },
    { label: 'Templates', path: '/admin-bridgejobs/templates', icon: Copy },
    // { label: 'AI Extractor', path: '/admin-bridgejobs/ai-extract', icon: Sparkles },
    { label: 'Submissions', path: '/admin-bridgejobs/opportunities?status=pending', icon: Mail },
    { label: 'Subscribers', path: '/admin-bridgejobs/subscribers', icon: Users },
    { label: 'Auto-Publish', path: '/admin-bridgejobs/scraper', icon: RefreshCw },
    { label: 'Scraper Config', path: '/admin-bridgejobs/scraper/config', icon: Sliders },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b px-4 h-14">
        <Link to="/" className="flex items-center gap-0">
          <img src="https://res.cloudinary.com/dhkricnk2/image/upload/v1784383073/BCO.png" alt="BCO" className="h-16 md:h-20 w-auto" />
          <span className="font-bold text-[10px] leading-tight">
            BRIDGE COLLECTIVE<br />OPPORTUNITIES
          </span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 z-50 w-64 bg-white border-r p-4 flex flex-col shrink-0 h-full md:h-screen
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="hidden md:flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-0">
            <img src="https://res.cloudinary.com/dhkricnk2/image/upload/v1784383073/BCO.png" alt="BCO" className="h-20 w-auto" />
            <span className="font-bold text-[10px] leading-tight">
              BRIDGE COLLECTIVE<br />OPPORTUNITIES
            </span>
          </Link>
        </div>
        <div className="md:hidden flex items-center justify-between mb-6">
          <span className="font-bold text-lg font-heading">Menu</span>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={logout}>
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-4 md:p-6 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
