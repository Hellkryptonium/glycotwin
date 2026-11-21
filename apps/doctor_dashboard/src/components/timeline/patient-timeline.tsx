import { useEffect, useState } from 'react';
import { StateMessage } from '../feedback/state-message';
import { usePatientTimeline } from '../../queries/patients.queries';
import { normalizeApiError } from '../../services/api';
import type { TimelineEntry, TimelineKind, TimelineSource } from '../../types/api';
import styles from './patient-timeline.module.css';

export const sourceLabels: Record<TimelineSource, string> = {
  MANUAL: 'Manual',
  CGM: 'CGM',
  HEALTH_CONNECT: 'Health Connect',
  WATCH: 'Wear OS',
  REPLAY: 'Replay (demo)',
};

const kindLabels: Record<TimelineKind, string> = {
  glucose: 'Glucose',
  meal: 'Meal',
  activity: 'Activity',
  sleep: 'Sleep',
  symptom: 'Symptom',
  medication: 'Medication taken',
  steps: 'Steps',
  workout: 'Workout',
  heart_rate: 'Heart rate',
};

const gapMinutes = 15;

function localDayBoundary(value: string, endOfDay: boolean) {
  const offset = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${value}T${offset}`).toISOString();
}

function readingGaps(entries: TimelineEntry[]) {
  const previous = new Map<string, number>();
  const gaps = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== 'glucose' || (entry.source !== 'CGM' && entry.source !== 'REPLAY')) continue;
    const timestamp = Date.parse(entry.occurredAt);
    const stream = JSON.stringify([entry.source, entry.deviceOrigin ?? null, entry.glucose?.unit ?? null]);
    const newer = previous.get(stream);
    if (newer !== undefined) {
      const minutes = (newer - timestamp) / 60_000;
      if (minutes > gapMinutes) gaps.set(entry.id, Math.ceil(minutes));
    }
    previous.set(stream, timestamp);
  }
  return gaps;
}

function VisitSummary({ entries }: { entries: TimelineEntry[] }) {
  const measured = entries.filter((entry) => entry.source !== 'REPLAY');
  const glucose = measured.find((entry) => entry.kind === 'glucose' && entry.glucose);
  const meal = measured.find((entry) => entry.kind === 'meal');
  const medication = measured.find((entry) => entry.kind === 'medication');
  return <div className={styles.summary}>
    <h4>Visit summary</h4>
    <p>{measured.length ? 'Latest patient records on this page.' : 'This page contains replay demo data.'}</p>
    {measured.length > 0 && <dl>
      <div>
        <dt>Glucose</dt>
        <dd>{glucose?.glucose ? `${glucose.glucose.value} ${glucose.glucose.unit}` : '—'}</dd>
        {glucose && <dd className={styles.muted}>{sourceLabels[glucose.source]} · {new Date(glucose.occurredAt).toLocaleString()}</dd>}
      </div>
      <div>
        <dt>Meal</dt>
        <dd>{meal?.title ?? '—'}</dd>
        {meal && <dd className={styles.muted}>{new Date(meal.occurredAt).toLocaleString()}</dd>}
      </div>
      <div>
        <dt>Medication taken</dt>
        <dd>{medication?.title ?? '—'}</dd>
        {medication && <dd className={styles.muted}>{new Date(medication.occurredAt).toLocaleString()}</dd>}
      </div>
    </dl>}
  </div>;
}

function TimelineRow({ entry, gap }: { entry: TimelineEntry; gap: number | undefined }) {
  return <li className={styles.row} id={`timeline-${entry.kind}-${entry.id}`} tabIndex={-1}>
    {gap !== undefined && <p className={styles.gap}>{sourceLabels[entry.source]} glucose gap of {gap} minutes between this and the next newer reading on this page.</p>}
    <div className={styles.rowHead}>
      <div>
        <p className={styles.kind}>{kindLabels[entry.kind]}</p>
        <strong>{entry.glucose ? `${entry.glucose.value} ${entry.glucose.unit}` : entry.title}</strong>
      </div>
      <span className={entry.source === 'REPLAY' ? styles.replaySource : styles.source}>{sourceLabels[entry.source]}</span>
    </div>
    {entry.detail && <p>{entry.detail}</p>}
    {entry.deviceOrigin && <p className={styles.muted}>Origin {entry.deviceOrigin}</p>}
    <dl className={styles.timestamps}>
      <div><dt>{entry.kind === 'glucose' ? 'Measured' : 'Occurred'}</dt><dd><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></dd></div>
      <div><dt>Received</dt><dd><time dateTime={entry.receivedAt}>{new Date(entry.receivedAt).toLocaleString()}</time></dd></div>
    </dl>
  </li>;
}

export function PatientTimeline({ patientId, focusEvent, clearFocus }: {
  patientId: string;
  focusEvent?: TimelineEntry;
  clearFocus: () => void;
}) {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [source, setSource] = useState<TimelineSource | ''>('');
  const rangeIsValid = !from || !to || from <= to;
  const eventTime = focusEvent ? Date.parse(focusEvent.occurredAt) : NaN;
  const eventFilters = focusEvent && Number.isFinite(eventTime) ? {
    page: 1,
    limit: 100,
    from: new Date(eventTime - 1).toISOString(),
    to: new Date(eventTime + 1).toISOString(),
    source: focusEvent.source,
  } : undefined;
  const timeline = usePatientTimeline(patientId, eventFilters ?? {
    page,
    limit: 20,
    ...(from && { from: localDayBoundary(from, false) }),
    ...(to && { to: localDayBoundary(to, true) }),
    ...(source && { source }),
  }, rangeIsValid || Boolean(eventFilters));
  const events = timeline.data?.items;
  const focused = focusEvent && events?.find((entry) => entry.id === focusEvent.id && entry.kind === focusEvent.kind);
  const entries = focusEvent ? (focused ? [focused] : []) : events ?? [];
  const error = timeline.error ? normalizeApiError(timeline.error) : null;
  const gaps = readingGaps(entries);

  useEffect(() => {
    if (focused && !error) document.getElementById(`timeline-${focused.kind}-${focused.id}`)?.focus();
  }, [focused, error]);

  return <section className={styles.timeline} aria-labelledby="patient-timeline-title">
    <header className={styles.header}>
      <div>
        <h3 id="patient-timeline-title">Health timeline</h3>
        <p>Glucose, meals, medication, and activity in time order.</p>
      </div>
      {focusEvent ? <div className={styles.pagination}><button type="button" onClick={clearFocus}>Return to full timeline</button></div> : <fieldset className={styles.filters}>
        <legend className={styles.srOnly}>Timeline filters</legend>
        <label>From<input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} /></label>
        <label>To<input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} /></label>
        <label>Source<select value={source} onChange={(event) => { setPage(1); setSource(event.target.value as TimelineSource | ''); }}>
          <option value="">All sources</option>
          {Object.entries(sourceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
      </fieldset>}
    </header>
    {!rangeIsValid && !focusEvent ? <StateMessage kind="error">Choose an end date on or after the start date.</StateMessage> :
      error ? <StateMessage kind="error">{error.status === 403 ? 'This timeline requires an active care relationship.' : error.message}</StateMessage> :
      timeline.isPending ? <div role="status"><StateMessage kind="loading">Loading the health timeline</StateMessage></div> :
      entries.length ? <>
        {!focusEvent && <VisitSummary entries={entries} />}
        <ol className={styles.entries} aria-label="Health events, newest first">
          {entries.map((entry) => <TimelineRow key={`${entry.kind}:${entry.id}`} entry={entry} gap={gaps.get(entry.id)} />)}
        </ol>
      </> : <StateMessage kind="empty">{focusEvent ? 'The linked record is unavailable in the current timeline.' : 'No health events match these filters.'}</StateMessage>}
    {!focusEvent && rangeIsValid && !error && (page > 1 || timeline.data?.hasMore) && <nav className={styles.pagination} aria-label="Timeline pages">
      <button type="button" disabled={page === 1 || timeline.isFetching} onClick={() => setPage((current) => current - 1)}>Previous</button>
      <span aria-live="polite">Page {timeline.data?.page ?? page}</span>
      <button type="button" disabled={!timeline.data?.hasMore || timeline.isFetching} onClick={() => setPage((current) => current + 1)}>Next</button>
    </nav>}
  </section>;
}
