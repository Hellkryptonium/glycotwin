import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useLogout, useMe } from '../../queries/auth.queries';
import { normalizeApiError } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useUiStore } from '../../stores/ui.store';
import { StateMessage } from '../feedback/state-message';
import styles from './app-shell.module.css';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const logout = useLogout();
  const me = useMe();

  useEffect(() => {
    if (!accessToken) void router.replace('/auth/login');
    else if (me.data?.role === 'patient') void router.replace('/patient-app');
  }, [accessToken, me.data?.role, router]);

  if (me.error) return <div className={styles.authState}><StateMessage kind="error">{normalizeApiError(me.error).message}</StateMessage></div>;
  if (!accessToken || me.isLoading || !me.data) return <div className={styles.authState}><StateMessage kind="loading">Checking your account</StateMessage></div>;
  if (me.data.role !== 'doctor') return <div className={styles.authState}><StateMessage kind="error">This workspace is for doctor accounts.</StateMessage></div>;

  const displayName = user?.doctorProfile?.fullName || user?.email?.split('@')[0] || 'Clinician';

  return <div className={styles.shell}>
    <button className={styles.mobileMenu} onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}>{sidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
      <div className={styles.brand}><span className={styles.brandMark}>G</span><span>GlycoTwin</span></div>
      <div className={styles.kicker}>Doctor workspace</div>
      <nav className={styles.nav} aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link className={`${styles.navLink} ${router.pathname === href || router.pathname.startsWith(`${href}/`) ? styles.active : ''}`} href={href} key={href} onClick={() => setSidebarOpen(false)}><Icon size={18} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.sidebarNote}><span className={styles.noteBar} />A calm place to see what needs your attention.</div>
      <button className={styles.logout} onClick={() => { logout.mutate(); void router.push('/auth/login'); }}><LogOut size={17} />Sign out</button>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><div><span className={styles.eyebrow}>Monday, 31 October 2026</span><h1>{displayName}</h1></div><div className={styles.profile}><span className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</span><span className={styles.profileText}><strong>{displayName}</strong><small>Doctor account</small></span><ChevronDown size={16} /></div></header>
      <div className={styles.content}>{children}</div>
    </main>
  </div>;
}