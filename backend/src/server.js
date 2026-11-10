import { buildApp } from './app.js';
import { migrate } from './migrate.js';

await migrate();
const app = await buildApp();
const port = Number(process.env.PORT || 8080);
await app.listen({ host: '0.0.0.0', port });
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => app.close().then(() => process.exit(0)));
