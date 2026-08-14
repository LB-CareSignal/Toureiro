import appRedis from '../redis';
import Queue from './queue';

type QueueJob = any;
type JobState = 'wait' | 'active' | 'delayed' | 'completed' | 'failed';

async function attachState(job: QueueJob | null): Promise<QueueJob | null> {
  if (!job) {
    return job;
  }
  job.state = await job.getState();
  return job;
}

async function get(qName: string, id: string | number): Promise<QueueJob | null> {
  const queue = Queue.get(qName);
  const job = await queue.getJob(id);
  return attachState(job);
}

async function add(qName: string, data: unknown, opts?: unknown): Promise<QueueJob | null> {
  const queue = Queue.get(qName);
  const job = await queue.add(data, opts);
  return attachState(job);
}

async function remove(qName: string, id: string | number): Promise<void> {
  const queue = Queue.get(qName);
  const job = await queue.getJob(id);
  await job.remove();
}

async function promote(qName: string, id: string | number): Promise<void> {
  const queue = Queue.get(qName);
  const job = await queue.getJob(id);
  await job.promote();
}

function total(qName: string, type: JobState): Promise<number> {
  const client = appRedis.client();
  const key = 'bull:' + qName + ':' + type;

  if (type === 'wait' || type === 'active') {
    return client.llenAsync(key);
  }
  if (type === 'delayed') {
    return client.zcardAsync(key);
  }
  if (type === 'completed' || type === 'failed') {
    return client.scardAsync(key);
  }

  throw new Error('You must provide a valid job type.');
}

async function fetch(qName: string, type: JobState, offset?: number, limit?: number): Promise<Array<QueueJob | null>> {
  const queue = Queue.get(qName);

  const resolvedOffset = offset && offset >= 0 ? offset : 0;
  const resolvedLimit = limit && limit >= 0 ? limit : 30;

  if (type === 'wait' || type === 'active') {
    const jobs = await queue.getJobs(type, 'LIST', resolvedOffset, resolvedOffset + resolvedLimit - 1);
    return Promise.all(jobs.map(attachState));
  }

  if (type === 'delayed') {
    const jobs = await queue.getJobs(type, 'ZSET', resolvedOffset, resolvedOffset + resolvedLimit - 1);
    return Promise.all(jobs.map(attachState));
  }

  const client = appRedis.client();
  const key = 'bull:' + qName + ':' + type;
  const ids = await client.smembersAsync(key);
  const selectedIds = ids.slice(resolvedOffset, resolvedOffset + resolvedLimit);

  return Promise.all(selectedIds.map(async function(id: string) {
    const job = await queue.getJob(id);
    return attachState(job);
  }));
}

export default {
  get,
  add,
  remove,
  promote,
  total,
  fetch
};