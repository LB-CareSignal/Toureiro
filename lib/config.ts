export interface RedisConfig {
  host: string;
  port: number;
  db: number;
  auth_pass: string | null;
}

export interface RuntimeConfig {
  port: number;
  development: boolean;
  redis: RedisConfig;
}

export interface CliArgs {
  _: Array<string | number>;
  rh?: string;
  rp?: string | number;
  rdb?: string | number;
  pass?: string;
}

function parseNumber(value: string | number | undefined, fallback: number): number {
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function redisConfigFromEnv(env: NodeJS.ProcessEnv, defaults: Partial<RedisConfig> = {}): RedisConfig {
  return {
    host: env.REDIS_HOST || env.TOUREIRO_REDIS_HOST || defaults.host || '127.0.0.1',
    port: parseNumber(env.REDIS_PORT || env.TOUREIRO_REDIS_PORT, defaults.port || 6379),
    db: parseNumber(env.REDIS_DB || env.TOUREIRO_REDIS_DB, defaults.db || 0),
    auth_pass: env.REDIS_PASSWORD || env.REDIS_PASS || env.TOUREIRO_REDIS_PASSWORD || defaults.auth_pass || null
  };
}

export function fromEnv(env: NodeJS.ProcessEnv = process.env, defaults: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    port: parseNumber(env.PORT || env.TOUREIRO_PORT, defaults.port || 3000),
    development: env.TOUREIRO_DEV_STATIC === 'true' || defaults.development === true,
    redis: redisConfigFromEnv(env, defaults.redis)
  };
}

export function fromArgs(argv: CliArgs, env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const config = fromEnv(env);

  if (argv._.length > 0 && !isNaN(parseInt(String(argv._[0]), 10))) {
    config.port = parseInt(String(argv._[0]), 10);
  }
  if (argv.rh) {
    config.redis.host = argv.rh;
  }
  if (argv.rp && !isNaN(parseInt(String(argv.rp), 10))) {
    config.redis.port = parseInt(String(argv.rp), 10);
  }
  if (argv.rdb && !isNaN(parseInt(String(argv.rdb), 10))) {
    config.redis.db = parseInt(String(argv.rdb), 10);
  }
  if (argv.pass) {
    config.redis.auth_pass = argv.pass;
  }

  return config;
}

export default {
  fromArgs,
  fromEnv
};