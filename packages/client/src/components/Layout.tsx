import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Wallet,
  LayoutDashboard,
  Camera,
  TrendingUp,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ListTodo,
  CalendarDays,
  CirclePlus,
  LineChart,
} from 'lucide-react';

interface NavApp {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  basePath: string;
  children: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const apps: NavApp[] = [
  {
    id: 'networth',
    label: 'Net Worth',
    icon: Wallet,
    basePath: '/networth',
    children: [
      { to: '/networth', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/networth/snapshots', label: 'Snapshots', icon: Camera },
      { to: '/networth/insights', label: 'Insights', icon: TrendingUp },
      { to: '/networth/admin', label: 'Admin', icon: Settings },
    ],
  },
  {
    id: 'todo',
    label: 'Planning',
    icon: ListTodo,
    basePath: '/todo',
    children: [
      { to: '/todo', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/todo/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    icon: LineChart,
    basePath: '/stocks',
    children: [
      { to: '/stocks', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/stocks/new', label: 'Add Stock', icon: CirclePlus },
    ],
  },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const location = useLocation();

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)); } catch {}
  }, [collapsed]);

  // Auto-expand the app section whose basePath matches the current route
  const activeAppId = apps.find((app) => location.pathname.startsWith(app.basePath))?.id || null;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 sticky top-0 h-screen ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-3 h-16 border-b border-gray-200 flex-shrink-0">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">PH</span>
          </div>
          {!collapsed && <span className="font-bold text-gray-900 text-lg truncate">Personal Hub</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
            title="Home"
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Home</span>}
          </NavLink>

          {/* App Sections */}
          {apps.map((app) => {
            const isActiveApp = activeAppId === app.id;
            const AppIcon = app.icon;
            const showChildren = isActiveApp && !collapsed && app.children.length > 0;

            return (
              <div key={app.id}>
                <NavLink
                  to={app.basePath}
                  end={app.children.length > 0}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive || isActiveApp
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                  title={app.label}
                >
                  <AppIcon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{app.label}</span>
                      {app.children.length > 0 && (
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showChildren ? '' : '-rotate-90'}`}
                        />
                      )}
                    </>
                  )}
                </NavLink>

                {/* Sub-routes */}
                {showChildren && (
                  <div className="ml-5 pl-3 border-l border-gray-200 mt-1 space-y-0.5">
                    {app.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.to === app.basePath}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              isActive
                                ? 'text-primary-700 font-medium bg-primary-50/50'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`
                          }
                        >
                          <ChildIcon className="w-4 h-4" />
                          <span>{child.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-2 flex-shrink-0 space-y-1">
          <NavLink
            to="/help"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
            title="Help"
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Help</span>}
          </NavLink>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors w-full"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
