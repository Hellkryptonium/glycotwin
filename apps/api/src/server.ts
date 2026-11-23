import { closeDatabase } from './config/database.js';
import { loadEnvironment } from './config/env.js';
import { createApp } from './app.js';

const environment = loadEnvironment();
const app = createApp({ environment });
const server = app.listen(environment.PORT, environment.HOST, () => {
  console.log(`GlycoTwin API listening on ${environment.HOST}:${environment.PORT}`);
});

app.locals.aiLiveGateway?.attach(server);

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
