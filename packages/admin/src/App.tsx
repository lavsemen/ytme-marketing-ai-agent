import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { SourcesPage } from './pages/Sources';
import { GeneratePage } from './pages/Generate';
import { RunStatusPage } from './pages/RunStatus';
import { HistoryPage } from './pages/History';
import { ResultDetailPage } from './pages/ResultDetail';
import { useAuth } from './hooks/useAuth';

function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { pat, user, loading } = useAuth();
  const location = useLocation();

  if (!pat) return <Navigate to="/login" state={{ from: location }} replace />;
  if (loading && !user) {
    return <div className="p-8 text-center text-sm text-slate-500">Проверяем токен…</div>;
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
            {user ? <Layout user={user} onLogout={logout} /> : null}
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/sources" replace />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/runs/:runId" element={<RunStatusPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/results/:slug" element={<ResultDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/sources" replace />} />
    </Routes>
  );
}
