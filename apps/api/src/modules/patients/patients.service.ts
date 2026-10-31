export interface PatientService {
  registrationIsProfileScoped(): true;
}

export function createPatientsService(): PatientService {
  return { registrationIsProfileScoped: () => true };
}