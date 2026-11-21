import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, LockKeyhole, LogOut, Mail, Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState, type FormEvent } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { Button } from '../../components/ui/button';
import { StatusPill } from '../../components/ui/status-pill';
import { useEndSession, useLogout, useMe } from '../../queries/auth.queries';
import { queryKeys } from '../../queries/keys';
import { changePassword, deleteAccount, updateDoctorProfile } from '../../services/auth.api';
import { normalizeApiError } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import type { DoctorProfile, SafeUser } from '../../types/api';
import styles from './settings.module.css';

const verificationCopy = {
  pending: 'Your professional details are awaiting verification before you can access patient connections.',
  verified: 'Your clinician account can access patient connections with the patient’s consent.',
  rejected: 'Check your professional details and contact the clinic coordinator about verification.',
};

export default function SettingsPage() {
  const { data: user } = useMe();
  const router = useRouter();
  const logout = useLogout();

  return <AppShell>
    {user?.role === 'doctor' && <section className={styles.page}>
      <header className={styles.heading}>
        <h2>Profile &amp; settings</h2>
        <p>{router.query.setup === '1' ? 'Complete your clinician profile to get started.' : 'Manage your clinician profile and account access.'}</p>
      </header>
      <ProfileEditor key={user.id} profile={user.doctorProfile} />
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="sign-in-email">
          <h3 id="sign-in-email"><Mail size={21} aria-hidden="true" /> Sign-in email</h3>
          <p className={styles.email}>{user.email}</p>
        </section>
        <PasswordSettings/>
      </div>
      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="session-settings">
          <h3 id="session-settings">Session</h3>
          <p>Sign out of this browser when you finish using a shared device.</p>
          {logout.error && <FormError error={logout.error} />}
          <Button type="button" variant="quiet" disabled={logout.isPending} onClick={() => logout.mutate()} icon={<LogOut size={17} aria-hidden="true" />}>{logout.isPending ? 'Signing out…' : 'Sign out'}</Button>
        </section>
        <DeleteAccount/>
      </div>
    </section>}
  </AppShell>;
}

function ProfileEditor({ profile }: { profile?: DoctorProfile }) {
  const client = useQueryClient();
  const status = profile?.verificationStatus ?? 'pending';
  const [fields, setFields] = useState({
    fullName: profile?.fullName ?? '',
    specialization: profile?.specialization ?? '',
    hospitalOrClinic: profile?.hospitalOrClinic ?? '',
    medicalRegistrationNumber: profile?.medicalRegistrationNumber ?? '',
    medicalCouncil: profile?.medicalCouncil ?? '',
    yearsOfExperience: profile?.yearsOfExperience == null ? '' : String(profile.yearsOfExperience),
  });
  const update = useMutation({
    mutationFn: updateDoctorProfile,
    onSuccess: ({ email, profile: doctorProfile }) => {
      const previous = client.getQueryData<SafeUser>(queryKeys.me);
      if (previous) {
        const user = { ...previous, email, doctorProfile };
        client.setQueryData(queryKeys.me, user);
        useAuthStore.getState().setUser(user);
      }
      if (doctorProfile.verificationStatus !== status) {
        client.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== queryKeys.me[0] });
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    update.mutate({
      fullName: fields.fullName.trim(),
      specialization: fields.specialization.trim() || null,
      hospitalOrClinic: fields.hospitalOrClinic.trim() || null,
      medicalRegistrationNumber: fields.medicalRegistrationNumber.trim() || null,
      medicalCouncil: fields.medicalCouncil.trim() || null,
      yearsOfExperience: fields.yearsOfExperience ? Number(fields.yearsOfExperience) : null,
    });
  }

  const textFields = [
    { field: 'fullName', label: 'Full name', max: 200, required: true, complete: 'name' },
    { field: 'specialization', label: 'Specialty', max: 200, complete: 'organization-title' },
    { field: 'hospitalOrClinic', label: 'Hospital or clinic', max: 255, complete: 'organization' },
    { field: 'medicalRegistrationNumber', label: 'Medical registration number', max: 100 },
    { field: 'medicalCouncil', label: 'Medical council', max: 200 },
  ] as const;

  return <section className={styles.card} aria-labelledby="clinician-profile">
    <div className={styles.cardHeading}>
      <h3 id="clinician-profile"><UserRound size={21} aria-hidden="true" /> Clinician profile</h3>
      <StatusPill tone={status === 'verified' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{status === 'pending' ? 'Verification pending' : status === 'verified' ? 'Verified' : 'Verification rejected'}</StatusPill>
    </div>
    <p>{verificationCopy[status]}</p>
    <form onSubmit={submit}>
      <div className={styles.profileFields}>
        {textFields.map(({ field, label, max, ...options }) => <label key={field}>{label}<input value={fields[field]} onChange={(event) => { setFields({ ...fields, [field]: event.target.value }); update.reset(); }} maxLength={max} required={'required' in options && options.required} autoComplete={'complete' in options ? options.complete : undefined} /></label>)}
        <label>Years of experience<input type="number" value={fields.yearsOfExperience} min={0} max={100} step={1} onChange={(event) => { setFields({ ...fields, yearsOfExperience: event.target.value }); update.reset(); }} /></label>
      </div>
      {update.isSuccess && <p className={styles.success} role="status"><Check size={16} aria-hidden="true" /> Profile saved.</p>}
      {update.error && <FormError error={update.error} />}
      <Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  </section>;
}

function PasswordSettings() {
  const router = useRouter();
  const endSession = useEndSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const update = useMutation({
    mutationFn: changePassword,
    onSuccess: () => { endSession(); void router.replace('/auth/login?passwordChanged=1'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setMismatch(true); return; }
    setMismatch(false);
    update.mutate({ currentPassword, newPassword });
  }

  return <section className={styles.card} aria-labelledby="password-settings">
    <h3 id="password-settings"><LockKeyhole size={21} aria-hidden="true" /> Password</h3>
    <p>Use at least 8 characters. Saving a new password signs you out.</p>
    <form onSubmit={submit}>
      <label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setMismatch(false); }} /></label>
      <label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setMismatch(false); }} /></label>
      {mismatch && <p className={styles.error} role="alert">The passwords must match.</p>}
      {update.error && <FormError error={update.error} />}
      <Button type="submit" variant="quiet" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Change password'}</Button>
    </form>
  </section>;
}

function DeleteAccount() {
  const router = useRouter();
  const endSession = useEndSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => { endSession(); void router.replace('/?accountDeleted=1'); },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (confirmed) remove.mutate(currentPassword);
  }

  return <section className={`${styles.card} ${styles.dangerCard}`} aria-labelledby="delete-settings">
    <h3 id="delete-settings"><Trash2 size={21} aria-hidden="true" /> Delete account</h3>
    <p>Permanently delete this account and end access to its connected patient records.</p>
    <details>
      <summary>Review account deletion</summary>
      <form onSubmit={submit}>
        <label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required /> I understand that deleting my account is permanent.</label>
        {remove.error && <FormError error={remove.error} />}
        <Button type="submit" variant="danger" disabled={remove.isPending || !confirmed}>{remove.isPending ? 'Deleting account…' : 'Permanently delete my account'}</Button>
      </form>
    </details>
  </section>;
}

function FormError({ error }: { error: unknown }) {
  return <p className={styles.error} role="alert">{normalizeApiError(error).message}</p>;
}
