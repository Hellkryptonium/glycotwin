import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import type { DoctorRegistrationInput, PatientRegistrationInput, SafeUser, UserService } from '../auth/auth.types.js';
import { createDoctorsRepository } from '../doctors/doctors.repository.js';
import { createPatientsRepository } from '../patients/patients.repository.js';
import { createUsersRepository } from './users.repository.js';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function toSafeUser(user: SafeUser): SafeUser {
  return { ...user };
}

export function createUsersService(database: Database, options: { demoMode?: boolean } = {}): UserService {
  const usersRepository = createUsersRepository(database);
  const doctorsRepository = createDoctorsRepository(database);
  const patientsRepository = createPatientsRepository(database);

  return {
    async registerDoctor(input: DoctorRegistrationInput, passwordHash: string): Promise<SafeUser> {
      try {
        return await database.transaction(async (transaction) => {
          const user = await usersRepository.insertUser(transaction, {
            email: input.email,
            passwordHash,
            role: 'doctor',
          });
          await doctorsRepository.insertProfile(transaction, {
            userId: user.id,
            verificationStatus: options.demoMode ? 'verified' : 'pending',
          });
          return toSafeUser(user);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
        }
        throw error;
      }
    },

    async registerPatient(input: PatientRegistrationInput, passwordHash: string): Promise<SafeUser> {
      try {
        return await database.transaction(async (transaction) => {
          const user = await usersRepository.insertUser(transaction, {
            email: input.email,
            passwordHash,
            role: 'patient',
          });
          await patientsRepository.insertProfile(transaction, {
            userId: user.id,
          });
          return toSafeUser(user);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
        }
        throw error;
      }
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
            },
          }),
        };
      }

      return toSafeUser(user);
    },
  };
}