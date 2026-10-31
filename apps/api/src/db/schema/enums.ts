import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['doctor', 'patient', 'admin']);
export const doctorVerificationStatusEnum = pgEnum('doctor_verification_status', [
  'pending',
  'verified',
  'rejected',
]);
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'expired',
]);
export const relationshipStatusEnum = pgEnum('relationship_status', ['active', 'revoked']);