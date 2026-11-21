import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, login, logout, registerDoctor } from '../services/auth.api';
import { notifySessionChanged, refreshBrowserSession } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from './keys';

export function useBrowserSession() {
  const status = useAuthStore((state) => state.status);
  useEffect(() => {
    if (status === 'restoring') void refreshBrowserSession().catch(() => undefined);
  }, [status]);
  return status;
}

export function useMe() {
  const token = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const user = await getMe();
      if (useAuthStore.getState().status === 'authenticated') setUser(user);
      return user;
    },
    enabled: Boolean(token),
    retry: false,
  });
}

function useStartSession(start: typeof login) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const session = await start(input);
      const store = useAuthStore.getState();
      queryClient.clear();
      store.setSession(session);
      const user = session.user ?? await getMe();
      store.setUser(user);
      queryClient.setQueryData(queryKeys.me, user);
      notifySessionChanged();
      return user;
    },
  });
}

export function useLogin() {
  return useStartSession(login);
}

export function useRegisterDoctor() {
  return useStartSession(registerDoctor);
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return () => {
    useAuthStore.getState().clear();
    queryClient.clear();
    notifySessionChanged();
  };
}

export function useLogout() {
  const endSession = useEndSession();
  return useMutation({ mutationFn: logout, onSuccess: endSession });
}
