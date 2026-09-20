require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbClient: (process.env.DB_CLIENT || 'in-memory').toLowerCase(),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || 'root',
  dbPassword: process.env.DB_PASSWORD || '',
  dbName: process.env.DB_NAME || 'ease_commerce',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 15000),
  retryMaxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS || 3),
  retryBackoffMs: Number(process.env.RETRY_BACKOFF_MS || 500),
  supportedCouriers: ['urbanebolt', 'mockcourier'],
  courier: {
    urbanebolt: {
      baseUrl: process.env.URBANEBOLT_BASE_URL || 'https://uat.urbanebolt.example.com',
      username: process.env.URBANEBOLT_USERNAME || process.env.URBANEBOLT_API_KEY || 'demo-user',
      password: process.env.URBANEBOLT_PASSWORD || process.env.URBANEBOLT_API_SECRET || 'demo-pass',
      apiKey: process.env.URBANEBOLT_API_KEY || 'demo-key',
      apiSecret: process.env.URBANEBOLT_API_SECRET || 'demo-secret'
    },
    mockcourier: {
      baseUrl: process.env.MOCKCOURIER_BASE_URL || 'https://mockcourier.example.com',
      apiKey: process.env.MOCKCOURIER_API_KEY || 'demo-key'
    }
  }
};

module.exports = { config };
