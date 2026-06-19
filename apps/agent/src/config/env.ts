/**
 * Environment configuration module.
 * 
 * CRITICAL: This is the ONLY file in the entire codebase that reads process.env.
 * All other modules must import from this file to access environment variables.
 * The process crashes immediately on startup if any required variable is missing.
 */

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (value === undefined || value === '' || value.startsWith('#')) {
    throw new Error(
      `[ENV] Missing required environment variable: ${key}. ` +
      `Set it in your .env file or environment. See .env.example for documentation.`
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key]?.trim();
  if (value === undefined || value === '' || value.startsWith('#')) {
    return defaultValue;
  }
  return value;
}

function requireOneOf<const T extends readonly string[]>(key: string, value: string, allowed: T): T[number] {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`[ENV] Environment variable ${key} must be one of: ${allowed.join(', ')}. Got: "${value}"`);
}

const NODE_ENV_VALUE = requireOneOf('NODE_ENV', optionalEnv('NODE_ENV', 'development'), ['development', 'production', 'test'] as const);
const EXTERNAL_SERVICES_MODE_VALUE = requireOneOf('EXTERNAL_SERVICES_MODE', optionalEnv(
  'EXTERNAL_SERVICES_MODE',
  NODE_ENV_VALUE === 'production' ? 'live' : 'mock',
), ['live', 'mock'] as const);

function requireLiveEnv(key: string, mockValue: string): string {
  return EXTERNAL_SERVICES_MODE_VALUE === 'live' ? requireEnv(key) : optionalEnv(key, mockValue);
}

function requireInt(key: string, defaultValue?: number): number {
  const raw = defaultValue !== undefined
    ? optionalEnv(key, String(defaultValue))
    : requireEnv(key);
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`[ENV] Environment variable ${key} must be a valid integer. Got: "${raw}"`);
  }
  return parsed;
}

function requireFloat(key: string, defaultValue?: number): number {
  const raw = defaultValue !== undefined
    ? optionalEnv(key, String(defaultValue))
    : requireEnv(key);
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) {
    throw new Error(`[ENV] Environment variable ${key} must be a valid number. Got: "${raw}"`);
  }
  return parsed;
}

function requireBool(key: string, defaultValue?: boolean): boolean {
  const raw = defaultValue !== undefined
    ? optionalEnv(key, String(defaultValue))
    : requireEnv(key);
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`[ENV] Environment variable ${key} must be "true" or "false". Got: "${raw}"`);
}

/**
 * Validated environment configuration.
 * Crashes on import if any required variable is missing.
 */
