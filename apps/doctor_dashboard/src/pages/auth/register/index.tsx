import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { normalizeApiError } from '../../../services/api';
import { useRegisterDoctor } from '../../../queries/auth.queries';
import styles from './register.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useRegisterDoctor();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ email, password });
      await router.replace('/settings?setup=1');
    } catch { /* The form displays the request error. */ }
  };

  return <main className={styles.page}>
    <div className={styles.header}><Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link><Link href="/auth/login" className={styles.signIn}>Already registered? Sign in</Link></div>
    <section className={styles.content}>
      <div className={styles.intro}><p className={styles.eyebrow}>Doctor workspace</p><h1>Create a clinician account.</h1><p>Set up your profile, then submit your professional details for review.</p></div>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.roleNote}>Clinician verification unlocks patient connections.</div>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" /><small>Use at least 8 characters.</small></label>
        {mutation.error && <p className={styles.error} role="alert">{normalizeApiError(mutation.error).message}</p>}
        <Button type="submit" disabled={mutation.isPending} icon={<ArrowRight size={17} aria-hidden="true" />}>{mutation.isPending ? 'Creating…' : 'Create doctor account'}</Button>
      </form>
    </section>
  </main>;
}
