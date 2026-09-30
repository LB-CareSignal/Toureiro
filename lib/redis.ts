import { promisify } from 'node:util';
import redis from 'redis';

export interface RedisOptions {
  host?: string;
  port?: number;
  db?: number;
  auth_pass?: string | null;
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
} = {};

function init(opts: RedisOptions = {}): void {
  state.client = attachAsyncMethods(redis.createClient(opts));
  if (opts.db !== undefined) {
    state.client.selectAsync(opts.db);
  }
  state.options = opts;
}

function client(): RedisClient {
  if (!state.client) {
    throw new Error('Redis client is not initialized.');
  }
  return state.client;
}

async function close(): Promise<void> {
  if (!state.client) {
    return;
  }
  const currentClient = state.client;
  state.client = undefined;
  state.options = undefined;
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