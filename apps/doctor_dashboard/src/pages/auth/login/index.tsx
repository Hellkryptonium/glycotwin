import { ArrowRight, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { normalizeApiError } from '../../../services/api';
import { useLogin } from '../../../queries/auth.queries';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const mutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const { user } = await mutation.mutateAsync({ email, password }); await router.push(user.role === 'patient' ? '/patient-app' : '/dashboard'); } catch { /* mutation state renders the message */ } };
  const error = mutation.error ? normalizeApiError(mutation.error).message : null;
  return <main className={styles.page}><div className={styles.rail}><Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link><div className={styles.railCopy}><p>Doctor workspace</p><h1>Make room for the important conversation.</h1><span>Secure access to your patient connections.</span></div><div className={styles.railFooter}>Feed / new design system</div></div><section className={styles.formSide}><div className={styles.formWrap}><div className={styles.icon}><LockKeyhole size={21} /></div><p className={styles.eyebrow}>Welcome back</p><h2>Sign in to your workspace</h2><p className={styles.muted}>Use your GlycoTwin clinician account to continue.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>{error && <p className={styles.error} role="alert">{error}</p>}<Button type="submit" disabled={mutation.isPending} icon={<ArrowRight size={17} />}>{mutation.isPending ? 'Signing in…' : 'Sign in'}</Button></form><p className={styles.switch}>New to GlycoTwin? <Link href="/auth/register">Create an account</Link></p></div></section></main>;
}