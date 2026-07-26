import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/store/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { AppPage } from '@/pages/AppPage';
import { InvitePage } from '@/pages/InvitePage';

// Usar HashRouter cuando se ejecuta en Electron / archivo local (file://) para evitar pantalla negra en las rutas
const isFileProtocol = typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.electronAPI);
const Router = isFileProtocol ? HashRouter : BrowserRouter;
 
export default function App() {
  useEffect(() => {
    const saved = localStorage.getItem('moonlight:theme-color') || 'moonlight';
    const THEME_COLORS = {
      'rojo':        '359 82% 60%', // Rojo
      'moonlight':   '235 86% 65%', // Azul Discord
      'amarillo':    '48 89% 55%',  // Amarillo
      'verde':       '142 71% 45%', // Verde
      'gris-ceniza': '0 0% 42%',    // Gris Ceniza (#6B6B6B)
      // Fallbacks para limpiar valores antiguos sin errores
      'gris-medio':   '0 0% 42%',
      'gris-oscuro':  '0 0% 42%',
      'platino':      '0 0% 42%',
      'titanio':      '0 0% 42%',
      'plata':        '0 0% 42%',
      'grafito':      '0 0% 42%',
      'luna-llena':   '0 0% 42%',
      'luz-lunar':    '0 0% 42%',
      'polvo-lunar':  '0 0% 42%',
      'crater':       '0 0% 42%',
      'ceniza-lunar': '0 0% 42%',
      'eclipse':      '0 0% 42%',
      'mar-sombras':  '0 0% 42%',
      'cara-oculta':  '0 0% 42%',
    };
    const targetHsl = THEME_COLORS[saved] || THEME_COLORS.moonlight;
    document.documentElement.style.setProperty('--dynamic-accent', targetHsl);
  }, []);
 
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:inviteCode" element={<InvitePage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
