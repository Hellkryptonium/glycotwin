import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { subscribeToSessionChanges } from '../services/api';
import { useAuthStore } from '../stores/auth.store';

export function QueryProvider({ children }: PropsWithChildren) {
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  }));

  useEffect(() => subscribeToSessionChanges(() => {
    useAuthStore.getState().resetForRestore();
    queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    if (!sessionExpiresAt) return;
    const deadline = Date.parse(sessionExpiresAt);
    if (!Number.isFinite(deadline)) return;
    const checkExpiry = () => {
      if (Date.now() < deadline || useAuthStore.getState().sessionExpiresAt !== sessionExpiresAt) return;
      useAuthStore.getState().clear();
      queryClient.clear();
    };
    const timer = window.setTimeout(checkExpiry, Math.max(0, deadline - Date.now()));
    window.addEventListener('focus', checkExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [queryClient, sessionExpiresAt]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
