export interface DoctorService {
  registrationStartsPending(): true;
}

export function createDoctorsService(): DoctorService {
  return { registrationStartsPending: () => true };
}