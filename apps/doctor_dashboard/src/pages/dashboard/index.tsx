import { ArrowUpRight, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '../../components/layout/app-shell';
import { StateMessage } from '../../components/feedback/state-message';
import { StatusPill } from '../../components/ui/status-pill';
import { useMe } from '../../queries/auth.queries';
import { useConnectedPatients } from '../../queries/patients.queries';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const me = useMe();
  const patients = useConnectedPatients(1, 5);
  return <AppShell><section className={styles.page}>
    <div className={styles.intro}><div><p className={styles.eyebrow}>Overview</p><h2>Welcome back.</h2></div><StatusPill tone={me.data?.doctorProfile?.verificationStatus === 'verified' ? 'success' : 'warning'}>{me.data?.doctorProfile?.verificationStatus ?? 'Account status'}</StatusPill></div>
    <div className={styles.grid}><article className={styles.welcome}><span className={styles.number}>01</span><h3>Add a patient to your care circle.</h3><Link href="/patients#patient-search" className={styles.link}><UserRoundPlus size={17} /> Add patient</Link></article><article className={styles.snapshot}><div className={styles.cardHead}><span className={styles.label}>Connected patients</span><Link href="/patients">View all <ArrowUpRight size={15} /></Link></div>{patients.isPending ? <StateMessage kind="loading">Loading patients</StateMessage> : patients.error ? <StateMessage kind="error">We couldn&apos;t load your patients.</StateMessage> : patients.data?.items.length ? <div className={styles.patientList}>{patients.data.items.slice(0, 3).map((patient) => <Link href={`/patients/${patient.patientId}`} className={styles.patientRow} key={patient.relationshipId}><span className={styles.patientAvatar}>{(patient.fullName ?? 'P').slice(0, 1)}</span><span><strong>{patient.fullName ?? 'Profile in progress'}</strong><small>Connected {new Date(patient.connectedAt).toLocaleDateString()}</small></span><ArrowUpRight size={16} /></Link>)}</div> : <StateMessage kind="empty">Your patient list is empty.</StateMessage>}</article></div>
  </section></AppShell>;
}
