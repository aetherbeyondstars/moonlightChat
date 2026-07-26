// ============================================================================
// AuthContext.jsx
// Maneja el estado de sesión (usuario + token) y la conexión/desconexión
// del socket en función de si hay sesión activa.
// ============================================================================
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket, getSocket, onSocketChange } from '@/lib/socket';
import { getServerUrl, verifyMoonlightServer, isDesktopApp } from '@/lib/serverConfig';
import { ServerOfflineView } from '@/components/auth/ServerOfflineView';

const AuthContext = createContext(null);
const STORAGE_KEY = 'moonlight:session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverOffline, setServerOffline] = useState(false);

  // Cuando el usuario cambia su estado manualmente, el servidor devuelve
  // un presence:self como eco. Lo ignoramos para no pisar el update optimista.
  const ignoreSelfPresenceRef = useRef(false);

  const verifyServerAndSession = async () => {
    setLoading(true);
    const currentUrl = getServerUrl();

    // La pantalla de verificación de servidor caído se activa EXCLUSIVAMENTE en la aplicación ejecutable .exe (Desktop)
    if (isDesktopApp()) {
      const serverCheck = await verifyMoonlightServer(currentUrl);
      if (!serverCheck.ok) {
        setServerOffline(true);
        setLoading(false);
        return;
      }
    }

    setServerOffline(false);

    // 2. Si el servidor responde, comprobar la sesión guardada
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const res = await fetch(`${currentUrl}/api/users/${parsed.user.id}`, {
        headers: { Authorization: `Bearer ${parsed.token}` },
      });
      if (res.ok) {
        const freshUser = await res.json();
        const next = { ...parsed, user: { ...parsed.user, ...freshUser } };
        setSession(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        connectSocket(parsed.token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyServerAndSession();
  }, []);

  // Sincronizar la sesión en tiempo real entre diferentes pestañas del mismo navegador
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === STORAGE_KEY) {
        if (!e.newValue) {
          // Sesión cerrada en otra pestaña
          setSession(null);
          disconnectSocket();
        } else {
          try {
            // Sesión cambiada/iniciada en otra pestaña
            const parsed = JSON.parse(e.newValue);
            setSession(parsed);
            connectSocket(parsed.token);
          } catch {
            setSession(null);
            disconnectSocket();
          }
        }
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Sincronizar SOLO el estado del propio usuario (presence:self y profile:updated).
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    function patchUser(fields) {
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, user: { ...prev.user, ...fields } };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }

    function onPresenceSelf({ status }) {
      if (ignoreSelfPresenceRef.current) {
        ignoreSelfPresenceRef.current = false;
        return;
      }
      patchUser({ status });
    }

    function onProfileUpdated(profile) {
      if (profile.id === userId) patchUser(profile);
    }

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('presence:self', onPresenceSelf);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('presence:self', onPresenceSelf);
      socket.on('profile:updated', onProfileUpdated);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('presence:self', onPresenceSelf);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
    };
  }, [session?.user?.id]);

  function persist(nextSession) {
    setSession(nextSession);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    connectSocket(nextSession.token);
  }

  async function login(email, password) {
    const result = await api.login({ email, password });
    persist(result);
    return result;
  }

  async function register(username, email, password) {
    const result = await api.register({ username, email, password });
    persist(result);
    return result;
  }

  function logout() {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem('moonlight:lastServerId');
    window.localStorage.removeItem('moonlight:lastChannelId');
    disconnectSocket();
  }

  async function updateProfile(data) {
    const updatedUser = await api.updateProfile(data, session.token);
    const nextSession = { ...session, user: updatedUser };
    setSession(nextSession);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    return updatedUser;
  }

  async function uploadAvatar(file) {
    const { avatarUrl } = await api.uploadAvatar(file, session.token);
    setSession((prev) => {
      const next = { ...prev, user: { ...prev.user, avatarUrl } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return avatarUrl;
  }
 
  async function uploadBanner(file) {
    const { bannerUrl } = await api.uploadBanner(file, session.token);
    setSession((prev) => {
      const next = { ...prev, user: { ...prev.user, bannerUrl } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return bannerUrl;
  }
 
  function setStatus(status) {
    ignoreSelfPresenceRef.current = true;
 
    // Actualización optimista inmediata
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, status } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
 
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      if (!socket) {
        ignoreSelfPresenceRef.current = false;
        return reject(new Error('Sin conexión'));
      }
      socket.emit('status:set', { status }, (response) => {
        if (response?.ok) {
          resolve();
        } else {
          ignoreSelfPresenceRef.current = false;
          reject(new Error(response?.error || 'Error al cambiar el estado'));
        }
      });
    });
  }
 
  if (serverOffline) {
    return <ServerOfflineView onReconnected={() => verifyServerAndSession()} />;
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout, updateProfile, setStatus, uploadAvatar, uploadBanner, verifyServerAndSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
