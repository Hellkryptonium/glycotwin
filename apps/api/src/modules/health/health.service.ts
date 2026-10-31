export type DatabaseHealthCheck = () => Promise<boolean>;

export interface HealthService {
  checkLiveness(): { status: 'ok'; service: 'glycotwin-api' };
  checkReadiness(): Promise<boolean>;
}

export function createHealthService(databaseHealthCheck: DatabaseHealthCheck): HealthService {
  return {
    checkLiveness: () => ({ status: 'ok', service: 'glycotwin-api' }),
    checkReadiness: async () => databaseHealthCheck(),
  };
}