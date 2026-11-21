import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';
import { loadEnvironment } from '../src/config/env.js';

test.skipIf(process.env.GLYCOTWIN_LOCAL_INTEGRATION !== '1')('local device data is deduplicated, scoped, and reported with provenance', async () => {
  const environment = loadEnvironment();
  const url = new URL(environment.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/glycotwin_local'
    || environment.NODE_ENV !== 'development' || !environment.DEMO_MODE) {
    throw new Error('Use the isolated Docker PostgreSQL database in local demo mode for this test.');
  }

  const api = request(createApp({ environment }));
  const prefix = '/api/v1';
  const accounts: string[] = [];
  const password = `Demo-${randomUUID()}`;
  const email = `device-replay-${randomUUID()}@example.test`;
  const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createAccount(role: 'patient' | 'doctor', address: string) {
    await api.post(`${prefix}/auth/register/${role}`).send({ email: address, password }).expect(201);
    const response = await api.post(`${prefix}/auth/login`).send({ email: address, password }).expect(200);
    const token: string = response.body.data.accessToken;
    accounts.push(token);
    return authorization(token);
  }

  try {
    const patient = await createAccount('patient', email);
    const doctor = await createAccount('doctor', `device-doctor-${randomUUID()}@example.test`);
    const otherPatient = await createAccount('patient', `device-regular-${randomUUID()}@example.com`);
    const profile = await api.put(`${prefix}/patient/profile`).set(patient).send({
      fullName: 'Local Demo', diabetesType: 'Type 2', treatmentContext: 'INSULIN',
    }).expect(200);
    const patientId: string = profile.body.data.profile.id;
    expect(profile.body.data.profile.treatmentContext).toBe('INSULIN');
    const timeline = `${prefix}/doctor/patients/${patientId}/timeline`;
    await api.get(timeline).set(doctor).expect(403);

    const replay = `${prefix}/patient/glucose-readings/replay`;
    await api.post(replay).set(otherPatient).expect(403);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      expect((await api.post(replay).set(patient).expect(200)).body.data).toEqual({ inserted: 10, duplicates: 0 });
      expect((await api.post(replay).set(patient).expect(200)).body.data).toEqual({ inserted: 0, duplicates: 10 });
    } finally {
      clock.mockRestore();
    }
    const demo = await api.get(`${prefix}/patient/glucose-readings?source=REPLAY`).set(patient).expect(200);
    expect(demo.body.data.items).toHaveLength(10);
    expect(demo.body.data.items[0]).toMatchObject({ source: 'REPLAY', value: '129.0000', receivedAt: expect.any(String) });
    await api.delete(`${prefix}/patient/glucose-readings/${demo.body.data.items[0].id}`).set(patient).expect(404);
    expect((await api.get(`${prefix}/patient/timeline`).set(otherPatient).expect(200)).body.data.items).toEqual([]);

    const measuredAt = new Date(Date.now() - 60_000).toISOString();
    const glucose = { externalId: randomUUID(), value: '126', unit: 'mg/dL', measuredAt, deviceOrigin: 'test.sensor.app' };
    const importPath = `${prefix}/patient/glucose-readings/import`;
    expect((await api.post(importPath).set(patient).send({ readings: [glucose, glucose] }).expect(200)).body.data)
      .toEqual({ inserted: 1, duplicates: 1 });
    expect((await api.post(importPath).set(patient).send({ readings: [{ ...glucose, value: '128' }] }).expect(200)).body.data)
      .toEqual({ inserted: 0, duplicates: 1 });
    await api.post(importPath).set(patient).send({ source: 'REPLAY', readings: [glucose] }).expect(400);
    const earlierAt = new Date(Date.now() - 86_400_000).toISOString();
    await api.post(importPath).set(patient).send({ readings: [{ ...glucose, externalId: randomUUID(), measuredAt: earlierAt }] }).expect(200);

    const event = { eventId: randomUUID(), kind: 'steps', value: 125, measuredAt };
    const devicePath = `${prefix}/patient/device-activity`;
    await api.post(devicePath).set(otherPatient).send({ events: [{ ...event, simulated: true }] }).expect(403);
    expect((await api.post(devicePath).set(patient).send({ events: [event, event] }).expect(200)).body.data)
      .toEqual({ inserted: 1, duplicates: 1 });
    await api.post(devicePath).set(patient).send({ events: [{ ...event, eventId: randomUUID(), simulated: true }] }).expect(200);

    const medicationPath = `${prefix}/patient/medications`;
    const medication = await api.post(medicationPath).set(patient).send({
      name: 'Demo medication', dosage: 'Scheduled amount', frequency: 'daily', scheduleTimes: ['09:00'], startDate: measuredAt,
    }).expect(201);
    const dosesPath = `${medicationPath}/${medication.body.data.id}/doses`;
    await api.post(dosesPath).set(patient).send({ scheduledAt: measuredAt, status: 'skipped' }).expect(201);
    await api.post(dosesPath).set(patient).send({ scheduledAt: measuredAt, takenAt: measuredAt, status: 'taken', actualDose: 'Demo amount' }).expect(201);

    const invite = await api.post(`${prefix}/doctor/invitations`).set(doctor).send({ patientId }).expect(201);
    await api.post(`${prefix}/patient/invitations/${invite.body.data.id}/respond`).set(patient).send({ action: 'accepted' }).expect(200);
    const list = await api.get(`${prefix}/doctor/patients`).set(doctor).expect(200);
    const relationshipId: string = list.body.data.items.find((item: { patientId: string }) => item.patientId === patientId).relationshipId;
    const clinical = await api.get(timeline).set(doctor).query({ source: 'HEALTH_CONNECT', from: measuredAt }).expect(200);
    expect(clinical.body.data.items).toEqual([expect.objectContaining({
      source: 'HEALTH_CONNECT', deviceOrigin: 'test.sensor.app', occurredAt: measuredAt,
      glucose: { value: '126.0000', unit: 'mg/dL' },
    })]);
    const page = await api.get(timeline).set(doctor).query({ limit: 1 }).expect(200);
    expect(page.body.data.hasMore).toBe(true);
    expect(page.body.data.items).toHaveLength(1);
    expect((await api.get(timeline).set(doctor).query({ source: 'WATCH' }).expect(200)).body.data.items)
      .toEqual([expect.objectContaining({ source: 'WATCH', kind: 'steps', detail: '125 steps' })]);
    expect((await api.get(timeline).set(doctor).query({ source: 'REPLAY' }).expect(200)).body.data.items)
      .toContainEqual(expect.objectContaining({ source: 'REPLAY', kind: 'steps' }));
    expect((await api.get(timeline).set(doctor).query({ source: 'MANUAL' }).expect(200)).body.data.items)
      .toEqual([expect.objectContaining({ kind: 'medication', detail: 'Taken dose · Demo amount' })]);

    const analytics = await api.get(`${prefix}/patient/analytics/glucose`).set(patient).expect(200);
    expect(analytics.body.data.totalReadings).toBe(2);
    expect(analytics.body.data.latest.source).toBe('HEALTH_CONNECT');
    expect(analytics.body.data.readings.map((reading: { measuredAt: string }) => reading.measuredAt)).toEqual([earlierAt, measuredAt]);

    const doctorCare = `${prefix}/doctor/patients/${patientId}/care`;
    await api.post(`${doctorCare}/items`).set(doctor).send({ kind: 'NOTE', title: 'Private clinician note' }).expect(201);
    const goal = await api.post(`${doctorCare}/items`).set(doctor).send({ kind: 'GOAL', title: 'Bring readings to the next visit' }).expect(201);
    await api.put(`${doctorCare}/items/${goal.body.data.id}`).set(doctor)
      .send({ kind: 'GOAL', title: 'Bring readings to the next visit', status: 'DONE' }).expect(200);
    const care = await api.get(`${prefix}/patient/care`).set(patient).expect(200);
    expect(care.body.data.items).toEqual([expect.objectContaining({ kind: 'GOAL', status: 'DONE' })]);
    expect(care.body.data.connections).toEqual([expect.objectContaining({ id: relationshipId })]);

    const briefPath = `${prefix}/patient/visit-briefs`;
    const eventIds = [clinical.body.data.items[0].id];
    await api.post(briefPath).set(otherPatient).send({ relationshipId, title: 'Wrong owner', eventIds }).expect(400);
    const brief = await api.post(briefPath).set(patient).send({ relationshipId, title: 'Review imported reading', eventIds }).expect(201);
    const clinicianBriefs = (await api.get(doctorCare).set(doctor).expect(200)).body.data.briefs;
    expect(clinicianBriefs).toEqual([expect.objectContaining({ id: brief.body.data.id,
      events: [expect.objectContaining({ id: eventIds[0] })] })]);
    await api.delete(`${briefPath}/${brief.body.data.id}`).set(otherPatient).expect(404);
    await api.delete(`${briefPath}/${brief.body.data.id}`).set(patient).expect(204);
    expect((await api.get(doctorCare).set(doctor).expect(200)).body.data.briefs).toEqual([]);
    await api.post(`${prefix}/patient/relationships/${relationshipId}/revoke`).set(patient).expect(204);
    await api.get(doctorCare).set(doctor).expect(403);
    await api.get(timeline).set(doctor).expect(403);
  } finally {
    try {
      for (const token of accounts) await api.delete(`${prefix}/auth/account`).set(authorization(token)).send({ currentPassword: password }).expect(204);
    } finally {
      await closeDatabase();
    }
  }
}, 25_000);
