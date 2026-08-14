import bull from 'bull';
import redis from 'redis';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

type RedisClient = any;
type BullQueue = any;

interface BullContextOptions {
  host?: string;
  port?: number;
  db?: number;
  auth_pass?: string | null;
}

function attachAsyncMethods(client: RedisClient): RedisClient {
  ['del', 'keys', 'quit', 'select'].forEach((method) => {
    if (client[method] && !client[`${method}Async`]) {
      client[`${method}Async`] = promisify(client[method]).bind(client);
    }
  });
  return client;
}

async function closeQueue(queue: BullQueue): Promise<void> {
  if (queue && queue.close) {
    await queue.close(true);
    return;
  }
  if (queue && queue.disconnect) {
    await queue.disconnect();
  }
}

export default function createBullContext(redisOptions: BullContextOptions = {}) {
  const queues: BullQueue[] = [];
  const client = attachAsyncMethods(redis.createClient(redisOptions));
  const ready = redisOptions.db ? client.selectAsync(redisOptions.db) : Promise.resolve();

  function queueOptions() {
    return {
      redis: {
        host: redisOptions.host || '127.0.0.1',
        port: redisOptions.port || 6379,
        DB: redisOptions.db || 0,
        opts: {
          auth_pass: redisOptions.auth_pass || null
        }
      }
    };
  }

  async function cleanSlate(): Promise<void> {
    await ready;
    const keys = await client.keysAsync('bull:*');
    if (keys.length) {
      await client.delAsync(keys);
    }
  }

  function createQueue(name: string): BullQueue {
    const queue = new bull(name, queueOptions());
    queues.push(queue);
    return queue;
  }

  async function buildQueue(name: string = randomUUID()): Promise<BullQueue> {
    const queue = createQueue(name);
    const jobs = [];
    for (let i = 0; i < 20; i++) {
      jobs.push(queue.add({
        foo: 'bar'
      }));
    }
    await Promise.all(jobs);
    return queue;
  }

  async function resetData(): Promise<void> {
    await cleanSlate();
    const queuesToBuild = [];
    for (let i = 0; i < 5; i++) {
      queuesToBuild.push(buildQueue());
    }
    queuesToBuild.push(buildQueue('test queue'));
    await Promise.all(queuesToBuild);
  }

  async function close(): Promise<void> {
    const openedQueues = queues.splice(0);
    await ready;
    await Promise.all(openedQueues.map(closeQueue));
    await client.quitAsync();
  }

  return {
    buildQueue,
    cleanSlate,
    close,
    createQueue,
    resetData,
    client
  };
}