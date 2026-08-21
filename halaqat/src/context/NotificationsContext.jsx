import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as notificationService from '../services/notificationService.js';
import { useAuth } from './AuthContext.jsx';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { role } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!role) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await notificationService.list(role);
      setItems(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    await notificationService.markRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    if (role) await notificationService.markAllRead(role);
  }, [role]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, error, reload: load, markRead, markAllRead }),
    [items, unreadCount, loading, error, load, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications يجب استخدامه داخل NotificationsProvider');
  return ctx;
}
