import assert from 'node:assert/strict';
import request from 'supertest';
import createBullContext from './helpers/bull_context';
import Toureiro from '../lib/toureiro';
import Queue from '../lib/models/queue';
import Job from '../lib/models/job';
import appRedis from '../lib/redis';

const bullContext = createBullContext({
  db: 7
});
const { cleanSlate, createQueue, buildQueue } = bullContext;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Routes log the stack of any error they return, which is only noise when a test expects the error.
async function withoutLogs<T>(fn: () => Promise<T>): Promise<T> {
  const log = console.log;
  console.log = function() {};
  try {
    return await fn();
  } finally {
    console.log = log;
  }
}

describe('Server', function() {
  let app: ReturnType<typeof Toureiro>;

  before(function() {
    app = Toureiro({
      redis: {
        db: 7
      }
    });
  });

  after(async function() {
    await Promise.all([
      bullContext.close(),
      Queue.close(),
      appRedis.close()
    ]);
  });

  describe('Rerun Job', function() {

    describe('Completed', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = await buildQueue('rerun-completed');
        queue.process(function() {});
        await delay(1000);
      });

      it('should be able to rerun completed jobs', async function() {
        const jobs = await Job.fetch('rerun-completed', 'completed', 0, 1);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 1);
        const job = jobs[0];

        const res = await request(app)
          .post('/job/rerun')
          .set('Accept', 'application/json')
          .send({
            queue: 'rerun-completed',
            id: job.jobId
          })
          .expect(200);

        assert.equal(res.body.status, 'OK');
        assert.ok(res.body.job);
        assert.notEqual(res.body.job.id, job.jobId);

        await delay(500);
        const rerunJob = await Job.get('rerun-completed', res.body.job.id);
        assert.ok(rerunJob);
        assert.equal(rerunJob.state, 'completed');
      });

    });

    describe('Failed', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = await buildQueue('rerun-failed');
        queue.process(function(job: any) {
          if (job.jobId <= 20) {
            throw new Error('doomed!');
          }
        });
        await delay(1000);
      });

      it('should be able to rerun failed jobs', async function() {
        const jobs = await Job.fetch('rerun-failed', 'failed', 0, 1);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 1);
        const job = jobs[0];

        const res = await request(app)
          .post('/job/rerun')
          .set('Accept', 'application/json')
          .send({
            queue: 'rerun-failed',
            id: job.jobId
          })
          .expect(200);

        assert.equal(res.body.status, 'OK');
        assert.ok(res.body.job);
        assert.notEqual(res.body.job.id, job.jobId);

        await delay(500);
        const rerunJob = await Job.get('rerun-failed', res.body.job.id);
        assert.ok(rerunJob);
        assert.equal(rerunJob.state, 'completed');
      });

    });

    describe('Remove On Complete', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = createQueue('rerun-remove-on-complete');
        await queue.add({ foo: 'bar' }, { removeOnComplete: true });
        let attempts = 0;
        queue.process(function() {
          attempts++;
          if (attempts === 1) {
            throw new Error('doomed!');
          }
        });
        await delay(1000);
      });

      it('should remove a rerun job on completion when its options say so', async function() {
        const jobs = await Job.fetch('rerun-remove-on-complete', 'failed', 0, 1);
        assert.equal(jobs.length, 1);
        const job = jobs[0];

        const res = await request(app)
          .post('/job/rerun')
          .set('Accept', 'application/json')
          .send({
            queue: 'rerun-remove-on-complete',
            id: job.jobId
          })
          .expect(200);

        assert.equal(res.body.status, 'OK');

        await delay(500);
        const rerunJob = await Job.get('rerun-remove-on-complete', res.body.job.id);
        assert.equal(rerunJob, null);
        assert.equal(await Job.total('rerun-remove-on-complete', 'completed'), 0);
        assert.equal(await Job.total('rerun-remove-on-complete', 'failed'), 1);
      });

    });

  });

  describe('Promote Job', function() {

    beforeEach(async function() {
      await cleanSlate();
      const queue = createQueue('promote');
      await queue.add({ foo: 'bar' }, { delay: 60000 });
      await queue.add({ foo: 'baz' });
    });

    it('should move a delayed job to wait', async function() {
      const jobs = await Job.fetch('promote', 'delayed', 0, 1);
      assert.equal(jobs.length, 1);
      const job = jobs[0];

      const res = await request(app)
        .post('/job/promote')
        .set('Accept', 'application/json')
        .send({
          queue: 'promote',
          id: job.jobId
        })
        .expect(200);

      assert.equal(res.body.status, 'OK');
      const promotedJob = await Job.get('promote', job.jobId);
      assert.equal(promotedJob.state, 'waiting');
      assert.equal(await Job.total('promote', 'delayed'), 0);
      assert.equal(await Job.total('promote', 'wait'), 2);
    });

    it('should refuse to promote a job that is not delayed', async function() {
      const jobs = await Job.fetch('promote', 'wait', 0, 1);
      assert.equal(jobs.length, 1);

      const res = await withoutLogs(() => request(app)
        .post('/job/promote')
        .set('Accept', 'application/json')
        .send({
          queue: 'promote',
          id: jobs[0].jobId
        })
        .expect(200));

      assert.equal(res.body.status, 'FAIL');
      assert.match(res.body.message, /not in a delayed state/);
    });

  });

  describe('Remove Job', function() {

    beforeEach(async function() {
      await cleanSlate();
      await buildQueue('remove');
    });

    it('should remove a job', async function() {
      const res = await request(app)
        .post('/job/remove')
        .set('Accept', 'application/json')
        .send({
          queue: 'remove',
          id: 1
        })
        .expect(200);

      assert.equal(res.body.status, 'OK');
      assert.equal(await Job.get('remove', 1), null);
      assert.equal(await Job.total('remove', 'wait'), 19);
    });

    it('should fail to remove a job that does not exist', async function() {
      const res = await withoutLogs(() => request(app)
        .post('/job/remove')
        .set('Accept', 'application/json')
        .send({
          queue: 'remove',
          id: 999
        })
        .expect(200));

      assert.equal(res.body.status, 'FAIL');
      assert.equal(res.body.message, 'The job does not exist.');
    });

  });

  describe('Read Routes', function() {

    before(async function() {
      await cleanSlate();
      await buildQueue('read');
    });

    it('should list queues', async function() {
      const res = await request(app).get('/queue/list/').expect(200);
      assert.equal(res.body.status, 'OK');
      assert.deepEqual(res.body.queues, ['read']);
    });

    it('should return queue stats', async function() {
      const res = await request(app).get('/queue/').query({ name: 'read' }).expect(200);
      assert.equal(res.body.status, 'OK');
      assert.equal(res.body.queue.name, 'read');
      assert.equal(parseInt(res.body.queue.stats.total, 10), 20);
      assert.equal(res.body.queue.stats.wait, 20);
      assert.equal(res.body.queue.stats.delayed, 0);
    });

    it('should fail for a queue that does not exist', async function() {
      const res = await request(app).get('/queue/').query({ name: 'missing' }).expect(200);
      assert.equal(res.body.status, 'FAIL');
      assert.equal(res.body.message, 'The queue does not exist.');
    });

    it('should return a job', async function() {
      const res = await request(app).get('/job/').query({ queue: 'read', id: 3 }).expect(200);
      assert.equal(res.body.status, 'OK');
      assert.equal(String(res.body.job.id), '3');
      assert.equal(res.body.job.state, 'waiting');
    });

    it('should return a job total', async function() {
      const res = await request(app).get('/job/total/wait/').query({ queue: 'read' }).expect(200);
      assert.equal(res.body.status, 'OK');
      assert.equal(res.body.total, 20);
    });

    it('should fetch a page of jobs', async function() {
      const res = await request(app).get('/job/fetch/wait/').query({ queue: 'read', page: 1, limit: 5 }).expect(200);
      assert.equal(res.body.status, 'OK');
      assert.equal(res.body.jobs.length, 5);
      assert.equal(res.body.total, 20);
      assert.equal(res.body.page, 1);
      assert.equal(res.body.limit, 5);
    });

  });

  describe('Readonly Mode', function() {
    let readonlyApp: ReturnType<typeof Toureiro>;

    before(async function() {
      readonlyApp = Toureiro({
        readonly: true,
        redis: {
          db: 7
        }
      });
      await cleanSlate();
      const queue = createQueue('readonly');
      await queue.add({ foo: 'bar' }, { delay: 60000 });
    });

    it('should tell the UI it is readonly', async function() {
      // The first render compiles the pug template.
      this.timeout(10000);
      const res = await request(readonlyApp).get('/').expect(200);
      assert.match(res.text, /data-readonly="true"/);

      const writable = await request(app).get('/').expect(200);
      assert.match(writable.text, /data-readonly="false"/);
    });

    ['remove', 'promote', 'rerun'].forEach(function(action) {
      it('should reject ' + action, async function() {
        const res = await request(readonlyApp)
          .post('/job/' + action)
          .set('Accept', 'application/json')
          .send({
            queue: 'readonly',
            id: 1
          })
          .expect(403);

        assert.equal(res.body.status, 'FAIL');
        assert.equal(res.body.message, 'Toureiro is running in readonly mode.');
      });
    });

    it('should leave the job untouched', async function() {
      const job = await Job.get('readonly', 1);
      assert.ok(job);
      assert.equal(job.state, 'delayed');
    });

    it('should still serve read routes', async function() {
      const res = await request(readonlyApp).get('/job/').query({ queue: 'readonly', id: 1 }).expect(200);
      assert.equal(res.body.status, 'OK');
      assert.equal(res.body.job.state, 'delayed');
    });

  });

});
