import { z } from 'zod';

/**
 * Environment Variable Schema with Validation
 * This ensures all required environment variables are set before the server starts
 */
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Database (Required)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // Redis (Optional - required for horizontal scaling)
  REDIS_URL: z.string().url().optional(),

  // JWT Secret (REQUIRED - no fallback for security)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),

  // Somnia Testnet
  SOMNIA_TESTNET_RPC_URL: z.string().url().default('https://dream-rpc.somnia.network'),
  SOMNIA_TESTNET_WS_URL: z.string().url().default('wss://dream-rpc.somnia.network/ws'),

  // Somnia Mainnet
  SOMNIA_MAINNET_RPC_URL: z.string().url().default('https://api.infra.mainnet.somnia.network'),
  SOMNIA_MAINNET_WS_URL: z.string().url().default('wss://api.infra.mainnet.somnia.network/ws'),

  // LLM Validation Webhook (Required)
  LLM_WEBHOOK_URL: z.string().url('LLM_WEBHOOK_URL must be a valid URL'),

  // Frontend URL (Required for CORS)
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

  // Optional Configuration
  INSTANCE_ID: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables on startup
 * Fails fast if required variables are missing or invalid
 */
function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      console.error('━'.repeat(60));

      error.errors.forEach(err => {
        const path = err.path.join('.');
        console.error(`  ✗ ${path}: ${err.message}`);
      });

      console.error('━'.repeat(60));
      console.error('\n📋 Required environment variables:');
      console.error('  - DATABASE_URL (PostgreSQL connection string)');
      console.error('  - JWT_SECRET (min 32 characters - generate with: openssl rand -base64 32)');
      console.error('  - LLM_WEBHOOK_URL (N8N webhook URL for LLM validation)');
      console.error('  - FRONTEND_URL (Frontend application URL for CORS)');
      console.error('\n💡 Copy .env.example to .env and fill in the values\n');

      process.exit(1);
    }
    throw error;
  }
}

// Export validated environment variables
export const env = validateEnv();
