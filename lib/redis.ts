import { promisify } from 'node:util';
import redis from 'redis';

export interface RedisOptions {
  host?: string;
  port?: number;
  db?: number;
  auth_pass?: string | null;
  // Alias for auth_pass, matching the option name ioredis uses.
  password?: string | null;
}

type RedisClient = any;
type RedisMulti = any;

const asyncMethods = [
  'del',
  'exists',
  'get',
  'keys',
  'llen',
  'quit',
  'scard',
  'select',
  'smembers',
  'zcard'
];

function attachAsyncMethods(client: RedisClient): RedisClient {
  asyncMethods.forEach(function(method) {
    if (client[method] && !client[method + 'Async']) {
      client[method + 'Async'] = promisify(client[method]).bind(client);
    }
  });
  return client;
}

const state: {
  client?: RedisClient;
  options?: RedisOptions;
  authError?: Error;
} = {};

const authErrorPattern = /NOAUTH|WRONGPASS|invalid password/i;

// Treats a missing, null, or empty password as "no password".
export function redisPassword(opts: RedisOptions = {}): string | undefined {
  return opts.auth_pass || opts.password || undefined;
}

function init(opts: RedisOptions = {}): void {
  const { password, ...clientOpts } = opts;
  const newClient = attachAsyncMethods(redis.createClient({
    ...clientOpts,
    auth_pass: redisPassword(opts)
  }));
  state.client = newClient;
  state.options = opts;
  state.authError = undefined;

  // Without a listener, a connection or auth error would crash the host process.
  newClient.on('error', function(err: Error) {
    console.error('Toureiro redis error:', err.message);
    // A rejected password never recovers, and the client would hold queued commands forever.
    if (authErrorPattern.test(err.message) && state.client === newClient) {
      state.authError = err;
      newClient.flush_and_error(err);
    }
  });
  newClient.on('ready', function() {
    if (state.client === newClient) {
      state.authError = undefined;
    }
  });

  if (opts.db !== undefined) {
    // Failures are already reported by the error listener.
    newClient.selectAsync(opts.db).catch(function() {});
  }
}

function client(): RedisClient {
  if (!state.client) {
    throw new Error('Redis client is not initialized.');
  }
  if (state.authError) {
    throw state.authError;
  }
  return state.client;
}

async function close(): Promise<void> {
  if (!state.client) {
    return;
  }
  const currentClient = state.client;
  const authError = state.authError;
  state.client = undefined;
  state.options = undefined;
  state.authError = undefined;
  if (authError) {
    // QUIT would be held forever on a connection that never authenticated.
    currentClient.end(true);
    return;
  }
  await currentClient.quitAsync();
}

function multi(): RedisMulti {
  const redisClient = client();
  const redisMulti = redisClient.multi();
  redisMulti.execAsync = promisify(redisMulti.exec).bind(redisMulti);
  return redisMulti;
}

const redisModule = {
  init,
  client,
  close,
  multi,
  get redisOpts(): RedisOptions | undefined {
    return state.options;
  }
};

export default redisModule;