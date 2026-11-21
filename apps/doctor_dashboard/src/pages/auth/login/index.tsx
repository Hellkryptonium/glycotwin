import { ArrowRight, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { normalizeApiError } from '../../../services/api';
import { useBrowserSession, useLogin, useMe } from '../../../queries/auth.queries';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const status = useBrowserSession();
  const me = useMe();
  const mutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || me.data?.role !== 'doctor') return;
    void router.replace(me.data.doctorProfile?.fullName ? '/dashboard' : '/settings?setup=1');
  }, [status, me.data, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const user = await mutation.mutateAsync({ email, password });
      if (user.role === 'patient') await router.replace('/#patients');
    } catch { /* The form displays the request error. */ }
  };

  return <main className={styles.page}>
    <div className={styles.rail}>
      <Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link>
      <div className={styles.railCopy}>
        <p>Doctor workspace</p><h1>Pick up where you left off.</h1><span>Review your connected patients and prepare for their next visit.</span>
      </div>
    </div>
    <section className={styles.formSide}>
      <div className={styles.formWrap}>
        <div className={styles.icon}><LockKeyhole size={21} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Account access</p>
        <h2>Sign in to your workspace</h2>
        <p className={styles.muted}>{router.query.passwordChanged === '1' ? 'Your password changed. Sign in with your new password.' : 'Use the email and password for your clinician account.'}</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
          {mutation.error && <p className={styles.error} role="alert">{normalizeApiError(mutation.error).message}</p>}
          <Button type="submit" disabled={mutation.isPending || status === 'restoring'} icon={<ArrowRight size={17} aria-hidden="true" />}>
            {mutation.isPending ? 'Signing in…' : status === 'restoring' ? 'Checking session…' : 'Sign in'}
          </Button>
        </form>
        <p className={styles.switch}>New to GlycoTwin? <Link href="/auth/register">Create an account</Link></p>
      </div>
    </section>
  </main>;
}
