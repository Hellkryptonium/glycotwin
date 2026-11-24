import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import type { SafeUser, UserService } from '../auth/auth.types.js';
import { createDoctorsRepository } from '../doctors/doctors.repository.js';
import { createPatientsRepository } from '../patients/patients.repository.js';
import { createUsersRepository } from './users.repository.js';

function toSafeUser({ id, email, role, isActive, emailVerifiedAt, createdAt, updatedAt }: SafeUser): SafeUser {
  return { id, email, role, isActive, emailVerifiedAt, createdAt, updatedAt };
}

export function createUsersService(database: Database, options: { autoApproveDoctors?: boolean } = {}): UserService {
  const usersRepository = createUsersRepository(database);
  const doctorsRepository = createDoctorsRepository(database);
  const patientsRepository = createPatientsRepository(database);

  return {
    register(role, email, passwordHash, complete) {
      return database.transaction(async (transaction) => {
        const user = await usersRepository.insertUser(transaction, { email, passwordHash, role });
        if (!user) throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');

        if (role === 'doctor') {
          await doctorsRepository.insertProfile(transaction, {
            userId: user.id,
            verificationStatus: options.autoApproveDoctors ? 'verified' : 'pending',
          });
        } else {
          await patientsRepository.insertProfile(transaction, { userId: user.id });
        }
        return complete(transaction, toSafeUser(user));
      });
    },

    async getAuthenticatedUser(userId: string) {
      const user = await usersRepository.findById(userId);
      if (!user) {
        return null;
      }

      if (user.role === 'doctor') {
        const profile = await doctorsRepository.findByUserId(user.id);
        return {
          ...toSafeUser(user),
          ...(profile && {
            doctorProfile: {
              id: profile.id,
              fullName: profile.fullName,
              medicalRegistrationNumber: profile.medicalRegistrationNumber,
              medicalCouncil: profile.medicalCouncil,
              specialization: profile.specialization,
              hospitalOrClinic: profile.hospitalOrClinic,
              yearsOfExperience: profile.yearsOfExperience,
              verificationStatus: profile.verificationStatus,
              profilePhotoAssetId: profile.profilePhotoAssetId,
            },
          }),
        };
      }

      if (user.role === 'patient') {
        const profile = await patientsRepository.findByUserId(user.id);
        return {
          ...toSafeUser(user),
          ...(profile && {
            patientProfile: {
              id: profile.id,
              fullName: profile.fullName,
              dateOfBirth: profile.dateOfBirth,
              gender: profile.gender,
              diabetesType: profile.diabetesType,
              treatmentContext: profile.treatmentContext,
              profilePhotoAssetId: profile.profilePhotoAssetId,
            },
          }),
        };
      }

      return toSafeUser(user);
    },
  };
}
