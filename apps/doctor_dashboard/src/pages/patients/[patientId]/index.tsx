import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppShell } from '../../../components/layout/app-shell';
import styles from './patient-detail.module.css';

export default function PatientDetailPage() {
  const router = useRouter(); const patientId = typeof router.query.patientId === 'string' ? router.query.patientId : 'Loading…';
  return <AppShell><section className={styles.page}><Link href="/patients" className={styles.back}><ArrowLeft size={17} />Back to patients</Link><p className={styles.eyebrow}>Patient detail / 04</p><h2>Patient connection</h2><div className={styles.card}><div><span className={styles.label}>Connected patient ID</span><strong>{patientId}</strong></div><div className={styles.notice}><span className={styles.noticeMark}>i</span><p>This detail route is ready for patient-specific modules. No health information is shown here until an approved data contract is connected.</p></div></div></section></AppShell>;
}