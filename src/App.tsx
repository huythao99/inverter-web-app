import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DeviceDetail } from './pages/DeviceDetail';
import { ChargerDetail } from './pages/ChargerDetail';
import { AddDevice } from './pages/AddDevice';
import { PublicView } from './pages/PublicView';
import { HomeAssistant } from './pages/HomeAssistant';
import { EnergyOverview } from './pages/EnergyOverview';
import { PowerShare } from './pages/PowerShare';
import { ShareGroupEditor } from './pages/ShareGroupEditor';
import { ShareGroupOverview } from './pages/ShareGroupOverview';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename="/app">
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Public read-only link: no login */}
            <Route path="/v/:token" element={<PublicView />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices/:deviceId"
              element={
                <ProtectedRoute>
                  <DeviceDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chargers/:deviceId"
              element={
                <ProtectedRoute>
                  <ChargerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-device"
              element={
                <ProtectedRoute>
                  <AddDevice />
                </ProtectedRoute>
              }
            />
            <Route
              path="/overview"
              element={
                <ProtectedRoute>
                  <EnergyOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share"
              element={
                <ProtectedRoute>
                  <PowerShare />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share/new"
              element={
                <ProtectedRoute>
                  <ShareGroupEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share/:groupId"
              element={
                <ProtectedRoute>
                  <ShareGroupOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share/:groupId/edit"
              element={
                <ProtectedRoute>
                  <ShareGroupEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home-assistant"
              element={
                <ProtectedRoute>
                  <HomeAssistant />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
