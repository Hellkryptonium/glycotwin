import { AlertCircle, LoaderCircle } from 'lucide-react';
import styles from './state-message.module.css';

export function StateMessage({ kind, children }: { kind: 'loading' | 'error' | 'empty'; children: React.ReactNode }) {
  return <div className={`${styles.message} ${styles[kind]}`} role={kind === 'error' ? 'alert' : undefined}>
    {kind === 'loading' ? <LoaderCircle className={styles.spin} size={18} aria-hidden="true" /> : kind === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : null}
    <span>{children}</span>
  </div>;
}