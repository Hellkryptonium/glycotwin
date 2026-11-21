import { Activity, ArrowDownToLine, ArrowRight, CalendarCheck, HeartHandshake, ShieldCheck, Smartphone, Watch } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './home.module.css';



export default function HomePage() {
  const router = useRouter();

  return <main className={styles.page}>
    <Head><title>GlycoTwin | Diabetes care between visits</title><meta name="description" content="Record day-to-day diabetes care and prepare for visits with a shared health history." /></Head>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span aria-hidden="true">G</span> GlycoTwin</Link>
      <nav className={styles.headerNav} aria-label="Main navigation">
        <a href="#patients">Patients</a>
        <a href="#doctors">Doctors</a>
        <Link href="/auth/login" className={styles.signIn}>Doctor sign in <ArrowRight size={16} aria-hidden="true" /></Link>
      </nav>
    </header>

    {router.query.accountDeleted === '1' && <p className={styles.notice} role="status">Your account was deleted.</p>}

    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <h1 id="hero-title">Diabetes care between visits.</h1>
        <p>Keep glucose readings, meals, medication doses and activity in one place. Choose who can see your record, then use it to prepare for your next care visit.</p>
        <div className={styles.actions}>
          <a className={styles.primary} href="#patients">Explore the Android app <ArrowRight size={18} aria-hidden="true" /></a>
          <Link className={styles.secondary} href="/dashboard">Open doctor workspace</Link>
        </div>
      </div>
      <aside className={styles.preview} aria-label="Examples of records GlycoTwin connects">
        <div className={styles.previewLabel}><Activity size={20} aria-hidden="true" /> Shared health timeline</div>
        <h2>See the day in context.</h2>
        <div className={styles.previewRow}><span className={`${styles.previewIcon} ${styles.glucose}`}><Activity size={19} aria-hidden="true" /></span><div><strong>Measured glucose</strong><small>Reading, source and measurement time</small></div></div>
        <div className={styles.previewRow}><span className={`${styles.previewIcon} ${styles.watch}`}><Watch size={19} aria-hidden="true" /></span><div><strong>Watch activity</strong><small>Workout and device sync status</small></div></div>
        <div className={styles.previewRow}><span className={`${styles.previewIcon} ${styles.visit}`}><CalendarCheck size={19} aria-hidden="true" /></span><div><strong>Next visit</strong><small>Questions and records to share</small></div></div>
      </aside>
    </section>

    <div className={styles.roles}>
      <section id="patients" className={`${styles.roleCard} ${styles.patientCard}`} aria-labelledby="patient-title">
        <Smartphone size={27} aria-hidden="true" />
        <h2 id="patient-title">For patients</h2>
        <p>Use the Android app to log readings and day-to-day details, see measurements from supported devices, and share records with the clinicians you connect.</p>
        <Link className={styles.primary} href="/download"><ArrowDownToLine size={17} aria-hidden="true" />Download Android app</Link>
      </section>
      <section id="doctors" className={`${styles.roleCard} ${styles.doctorCard}`} aria-labelledby="doctor-title">
        <HeartHandshake size={27} aria-hidden="true" />
        <h2 id="doctor-title">For doctors</h2>
        <p>Review measured readings and patient-reported events together. Follow up on goals and prepare for visits using the records a patient has agreed to share.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/auth/register">Create a doctor account <ArrowRight size={17} aria-hidden="true" /></Link>
          <Link className={styles.secondary} href="/auth/login">Sign in</Link>
        </div>
      </section>
    </div>

    <section className={styles.privacy} aria-labelledby="sharing-title">
      <ShieldCheck size={26} aria-hidden="true" />
      <div><h2 id="sharing-title">You decide who has access.</h2><p>Clinicians connect through an invitation. Patients can review their care relationships and withdraw access from the Android app.</p></div>
    </section>

    <footer className={styles.footer}><span>GlycoTwin</span><Link href="/auth/login">Doctor sign in</Link></footer>
  </main>;
}
