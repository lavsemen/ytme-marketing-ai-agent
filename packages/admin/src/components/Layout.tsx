import { NavLink, Outlet } from 'react-router-dom';
import {
  LogOut,
  Play,
  Database,
  History,
  MessageSquareText,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface LayoutProps {
  user: { login: string; avatar_url: string };
  onLogout: () => void;
  warnings?: string[];
}

const navItems = [
  { to: '/sources', label: 'Источники', icon: Database },
  { to: '/prompts', label: 'Промпты', icon: MessageSquareText },
  { to: '/settings', label: 'Настройки', icon: Settings },
  { to: '/generate', label: 'Запустить', icon: Play },
  { to: '/history', label: 'История', icon: History },
];

export function Layout({ user, onLogout, warnings = [] }: LayoutProps): ReactNode {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-line-subtle bg-surface-1">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="font-display text-xl font-black leading-none tracking-tight text-ink-primary">
              News2<span className="text-lime">Trip</span>
            </div>
            <span className="hidden text-xxs font-bold uppercase tracking-widest text-ink-faint sm:inline">
              Admin
            </span>
          </div>

          <nav className="hidden gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'nav-link-active' : ''}`
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
                className="h-7 w-7 rounded-full ring-1 ring-line"
              />
              <span className="hidden text-sm font-semibold text-ink-secondary sm:inline">
                {user.login}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink-primary"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <nav className="flex border-t border-line-subtle bg-surface-1 px-2 py-1 md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-xxs font-semibold transition-colors ${
                  isActive ? 'text-lime' : 'text-ink-muted'
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
          {warnings.length > 0 && (
            <div className="ds-notice ds-notice-warning mb-5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold uppercase tracking-wider text-xxs">
                  Проверьте права GitHub-токена
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-warning/90">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-line-subtle bg-surface-1 py-3 text-center text-xxs text-ink-muted">
        Все правки и запуски попадают в репозиторий как коммиты в ветке{' '}
        <code className="font-mono text-ink-secondary">main</code>.
      </footer>
    </div>
  );
}
