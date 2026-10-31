import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import styles from './home.module.css';

export default function HomePage() {
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.brand}><span>G</span> GlycoTwin</div><Link href="/auth/login">Sign in <ArrowRight size={16} /></Link></header>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>Doctor workspace / 01</p><h1>A clearer view of the people in your care.</h1><p className={styles.lede}>A calm, focused workspace for building trusted patient connections and keeping the next conversation close at hand.</p><div className={styles.actions}><Link className={styles.primary} href="/auth/login">Enter workspace <ArrowRight size={17} /></Link><Link className={styles.secondary} href="/auth/register">Create account</Link></div></div>
      <div className={styles.heroNote}><div className={styles.noteNumber}>01</div><p>Connection before complexity.</p><span>Start with the human context. Clinical data belongs in its proper place, when it is ready.</span></div>
    </section>
    <footer className={styles.footer}><span>GlycoTwin / Doctor dashboard</span><span>Built for thoughtful care teams</span></footer>
  </main>;
}