export const env = {
  // --- Core ---
  NODE_ENV: NODE_ENV_VALUE,
  EXTERNAL_SERVICES_MODE: EXTERNAL_SERVICES_MODE_VALUE,
  START_WORKERS: requireBool('START_WORKERS', NODE_ENV_VALUE === 'production'),
  PORT: requireInt('PORT', 3000),
  HOST: optionalEnv('HOST', '0.0.0.0'),

  // --- Database ---
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // --- Redis ---
  REDIS_URL: requireEnv('REDIS_URL'),
  // Parsed fields for BullMQ (which needs individual params, not ioredis instance)
  get REDIS_HOST(): string {
    try { return new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').hostname; } catch { return 'localhost'; }
  },
  get REDIS_PORT(): number {
    try { return parseInt(new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').port || '6379', 10); } catch { return 6379; }
  },
  get REDIS_PASSWORD(): string {
    try { return new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').password; } catch { return ''; }
  },
  get REDIS_TLS(): boolean {
    try { return new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').protocol === 'rediss:'; } catch { return false; }
  },

  // --- JWT Dual-Key Rotation ---
  JWT_SECRET_CURRENT: requireEnv('JWT_SECRET_CURRENT'),
  JWT_SECRET_PREVIOUS: requireEnv('JWT_SECRET_PREVIOUS'),
  JWT_ACCESS_EXPIRY: optionalEnv('JWT_ACCESS_EXPIRY', '15m'),
  JWT_REFRESH_EXPIRY: optionalEnv('JWT_REFRESH_EXPIRY', '7d'),

  // --- Sui Blockchain ---
  SUI_RPC_URL: requireLiveEnv('SUI_RPC_URL', 'https://fullnode.testnet.sui.io:443'),
  SUI_PACKAGE_ID: requireLiveEnv('SUI_PACKAGE_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_AGENT_PRIVATE_KEY: requireLiveEnv('SUI_AGENT_PRIVATE_KEY', ''),
  SUI_PROTOCOL_STATE_ID: requireLiveEnv('SUI_PROTOCOL_STATE_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_ATTESTATION_REGISTRY_ID: requireLiveEnv('SUI_ATTESTATION_REGISTRY_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_PROOF_REGISTRY_ID: requireLiveEnv('SUI_PROOF_REGISTRY_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_REVOKED_CAPS_ID: requireLiveEnv('SUI_REVOKED_CAPS_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_REPUTATION_LEDGER_ID: requireLiveEnv('SUI_REPUTATION_LEDGER_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_ADMIN_CAP_ID: requireLiveEnv('SUI_ADMIN_CAP_ID', '0x0000000000000000000000000000000000000000000000000000000000000000'),
  SUI_NETWORK: requireOneOf('SUI_NETWORK', optionalEnv('SUI_NETWORK', 'testnet'), ['mainnet', 'testnet', 'devnet', 'localnet'] as const),
  SUI_PAYMENT_COIN_TYPE: optionalEnv('SUI_PAYMENT_COIN_TYPE', '0x2::sui::SUI'),
  SUI_PAYMENT_COIN_SYMBOL: optionalEnv('SUI_PAYMENT_COIN_SYMBOL', 'USDC'),
  SUI_PAYMENT_COIN_DECIMALS: requireInt('SUI_PAYMENT_COIN_DECIMALS', 6),
  SUI_CONTRACT_VERSION: requireInt('SUI_CONTRACT_VERSION', 2),

  // --- Walrus ---
  WALRUS_PUBLISHER_URL: optionalEnv('WALRUS_PUBLISHER_URL', 'https://publisher.walrus-testnet.walrus.space'),
  WALRUS_AGGREGATOR_URL: optionalEnv('WALRUS_AGGREGATOR_URL', 'https://aggregator.walrus-testnet.walrus.space'),
  MEMWAL_PRIVATE_KEY: optionalEnv('MEMWAL_PRIVATE_KEY', ''),
  MEMWAL_ACCOUNT_ID: optionalEnv('MEMWAL_ACCOUNT_ID', ''),
  MEMWAL_SERVER_URL: optionalEnv('MEMWAL_SERVER_URL', 'https://relayer.memwal.ai'),

  // --- AI ---
  GOOGLE_GENERATIVE_AI_API_KEY: requireLiveEnv('GOOGLE_GENERATIVE_AI_API_KEY', ''),

  // --- Email ---
  RESEND_API_KEY: optionalEnv('RESEND_API_KEY', ''),
  RESEND_FROM_EMAIL: optionalEnv('RESEND_FROM_EMAIL', 'noreply@bondflow.io'),
  GMAIL_USER: optionalEnv('GMAIL_USER', ''),
  GMAIL_APP_PASSWORD: optionalEnv('GMAIL_APP_PASSWORD', ''),
  GMAIL_FROM_EMAIL: optionalEnv('GMAIL_FROM_EMAIL', ''),

  // --- Webhook ---
  WEBHOOK_SECRET: requireLiveEnv('WEBHOOK_SECRET', 'development-webhook-secret-change-me'),

  // --- CORS ---
  ALLOWED_ORIGINS: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:3001').split(',').map(s => s.trim()),

  // --- Observability ---
  OTEL_ENABLED: requireBool('OTEL_ENABLED', NODE_ENV_VALUE === 'production'),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
  OTEL_METRICS_ENDPOINT: optionalEnv('OTEL_METRICS_ENDPOINT', 'http://localhost:4318'),
  OTEL_SAMPLE_RATE: requireFloat('OTEL_SAMPLE_RATE', 1.0),
  SERVICE_VERSION: optionalEnv('SERVICE_VERSION', '0.1.0'),

  // --- Multi-tenancy ---
  DEFAULT_TENANT_PLAN: requireOneOf('DEFAULT_TENANT_PLAN', optionalEnv('DEFAULT_TENANT_PLAN', 'FREE'), ['FREE', 'PRO', 'ENTERPRISE'] as const),

  // --- File Upload Abuse Prevention ---
  MAX_UPLOAD_BYTES: requireInt('MAX_UPLOAD_BYTES', 52428800),
  ALLOWED_MIME_TYPES: optionalEnv('ALLOWED_MIME_TYPES', 'application/pdf,image/jpeg,image/png,image/gif,application/zip,text/plain')
    .split(',')
    .map(s => s.trim()),

  // --- Circuit Breaker ---
  CIRCUIT_RESET_TIMEOUT: requireInt('CIRCUIT_RESET_TIMEOUT', 60000),

  // --- Data Retention ---
  BLOCKCHAIN_EVENT_RETENTION_DAYS: requireInt('BLOCKCHAIN_EVENT_RETENTION_DAYS', 180),
  AGENT_ACTION_RETENTION_DAYS: requireInt('AGENT_ACTION_RETENTION_DAYS', 90),

  // --- Scheduler ---
  SCHEDULER_CLEANUP_HOUR: requireInt('SCHEDULER_CLEANUP_HOUR', 2),

  // --- Admin ---
  ADMIN_WALLET_ADDRESS: optionalEnv('ADMIN_WALLET_ADDRESS', ''),

  // --- Rate Limiting ---
  RATE_LIMIT_AUTH: requireInt('RATE_LIMIT_AUTH', 10),
  RATE_LIMIT_UPLOAD: requireInt('RATE_LIMIT_UPLOAD', 5),
  RATE_LIMIT_AI: requireInt('RATE_LIMIT_AI', 20),
  RATE_LIMIT_TENANT: requireInt('RATE_LIMIT_TENANT', 30),
  RATE_LIMIT_GENERAL: requireInt('RATE_LIMIT_GENERAL', 100),
} as const;

export type Env = typeof env;
