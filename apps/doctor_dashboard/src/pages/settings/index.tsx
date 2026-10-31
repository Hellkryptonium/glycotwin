import { LogOut } from 'lucide-react';
import { AppShell } from '../../components/layout/app-shell';
import { Button } from '../../components/ui/button';
import { useLogout, useMe } from '../../queries/auth.queries';
import { useAuthStore } from '../../stores/auth.store';
import { useRouter } from 'next/router';
import styles from './settings.module.css';

export default function SettingsPage() {
  const { data: user } = useMe(); const accessToken = useAuthStore((state) => state.accessToken); const logout = useLogout(); const router = useRouter();
  return <AppShell><section className={styles.page}><p className={styles.eyebrow}>Account</p><h2>Settings</h2><section className={styles.card}><span className={styles.label}>Doctor account</span><h3>{user?.email ?? 'Signed-in email unavailable.'}</h3><p>{user?.role === 'doctor' ? 'Doctor account' : user?.role ?? 'Account type unavailable'}</p><Button variant="quiet" disabled={!accessToken || logout.isPending} onClick={async () => { await logout.mutateAsync(); await router.push('/auth/login'); }} icon={<LogOut size={16} />}>Sign out</Button></section></section></AppShell>;
}