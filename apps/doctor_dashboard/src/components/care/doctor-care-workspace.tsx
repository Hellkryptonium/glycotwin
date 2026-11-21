import { CalendarClock, FilePenLine, Target } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useDoctorCare, useSaveCareItem } from '../../queries/patients.queries';
import { normalizeApiError } from '../../services/api';
import type { CareItem, CareItemInput, CareItemKind, SharedVisitBrief, TimelineEntry } from '../../types/api';
import { StateMessage } from '../feedback/state-message';
import { Button } from '../ui/button';
import { sourceLabels } from '../timeline/patient-timeline';
import styles from './doctor-care-workspace.module.css';

const kinds = {
  NOTE: { label: 'Clinician note', plural: 'Clinician notes', icon: FilePenLine, description: 'Notes are visible to you.' },
  GOAL: { label: 'Shared goal', plural: 'Shared goals', icon: Target, description: 'Goals appear in the patient’s care view.' },
  FOLLOW_UP: { label: 'Follow-up task', plural: 'Follow-up tasks', icon: CalendarClock, description: 'Follow-up tasks appear in the patient’s care view.' },
} satisfies Record<CareItemKind, { label: string; plural: string; icon: typeof FilePenLine; description: string }>;

const emptyDraft: CareItemInput = { kind: 'NOTE', title: '', detail: '', dueDate: null, status: 'OPEN' };

interface Draft {
  itemId?: string;
  input: CareItemInput;
}

export function DoctorCareWorkspace({ patientId, onViewEvent }: { patientId: string; onViewEvent: (event: TimelineEntry) => void }) {
  const care = useDoctorCare(patientId);
  const save = useSaveCareItem(patientId);
  const [draft, setDraft] = useState<Draft>();
  const [notice, setNotice] = useState('');

  function startEdit(item?: CareItem) {
    save.reset();
    setNotice('');
    if (!item) {
      setDraft({ input: emptyDraft });
      return;
    }
    const { id, kind, title, detail, dueDate, status } = item;
    setDraft({ itemId: id, input: { kind, title, detail, dueDate, status } });
  }

  function updateInput(change: Partial<CareItemInput>) {
    setDraft((previous) => previous && { ...previous, input: { ...previous.input, ...change } });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const { itemId, input } = draft;
    const title = input.title.trim();
    if (!title) return;
    save.mutate({ itemId, input: {
      ...input,
      title,
      detail: input.detail?.trim() || null,
      dueDate: input.kind === 'NOTE' ? null : input.dueDate,
      status: input.kind === 'NOTE' ? 'OPEN' : input.status,
    } }, { onSuccess: () => { setNotice(itemId ? 'Changes saved.' : `${kinds[input.kind].label} added.`); setDraft(undefined); } });
  }

  return <section className={styles.workspace} aria-labelledby="care-workspace-title">
    <header className={styles.header}>
      <div><h3 id="care-workspace-title">Care workspace</h3><p>Manage visit notes, shared goals, and follow-ups.</p></div>
      {care.data && !care.error && !draft && <Button type="button" onClick={() => startEdit()}>Add care item</Button>}
    </header>
    {care.error ? <StateMessage kind="error">{normalizeApiError(care.error).message}</StateMessage> :
      care.isPending || !care.data ? <StateMessage kind="loading">Loading care workspace</StateMessage> :
      <>
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {draft && <form onSubmit={submit} className={styles.form}>
          <h4>{draft.itemId ? 'Edit care item' : 'New care item'}</h4>
          <div className={styles.fields}>
            <label>Kind<select value={draft.input.kind} disabled={Boolean(draft.itemId)} onChange={(event) => updateInput({ kind: event.target.value as CareItemKind })}>
              {Object.entries(kinds).map(([value, { label }]) => <option value={value} key={value}>{label}</option>)}
            </select></label>
            <label>Title<input value={draft.input.title} onChange={(event) => updateInput({ title: event.target.value })} required maxLength={160} /></label>
            {draft.input.kind !== 'NOTE' && <>
              <label>Due date<input type="date" value={draft.input.dueDate ?? ''} onChange={(event) => updateInput({ dueDate: event.target.value || null })} /></label>
              <label>Status<select value={draft.input.status ?? 'OPEN'} onChange={(event) => updateInput({ status: event.target.value as CareItemInput['status'] })}><option value="OPEN">Open</option><option value="DONE">Done</option></select></label>
            </>}
          </div>
          <label>Details<textarea value={draft.input.detail ?? ''} onChange={(event) => updateInput({ detail: event.target.value })} rows={4} maxLength={2000} /></label>
          <p className={styles.muted}>{kinds[draft.input.kind].description}</p>
          {save.error && <StateMessage kind="error">{normalizeApiError(save.error).message}</StateMessage>}
          <div className={styles.buttons}>
            <Button type="submit" disabled={save.isPending || !draft.input.title.trim()}>{save.isPending ? 'Saving…' : 'Save care item'}</Button>
            <Button type="button" variant="quiet" disabled={save.isPending} onClick={() => { setDraft(undefined); save.reset(); }}>Cancel</Button>
          </div>
        </form>}
        <div className={styles.groups}>
          {(Object.keys(kinds) as CareItemKind[]).map((kind) => {
            const items = care.data.items.filter((item) => item.kind === kind);
            const { plural, icon: Icon } = kinds[kind];
            return <section key={kind} className={styles.group}>
              <h4><Icon size={17} aria-hidden="true" />{plural}</h4>
              {items.length === 0 ? <p className={styles.muted}>Nothing has been added.</p> : <ul>
                {items.map((item) => <li className={styles.item} key={item.id}>
                  <div className={styles.itemHeading}><strong>{item.title}</strong><button type="button" onClick={() => startEdit(item)} disabled={save.isPending} aria-label={`Edit ${item.title}`}>Edit</button></div>
                  {item.detail && <p>{item.detail}</p>}
                  {item.kind !== 'NOTE' && <small>{item.status === 'DONE' ? 'Done' : 'Open'}{item.dueDate ? ` · Due ${item.dueDate}` : ''}</small>}
                </li>)}
              </ul>}
            </section>;
          })}
        </div>
        <section className={styles.briefs} aria-labelledby="shared-briefs-title">
          <h4 id="shared-briefs-title">Patient-shared visit briefs</h4>
          {care.data.briefs.length ? care.data.briefs.map((brief) => <Brief key={brief.id} brief={brief} onViewEvent={onViewEvent} />) : <StateMessage kind="empty">The patient has yet to share a visit brief.</StateMessage>}
        </section>
      </>}
  </section>;
}

function Brief({ brief, onViewEvent }: { brief: SharedVisitBrief; onViewEvent: (event: TimelineEntry) => void }) {
  return <article className={styles.brief}>
    <header><h5>{brief.title}</h5><small>Shared <time dateTime={brief.createdAt}>{new Date(brief.createdAt).toLocaleString()}</time></small></header>
    {brief.notes && <p>{brief.notes}</p>}
    <ul>
      {brief.events.map((event) => <li key={`${event.kind}:${event.id}`}>
        <span><strong>{event.glucose ? `${event.glucose.value} ${event.glucose.unit}` : event.title}</strong><small>{sourceLabels[event.source]} · {new Date(event.occurredAt).toLocaleString()}</small></span>
        <a href="#patient-timeline-title" onClick={() => onViewEvent(event)} aria-label={`View ${event.title} in the health timeline`}>View in timeline</a>
      </li>)}
    </ul>
  </article>;
}
