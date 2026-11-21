import { ChevronDown, LayoutDashboard, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useBrowserSession, useLogout, useMe } from '../../queries/auth.queries';
import { normalizeApiError, refreshBrowserSession } from '../../services/api';
import { useUiStore } from '../../stores/ui.store';
import { StateMessage } from '../feedback/state-message';
import { Button } from '../ui/button';
import styles from './app-shell.module.css';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/settings', label: 'Profile & settings', icon: Settings },
];

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const session = useBrowserSession();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const logout = useLogout();
  const me = useMe();

  useEffect(() => {
    if (session === 'signedOut') void router.replace('/auth/login');
    else if (me.data?.role === 'patient') void router.replace('/#patients');
  }, [session, me.data?.role, router]);

  if (session === 'unavailable') {
    return <div className={styles.authState}><StateMessage kind="error">
      Your connection is unavailable. <Button variant="quiet" type="button" onClick={() => { void refreshBrowserSession().catch(() => undefined); }}>Retry</Button>
    </StateMessage></div>;
  }
  if (session !== 'authenticated' || me.isLoading) {
    return <div className={styles.authState}><StateMessage kind="loading">Checking your account</StateMessage></div>;
  }
  if (me.error) {
    return <div className={styles.authState}><StateMessage kind="error">
      {normalizeApiError(me.error).message} <Button variant="quiet" type="button" onClick={() => { void me.refetch(); }}>Retry</Button>
    </StateMessage></div>;
  }
  if (me.data?.role !== 'doctor') {
    return <div className={styles.authState}><StateMessage kind="error">This workspace is for doctor accounts.</StateMessage></div>;
  }

  const displayName = me.data.doctorProfile?.fullName || me.data.email.split('@')[0] || 'Clinician';

  return <div className={styles.shell}>
    <button className={styles.mobileMenu} type="button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen}>{sidebarOpen ? <X size={20} /> : <Menu size={20} />}</button>
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ''}`}>
      <div className={styles.brand}><span className={styles.brandMark}>G</span><span>GlycoTwin</span></div>
      <div className={styles.kicker}>Doctor workspace</div>
      <nav className={styles.nav} aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href || router.pathname.startsWith(`${href}/`);
          return <Link className={`${styles.navLink} ${active ? styles.active : ''}`} href={href} key={href} aria-current={active ? 'page' : undefined} onClick={() => setSidebarOpen(false)}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>
      <div className={styles.sidebarBottom}>
        {logout.error && <p className={styles.logoutError} role="alert">{normalizeApiError(logout.error).message}</p>}
        <button className={styles.logout} type="button" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} aria-hidden="true" />{logout.isPending ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </aside>
    <main className={styles.main}>
      <header className={styles.topbar}><div><span className={styles.eyebrow}>Doctor workspace</span><h1>{displayName}</h1></div><Link className={styles.profile} href="/settings" aria-label="Open profile and settings"><span className={styles.avatar}>{displayName.slice(0, 1).toUpperCase()}</span><span className={styles.profileText}><strong>{displayName}</strong><small>Doctor account</small></span><ChevronDown size={16} aria-hidden="true" /></Link></header>
      <div className={styles.content}>{children}</div>
    </main>
  </div>;
}
