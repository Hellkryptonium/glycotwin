export interface PatientSearchResult {
  patientId: string;
  email: string;
  fullName: string | null;
}

export interface InvitationSummary {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  doctor: {
    id: string;
    fullName: string | null;
  };
}

export interface ConnectedPatient {
  relationshipId: string;
  patientId: string;
  fullName: string | null;
  connectedAt: Date;
}

export interface ConnectionRepository {
  findPatientByEmail(email: string): Promise<PatientSearchResult | null>;
  findPatientById(id: string): Promise<{ id: string; userId: string } | null>;
  findDoctorByUserId(userId: string): Promise<{ id: string; userId: string; verificationStatus: 'pending' | 'verified' | 'rejected' } | null>;
  findPatientByUserId(userId: string): Promise<{ id: string; userId: string } | null>;
  createInvitation(input: { doctorId: string; patientId: string; expiresAt: Date; actorUserId: string }): Promise<{ id: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'; expiresAt: Date; createdAt: Date }>;
  listPatientInvitations(patientId: string): Promise<InvitationSummary[]>;
  respondToInvitation(input: { invitationId: string; patientId: string; action: 'accepted' | 'declined'; now: Date; actorUserId: string }): Promise<'accepted' | 'declined' | 'expired'>;
  listConnectedPatients(doctorId: string, offset: number, limit: number): Promise<ConnectedPatient[]>;
  revokeRelationship(input: { relationshipId: string; patientId: string; now: Date; actorUserId: string }): Promise<void>;
}