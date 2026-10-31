import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppShell } from '../../../components/layout/app-shell';
import styles from './patient-detail.module.css';
import { StateMessage } from '../../../components/feedback/state-message';
import { normalizeApiError } from '../../../services/api';
import { usePatientGlucoseReadings, usePatientProfile } from '../../../queries/patients.queries';
import { useState } from 'react';

export default function PatientDetailPage() {
  const router = useRouter();
  const patientId = typeof router.query.patientId === 'string' ? router.query.patientId : '';
  const profile = usePatientProfile(patientId);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [context, setContext] = useState('');
  const glucose = usePatientGlucoseReadings(patientId, { page, limit: 10, ...(from && { from: `${from}T00:00:00.000Z` }), ...(to && { to: `${to}T23:59:59.999Z` }), ...(context && { context }) });
  const patient = profile.data;
  return <AppShell><section className={styles.page}>
    <Link href="/patients" className={styles.back}><ArrowLeft size={17} />Back to patients</Link>
    <p className={styles.eyebrow}>Patient detail / 04</p><h2>Patient profile</h2>
    {!patientId || profile.isLoading ? <StateMessage kind="loading">Loading patient profile</StateMessage> :
      profile.error ? <div className={styles.notice}><span className={styles.noticeMark}>!</span><p>{normalizeApiError(profile.error).message}</p></div> :
      patient ? <><div className={styles.card}>
        <div className={styles.grid}>
          <div><span className={styles.label}>Full name</span><strong>{patient.profile.fullName || 'Profile in progress'}</strong></div>
          <div><span className={styles.label}>Email</span><strong>{patient.email}</strong></div>
          <div><span className={styles.label}>Date of birth</span><strong>{patient.profile.dateOfBirth ? new Date(patient.profile.dateOfBirth).toLocaleDateString() : 'Not provided'}</strong></div>
          <div><span className={styles.label}>Gender</span><strong>{patient.profile.gender || 'Not provided'}</strong></div>
          <div><span className={styles.label}>Diabetes type</span><strong>{patient.profile.diabetesType || 'Not provided'}</strong></div>
        </div>
        <div className={styles.notice}><span className={styles.noticeMark}>i</span><p>Patient profile information is read-only and available through the active care relationship.</p></div>
      </div><div className={styles.records}>
        <div className={styles.recordsHead}><div><span className={styles.label}>Health records</span><h3>Blood glucose</h3></div><div className={styles.filters}>
          <label>From<input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} /></label>
          <label>To<input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} /></label>
          <label>Context<select value={context} onChange={(event) => { setPage(1); setContext(event.target.value); }}><option value="">All</option><option value="FASTING">Fasting</option><option value="BEFORE_MEAL">Before meal</option><option value="AFTER_MEAL">After meal</option><option value="RANDOM">Random</option></select></label>
        </div></div>
        {glucose.isLoading ? <StateMessage kind="loading">Loading readings</StateMessage> :
          glucose.error ? <StateMessage kind="error">{normalizeApiError(glucose.error).message}</StateMessage> :
          glucose.data?.items.length ? <div className={styles.readings}>{glucose.data.items.map((reading) => <div className={styles.reading} key={reading.id}><strong>{reading.value} {reading.unit}</strong><span>{reading.context.replace('_', ' ')}</span><small>{new Date(reading.measuredAt).toLocaleString()} · {reading.source}</small>{reading.notes && <p>{reading.notes}</p>}</div>)}</div> :
          <StateMessage kind="empty">No readings match these filters.</StateMessage>}
        <div className={styles.pagination}><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button disabled={!glucose.data || glucose.data.items.length < 10} onClick={() => setPage((current) => current + 1)}>Next</button></div>
      </div></> : <StateMessage kind="empty">Patient profile is unavailable.</StateMessage>}
  </section></AppShell>;
}