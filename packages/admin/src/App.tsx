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
import { useAuth } from './hooks/useAuth';
import { repoConfigError } from './lib/config';

function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { pat, user, loading } = useAuth();
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

  if (!pat) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loading && !user) {
    return <div className="p-8 text-center text-sm text-ink-muted">Проверяем токен…</div>;
  }
  return <>{children}</>;
}

export default function App(): ReactNode {
  const { user, logout, warnings } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            {user ? <Layout user={user} onLogout={logout} warnings={warnings} /> : null}
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/sources" replace />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/runs/:runId" element={<RunStatusPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/results/:slug" element={<ResultDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/sources" replace />} />
    </Routes>
  );
}
