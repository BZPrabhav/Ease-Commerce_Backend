const { createApp } = require('./app');
const { config } = require('./config');
const { createDatabase } = require('./db');

async function start() {
  const db = await createDatabase();
  const app = createApp({ db });

  app.listen(config.port, () => {
    console.log(`Ease Commerce Backend listening on port ${config.port}`);
    console.log(`Database client: ${config.dbClient}`);
  });
}

start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
