import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppShell } from '../../../components/layout/app-shell';
import styles from './patient-detail.module.css';
import { StateMessage } from '../../../components/feedback/state-message';
import { normalizeApiError } from '../../../services/api';
import { usePatientGlucoseReadings, usePatientLifestyle, usePatientProfile } from '../../../queries/patients.queries';
import { usePatientGlucoseAnalytics } from '../../../queries/patients.queries';
import type { AnalyticsRange } from '../../../types/api';
import { useState } from 'react';

function TrendChart({ readings }: { readings: Array<{ value: string; measuredAt: string; unit: string }> }) {
  if (!readings.length) return <StateMessage kind="empty">No readings in this range.</StateMessage>;
  const values = readings.map((reading) => Number(reading.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 720;
  const height = 220;
  const y = (value: number) => height - 20 - ((value - min) / Math.max(max - min, 1)) * (height - 40);
  const points = readings.map((reading, index) => `${(index / Math.max(readings.length - 1, 1)) * (width - 20) + 10},${y(Number(reading.value))}`).join(' ');
  return <div className={styles.chartWrap}><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Glucose readings over time" className={styles.chart}>
    <polyline points={points} fill="none" stroke="var(--cobalt)" strokeWidth="3" />
    {readings.map((reading, index) => <circle key={`${reading.measuredAt}-${index}`} cx={(index / Math.max(readings.length - 1, 1)) * (width - 20) + 10} cy={y(Number(reading.value))} r="4" fill="var(--tomato)">
      <title>{`${new Date(reading.measuredAt).toLocaleString()}: ${reading.value} ${reading.unit}`}</title>
    </circle>)}
  </svg><div className={styles.chartAxis}><span>{min}</span><span>{max}</span></div></div>;
}

export default function PatientDetailPage() {
  const router = useRouter();
  const patientId = typeof router.query.patientId === 'string' ? router.query.patientId : '';
  const profile = usePatientProfile(patientId);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [context, setContext] = useState('');
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const glucose = usePatientGlucoseReadings(patientId, { page, limit: 10, ...(from && { from: `${from}T00:00:00.000Z` }), ...(to && { to: `${to}T23:59:59.999Z` }), ...(context && { context }) });
  const analytics = usePatientGlucoseAnalytics(patientId, range);
  const lifestyle = usePatientLifestyle(patientId, {
    page: 1,
    limit: 50,
    ...(from && { from: `${from}T00:00:00.000Z` }),
    ...(to && { to: `${to}T23:59:59.999Z` }),
  });
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
    {patient && <section className={styles.analytics}>
      <div className={styles.recordsHead}><div><span className={styles.label}>Health trends</span><h3>Glucose overview</h3></div><div className={styles.rangeSelector}>{(['7d', '30d', '90d'] as AnalyticsRange[]).map((option) => <button key={option} className={range === option ? styles.activeRange : ''} onClick={() => setRange(option)}>{option}</button>)}</div></div>
      {analytics.isLoading ? <StateMessage kind="loading">Loading trends</StateMessage> :
        analytics.error ? <StateMessage kind="error">{normalizeApiError(analytics.error).message}</StateMessage> :
        analytics.data ? <><div className={styles.stats}>
          {[['Latest', analytics.data.latest ? `${analytics.data.latest.value} ${analytics.data.latest.unit}` : '—'], ['Average', analytics.data.average ? `${analytics.data.average} ${analytics.data.unit ?? ''}` : '—'], ['Highest', analytics.data.maximum ? `${analytics.data.maximum} ${analytics.data.unit ?? ''}` : '—'], ['Lowest', analytics.data.minimum ? `${analytics.data.minimum} ${analytics.data.unit ?? ''}` : '—']].map(([label, value]) => <div className={styles.stat} key={label}><span className={styles.label}>{label}</span><strong>{value}</strong></div>)}
        </div>{analytics.data.byUnit.length > 1 ? <StateMessage kind="empty">Readings use multiple units. The chart is unavailable without converting values.</StateMessage> : <TrendChart readings={analytics.data.readings} />}<p className={styles.readingCount}>{analytics.data.totalReadings} recorded reading{analytics.data.totalReadings === 1 ? '' : 's'} · Calculated averages are descriptive only.</p>
        {analytics.data.daily.length > 0 && <div className={styles.daily}><span className={styles.label}>Daily summary</span>{analytics.data.daily.map((day) => <div key={`${day.date}-${day.unit}`}><span>{day.date}</span><strong>{day.average} {day.unit}</strong><small>{day.readingCount} reading{day.readingCount === 1 ? '' : 's'}</small></div>)}</div>}
        </> : <StateMessage kind="empty">No readings in this range.</StateMessage>}
    </section>}
    {patient && <section className={styles.analytics}>
      <div className={styles.recordsHead}><div><span className={styles.label}>Daily health activity</span><h3>Lifestyle timeline</h3></div></div>
      {lifestyle.isLoading ? <StateMessage kind="loading">Loading lifestyle activity</StateMessage> :
        lifestyle.error ? <StateMessage kind="error">{normalizeApiError(lifestyle.error).message}</StateMessage> :
        lifestyle.data?.items.length ? <div className={styles.daily}>{lifestyle.data.items.map((entry) => <div key={entry.id}><span>{entry.type} · {new Date(entry.occurredAt).toLocaleString()}</span><strong>{entry.description || entry.activityType || entry.mealType || (entry.sleepDurationMinutes ? `${entry.sleepDurationMinutes} minutes` : '')}</strong><small>{entry.durationMinutes ? `${entry.durationMinutes} minutes` : entry.notes || ''}</small></div>)}</div> :
        <StateMessage kind="empty">No lifestyle activity in this date range.</StateMessage>}
    </section>}
  </section></AppShell>;
}