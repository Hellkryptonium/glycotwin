import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { normalizeApiError } from '../../../services/api';
import { useRegisterDoctor } from '../../../queries/auth.queries';
import styles from './register.module.css';

export default function RegisterPage() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const mutation = useRegisterDoctor();
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ email, password }); await router.push('/auth/login'); } catch { /* mutation state renders the message */ } };
  const error = mutation.error ? normalizeApiError(mutation.error).message : null;
  return <main className={styles.page}><div className={styles.header}><Link href="/" className={styles.brand}><span>G</span> GlycoTwin</Link><Link href="/auth/login" className={styles.signIn}>Already registered? Sign in</Link></div><section className={styles.content}><div className={styles.intro}><p className={styles.eyebrow}>Doctor workspace</p><h1>Make a place for better care.</h1><p>Create your clinician account with the essentials. Patient details are completed through the care workflow.</p></div><form className={styles.card} onSubmit={submit}><div className={styles.roleNote}>A clinician workspace for verified patient connections.</div><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" /><small>At least 12 characters with upper, lower, and numeric characters.</small></label>{error && <p className={styles.error} role="alert">{error}</p>}<Button type="submit" disabled={mutation.isPending} icon={<ArrowRight size={17} />}>{mutation.isPending ? 'Creating…' : 'Create doctor account'}</Button></form></section></main>;
}