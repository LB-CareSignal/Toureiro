import bull from 'bull';
import appRedis from '../redis';

type QueueInstance = any;

const queueCache = new Map<string, QueueInstance>();

function queueConfig() {
  const redisOpts = appRedis.redisOpts || {};
  return {
    redis: {
      host: redisOpts.host,
      port: redisOpts.port,
      DB: redisOpts.db,
      opts: {
        auth_pass: redisOpts.auth_pass
      }
    }
  };
}

async function list(): Promise<string[]> {
  const client = appRedis.client();
  const keys = await client.keysAsync('bull:*:id');
  return keys.map(function(key: string) {
    return key.slice(5, -3);
  });
}

function exists(qName: string): Promise<number | boolean> {
  const client = appRedis.client();
  return client.existsAsync('bull:' + qName + ':id');
}

function total(qName: string): Promise<string | number> {
  const client = appRedis.client();
  return client.getAsync('bull:' + qName + ':id');
}

async function remove(qName: string): Promise<void> {
  if (!qName || qName.length === 0) {
    throw new Error('You must specify a queue name.');
  }

  const client = appRedis.client();
  const keys = await client.keysAsync('bull:' + qName + ':*');
  if (keys.length) {
    await client.delAsync(keys);
  }
}

function get(qName: string): QueueInstance {
  if (!queueCache.has(qName)) {
    queueCache.set(qName, new bull(qName, queueConfig()));
  }
  return queueCache.get(qName);
}

async function close(): Promise<void> {
  const queues = Array.from(queueCache.values());
  queueCache.clear();

  await Promise.all(queues.map(async function(queue) {
    if (queue && queue.close) {
      await queue.close(true);
      return;
    }
    if (queue && queue.disconnect) {
      await queue.disconnect();
    }
  }));
}

export default {
  list,
  exists,
  total,
  remove,
  get,
  close
};