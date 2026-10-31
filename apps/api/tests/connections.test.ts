import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Environment } from '../src/config/env.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../src/middleware/auth.middleware.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import { createConnectionRouter } from '../src/modules/connections/connection.routes.js';
import { createConnectionService } from '../src/modules/connections/connection.service.js';
import type { ConnectionRepository, ConnectedPatient, InvitationSummary, PatientSearchResult } from '../src/modules/connections/connection.types.js';

const environment: Environment = {
  NODE_ENV: 'test', DEMO_MODE: false, PORT: 5000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'glycotwin-api', JWT_AUDIENCE: 'glycotwin-clients', BCRYPT_ROUNDS: 10,
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const secondDoctorUserId = '00000000-0000-4000-8000-000000000002';
const patientUserId = '00000000-0000-4000-8000-000000000003';
const otherPatientUserId = '00000000-0000-4000-8000-000000000004';
const doctorProfileId = '00000000-0000-4000-8000-000000000011';
const secondDoctorProfileId = '00000000-0000-4000-8000-000000000012';
const patientProfileId = '00000000-0000-4000-8000-000000000013';
const otherPatientProfileId = '00000000-0000-4000-8000-000000000014';

function user(id: string, role: 'doctor' | 'patient', profileId: string, verificationStatus?: 'verified') : AuthenticatedUser {
  return {
    id, email: `${id.slice(-2)}@example.com`, role, isActive: true, emailVerifiedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...(role === 'doctor' ? { doctorProfile: { id: profileId, fullName: 'Doctor', medicalRegistrationNumber: null, medicalCouncil: null, specialization: null, hospitalOrClinic: null, yearsOfExperience: null, verificationStatus: verificationStatus ?? 'pending' } } : { patientProfile: { id: profileId, fullName: 'Patient', dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

function createHarness() {
  const users = new Map<string, AuthenticatedUser>([
    [doctorUserId, user(doctorUserId, 'doctor', doctorProfileId, 'verified')],
    [secondDoctorUserId, user(secondDoctorUserId, 'doctor', secondDoctorProfileId, 'verified')],
    [patientUserId, user(patientUserId, 'patient', patientProfileId)],
    [otherPatientUserId, user(otherPatientUserId, 'patient', otherPatientProfileId)],
  ]);
  const patients = new Map<string, { id: string; userId: string; email: string; fullName: string | null }>([
    [patientProfileId, { id: patientProfileId, userId: patientUserId, email: 'patient@example.com', fullName: 'Patient' }],
    [otherPatientProfileId, { id: otherPatientProfileId, userId: otherPatientUserId, email: 'other@example.com', fullName: 'Other Patient' }],
  ]);
  const doctors = new Map([[doctorProfileId, { id: doctorProfileId, userId: doctorUserId, verificationStatus: 'verified' as const }], [secondDoctorProfileId, { id: secondDoctorProfileId, userId: secondDoctorUserId, verificationStatus: 'verified' as const }]]);
  const invitations: Array<{ id: string; doctorId: string; patientId: string; status: 'pending' | 'accepted' | 'declined' | 'expired'; expiresAt: Date; respondedAt: Date | null; createdAt: Date }> = [];
  const relationships: Array<{ id: string; doctorId: string; patientId: string; invitationId: string; status: 'active' | 'revoked'; consentedAt: Date; revokedAt: Date | null }> = [];
  const auditEvents: string[] = [];
  let sequence = 1;

  const repository: ConnectionRepository = {
    async findPatientByEmail(email): Promise<PatientSearchResult | null> {
      const patient = [...patients.values()].find((candidate) => candidate.email === email);
      return patient ? { patientId: patient.id, email: patient.email, fullName: patient.fullName } : null;
    },
    async findDoctorByUserId(userId) {
      return [...doctors.values()].find((doctor) => doctor.userId === userId) ?? null;
    },
    async findPatientByUserId(userId) {
      const patient = [...patients.values()].find((candidate) => candidate.userId === userId);
      return patient ? { id: patient.id, userId: patient.userId } : null;
    },
    async findPatientById(id) {
      const patient = patients.get(id);
      return patient ? { id: patient.id, userId: patient.userId } : null;
    },
    async createInvitation(input) {
      if (invitations.some((invitation) => invitation.doctorId === input.doctorId && invitation.patientId === input.patientId && invitation.status === 'pending')) {
        throw new Error('PENDING_INVITATION_EXISTS');
      }
      const invitation = { id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, ...input, status: 'pending' as const, respondedAt: null, createdAt: new Date() };
      invitations.push(invitation);
      auditEvents.push('doctor.invitation.created');
      return invitation;
    },
    async listPatientInvitations(patientId): Promise<InvitationSummary[]> {
      return invitations.filter((invitation) => invitation.patientId === patientId).map((invitation) => ({
        id: invitation.id, status: invitation.status, expiresAt: invitation.expiresAt, respondedAt: invitation.respondedAt, createdAt: invitation.createdAt,
        doctor: { id: invitation.doctorId, fullName: 'Doctor' },
      }));
    },
    async respondToInvitation(input) {
      const invitation = invitations.find((candidate) => candidate.id === input.invitationId && candidate.patientId === input.patientId);
      if (!invitation) throw new Error('INVITATION_NOT_FOUND');
      if (invitation.status !== 'pending') throw new Error('INVITATION_NOT_PENDING');
      if (invitation.expiresAt <= input.now) { invitation.status = 'expired'; throw new Error('INVITATION_EXPIRED'); }
      invitation.status = input.action;
      invitation.respondedAt = input.now;
      if (input.action === 'accepted') {
        if (relationships.some((relationship) => relationship.invitationId === invitation.id || (relationship.doctorId === invitation.doctorId && relationship.patientId === invitation.patientId && relationship.status === 'active'))) {
          throw new Error('RELATIONSHIP_EXISTS');
        }
        relationships.push({ id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, doctorId: invitation.doctorId, patientId: invitation.patientId, invitationId: invitation.id, status: 'active', consentedAt: input.now, revokedAt: null });
      }
      auditEvents.push(`patient.invitation.${input.action}`);
      return input.action;
    },
    async listConnectedPatients(doctorId, offset, limit): Promise<ConnectedPatient[]> {
      return relationships.filter((relationship) => relationship.doctorId === doctorId && relationship.status === 'active').slice(offset, offset + limit).map((relationship) => ({
        relationshipId: relationship.id, patientId: relationship.patientId, fullName: patients.get(relationship.patientId)?.fullName ?? null, connectedAt: relationship.consentedAt,
      }));
    },
    async revokeRelationship(input) {
      const relationship = relationships.find((candidate) => candidate.id === input.relationshipId && candidate.patientId === input.patientId && candidate.status === 'active');
      if (!relationship) throw new Error('RELATIONSHIP_NOT_FOUND');
      relationship.status = 'revoked'; relationship.revokedAt = input.now; auditEvents.push('patient.relationship.revoked');
    },
  };
  const service = createConnectionService(repository, async (userId) => {
    const current = users.get(userId);
    if (!current) throw new Error('missing user');
    return current;
  });
  return { service, users, invitations, relationships, auditEvents };
}

describe('doctor-patient connections', () => {
  it('searches patients by exact normalized email without health data', async () => {
    const harness = createHarness();
    const result = await harness.service.searchPatients(doctorUserId, 'patient@example.com');
    expect(result).toEqual({ patientId: patientProfileId, email: 'patient@example.com', fullName: 'Patient' });
    expect(result).not.toHaveProperty('diabetesType');
  });

  it('creates invitations and rejects duplicates', async () => {
    const harness = createHarness();
    const invitation = await harness.service.createInvitation(doctorUserId, patientProfileId);
    expect(invitation.status).toBe('pending');
    await expect(harness.service.createInvitation(doctorUserId, patientProfileId)).rejects.toMatchObject({ code: 'PENDING_INVITATION_EXISTS' });
    expect(harness.auditEvents).toContain('doctor.invitation.created');
  });

  it('accepts invitations transactionally and prevents duplicate acceptance', async () => {
    const harness = createHarness();
    const invitation = await harness.service.createInvitation(doctorUserId, patientProfileId);
    await expect(Promise.allSettled([
      harness.service.respondToInvitation(patientUserId, invitation.id, 'accepted'),
      harness.service.respondToInvitation(patientUserId, invitation.id, 'accepted'),
    ])).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'fulfilled' }),
      expect.objectContaining({ status: 'rejected' }),
    ]));
    expect(harness.relationships.filter((relationship) => relationship.status === 'active')).toHaveLength(1);
  });

  it('declines invitations without creating relationships', async () => {
    const harness = createHarness();
    const invitation = await harness.service.createInvitation(doctorUserId, patientProfileId);
    await expect(harness.service.respondToInvitation(patientUserId, invitation.id, 'declined')).resolves.toBe('declined');
    expect(harness.relationships).toHaveLength(0);
  });

  it('rejects unauthorized responders and expired invitations', async () => {
    const harness = createHarness();
    const invitation = await harness.service.createInvitation(doctorUserId, patientProfileId);
    await expect(harness.service.respondToInvitation(otherPatientUserId, invitation.id, 'accepted')).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
    invitation.expiresAt = new Date(Date.now() - 1);
    await expect(harness.service.respondToInvitation(patientUserId, invitation.id, 'accepted')).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
  });

  it('scopes connected patients to the requesting doctor and supports revocation', async () => {
    const harness = createHarness();
    const invitation = await harness.service.createInvitation(doctorUserId, patientProfileId);
    await harness.service.respondToInvitation(patientUserId, invitation.id, 'accepted');
    expect((await harness.service.listConnectedPatients(doctorUserId, 1, 20)).items).toHaveLength(1);
    expect((await harness.service.listConnectedPatients(secondDoctorUserId, 1, 20)).items).toHaveLength(0);
    const relationshipId = harness.relationships[0]!.id;
    await harness.service.revokeRelationship(patientUserId, relationshipId);
    expect((await harness.service.listConnectedPatients(doctorUserId, 1, 20)).items).toHaveLength(0);
    expect(harness.auditEvents).toContain('patient.relationship.revoked');
  });

  it('rejects unauthenticated connection requests', async () => {
    const harness = createHarness();
    const verifier = {
      verifyAccessToken: async () => { throw new Error('missing token'); },
      getCurrentUser: async (userId: string) => harness.users.get(userId)!,
    };
    const router = createConnectionRouter(harness.service, createRequireAuth(verifier), createRequireActiveAuth(verifier), (role) => createRequireRole(role), createRequireVerifiedDoctor(verifier));
    const app = createApp({ environment, authModule: null, connectionRouter: router });
    const response = await request(app).get('/api/v1/doctor/patients/search').query({ email: 'patient@example.com' });
    expect(response.status).toBe(401);
  });
});