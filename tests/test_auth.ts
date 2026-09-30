import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import bull from 'bull';
import request from 'supertest';
import Toureiro from '../lib/toureiro';
import Queue from '../lib/models/queue';
import appRedis from '../lib/redis';

// Set REDIS_SERVER to a redis-server binary when it is not on the PATH.
const redisServerBin = process.env.REDIS_SERVER || 'redis-server';
const port = 6390 + Math.floor(Math.random() * 100);
const password = 'toureiro-test-secret';
const queueName = 'auth';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

// Auth failures are logged by the redis error listeners and the routes, which is only noise here.
async function withoutLogs<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  const error = console.error;
  console.log = function() {};
  console.error = function() {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
}

function app(auth: { auth_pass?: string | null; password?: string }) {
  return Toureiro({
    redis: {
      host: '127.0.0.1',
      port,
      db: 0,
      ...auth
    }
  });
}

async function resetToureiro(): Promise<void> {
  await Promise.all([
    Queue.close(),
    appRedis.close().catch(function() {})
  ]);
}

describe('Redis Auth', function() {
  let server: ChildProcess | undefined;
  let seedQueue: any;

  before(async function() {
    this.timeout(10000);
    server = spawn(redisServerBin, ['--port', String(port), '--requirepass', password, '--save', '', '--appendonly', 'no'], {
      stdio: 'ignore'
    });
    const spawned = await new Promise<boolean>((resolve) => {
      server!.once('error', () => resolve(false));
      server!.once('spawn', () => resolve(true));
    });
    if (!spawned) {
      server = undefined;
      this.skip();
    }
    while (!(await canConnect())) {
      await delay(50);
    }

    seedQueue = new (bull as any)(queueName, {
      redis: { host: '127.0.0.1', port, DB: 0, opts: { password } }
    });
    seedQueue.process(function() {
      throw new Error('doomed!');
    });
    await seedQueue.add({ foo: 'bar' });
    await delay(500);
  });

  afterEach(async function() {
    await withoutLogs(resetToureiro);
  });

  after(async function() {
    if (seedQueue) {
      await seedQueue.close(true);
    }
    if (server) {
      server.kill();
    }
  });

  [
    ['auth_pass', { auth_pass: password }],
    ['password', { password }]
  ].forEach(function([name, auth]) {
    it('should read bull queues with ' + name, async function() {
      const toureiro = app(auth as any);

      const fetched = await request(toureiro).get('/job/fetch/failed/').query({ queue: queueName }).expect(200);
      assert.equal(fetched.body.status, 'OK');
      assert.equal(fetched.body.jobs.length, 1);

      const job = await request(toureiro).get('/job/').query({ queue: queueName, id: fetched.body.jobs[0].id }).expect(200);
      assert.equal(job.body.status, 'OK');
      assert.equal(job.body.job.state, 'failed');
    });
  });

  [
    ['a wrong password', { auth_pass: 'wrong' }, /WRONGPASS|invalid password/],
    ['no password', { auth_pass: null }, /NOAUTH/]
  ].forEach(function([name, auth, message]) {
    it('should fail cleanly with ' + name, async function() {
      const toureiro = app(auth as any);

      await withoutLogs(async function() {
        for (const path of ['/queue/list/', '/job/fetch/failed/', '/job/']) {
          const res = await request(toureiro).get(path).query({ queue: queueName, id: 1 }).timeout(2000).expect(200);
          assert.equal(res.body.status, 'FAIL', path);
          assert.match(res.body.message, message as RegExp, path);
        }

        const res = await request(toureiro)
          .post('/job/remove')
          .send({ queue: queueName, id: 1 })
          .timeout(2000)
          .expect(200);
        assert.equal(res.body.status, 'FAIL');
      });
    });
  });

});
