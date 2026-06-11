import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { SourcesPage } from './pages/Sources';
import { GeneratePage } from './pages/Generate';
import { RunStatusPage } from './pages/RunStatus';
import { HistoryPage } from './pages/History';
import { ResultDetailPage } from './pages/ResultDetail';
import { PromptsPage } from './pages/Prompts';
import { SettingsPage } from './pages/Settings';
import { SchedulesPage } from './pages/Schedules';
import { CatalogPage } from './pages/Catalog';
import { useAuth } from './hooks/useAuth';
import { repoConfigError } from './lib/config';

function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { user, loading, firebaseUser, isAdmin } = useAuth();
  const location = useLocation();
  const repoError = repoConfigError();

  if (repoError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="ds-notice ds-notice-danger">
          <div>
            <p className="font-bold uppercase tracking-wider text-xxs">Ошибка конфигурации</p>
            <p className="mt-2 text-sm">{repoError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !firebaseUser) {
    return <div className="p-8 text-center text-sm text-ink-muted">Проверяем сессию…</div>;
  }

  if (!firebaseUser) return <Navigate to="/login" state={{ from: location }} replace />;
  if (isAdmin === null) {
    return <div className="p-8 text-center text-sm text-ink-muted">Проверяем доступ…</div>;
  }
  if (isAdmin === false) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <div className="ds-notice ds-notice-warning">
          <div>
            <p className="font-bold uppercase tracking-wider text-xxs">Доступ ожидает подтверждения</p>
            <p className="mt-2 text-sm">
              Аккаунт <code className="font-mono">{user?.login ?? firebaseUser.email ?? firebaseUser.uid}</code>{' '}
              ещё не отмечен как admin. Откройте Firebase Console → Firestore → users/{'{'}login{'}'} и
              поставьте <code className="font-mono">admin: true</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App(): ReactNode {
  const { user, logout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            {user ? <Layout user={user} onLogout={logout} warnings={[]} /> : null}
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/sources" replace />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/runs/:runId" element={<RunStatusPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/results/:slug" element={<ResultDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/sources" replace />} />
    </Routes>
  );
}
