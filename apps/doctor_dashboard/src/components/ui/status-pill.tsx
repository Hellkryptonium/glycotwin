import styles from './status-pill.module.css';

export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <span className={`${styles.pill} ${styles[tone]}`}><span className={styles.dot} aria-hidden="true" />{children}</span>;
}