import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, login, logout, registerDoctor } from '../services/auth.api';
import { useAuthStore } from '../stores/auth.store';
import { queryKeys } from './keys';

export function useMe() {
  const token = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => { const user = await getMe(); setUser(user); return user; },
    enabled: Boolean(token),
    retry: false,
  });
}

export function useLogin() {
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const tokens = await login(input);
      setTokens(tokens);
      try {
        const user = await getMe();
        setUser(user);
        return { tokens, user };
      } catch (error) {
        clear();
        throw error;
      }
    },
    onSuccess: ({ user }) => { queryClient.setQueryData(queryKeys.me, user); },
  });
}

export function useRegisterDoctor() { return useMutation({ mutationFn: registerDoctor }); }
export function useLogout() {
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => refreshToken ? logout(refreshToken) : undefined,
    onSettled: () => { clear(); queryClient.clear(); },
  });
}