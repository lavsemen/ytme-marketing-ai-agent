import { NavLink, Outlet } from 'react-router-dom';
import { LogOut, FileText, Play, Database, History } from 'lucide-react';
import type { ReactNode } from 'react';

interface LayoutProps {
  user: { login: string; avatar_url: string };
  onLogout: () => void;
}

const navItems = [
  { to: '/sources', label: 'Источники', icon: Database },
  { to: '/generate', label: 'Запустить', icon: Play },
  { to: '/history', label: 'История', icon: History },
];

export function Layout({ user, onLogout }: LayoutProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-brand p-1.5 text-white">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">YouTravel Marketing AI</h1>
              <p className="text-xs text-slate-500">Admin panel</p>
            </div>
          </div>
          <nav className="hidden gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url}
                alt={user.login}
                className="h-7 w-7 rounded-full"
              />
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                {user.login}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <nav className="flex border-t border-slate-200 px-2 py-1 md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-xs ${
                  isActive ? 'text-brand' : 'text-slate-500'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        Все правки источников и запуски попадают в репозиторий как коммиты в ветке main.
      </footer>
    </div>
  );
}
