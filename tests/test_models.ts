import assert from 'node:assert/strict';
import createBullContext from './helpers/bull_context';
import appRedis from '../lib/redis';
import Queue from '../lib/models/queue';
import Job from '../lib/models/job';

const bullContext = createBullContext();
const { client, cleanSlate, createQueue, buildQueue, resetData } = bullContext;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function expectJobsToHaveIds(jobs: any[], ids: number[]): void {
  jobs.forEach((job) => {
    assert.notEqual(ids.indexOf(parseInt(job.jobId, 10)), -1);
  });
}

describe('Models', function() {

  before(function() {
    appRedis.init({});
  });

  after(async function() {
    await Promise.all([
      bullContext.close(),
      Queue.close(),
      appRedis.close()
    ]);
  });

  describe('Queue', function() {

    beforeEach(async function() {
      await resetData();
    });

    it('#list()', async function() {
      const keys = await Queue.list();
      assert.equal(Array.isArray(keys), true);
      assert.equal(keys.length, 6);
    });

    it('#total()', async function() {
      const total = await Queue.total('test queue');
      assert.equal(parseInt(String(total), 10), 20);
    });

    it('#remove()', async function() {
      await Queue.remove('test queue');
      const keys = await client.keysAsync('bull:test queue:*');
      assert.equal(keys.length, 0);
    });

  });

  describe('Job', function() {

    it('#get()', async function() {
      await buildQueue('job');
      const job = await Job.get('job', 1);
      assert.ok(job);
      assert.equal(job.jobId, 1);
    });

    it('#remove()', async function() {
      await buildQueue('job');
      await Job.remove('job', 1);
      const job = await Job.get('job', 1);
      assert.ok(!job);
    });

    describe('`wait`', function() {

      beforeEach(async function() {
        await cleanSlate();
        await buildQueue('wait');
      });

      it('#total()', async function() {
        const total = await Job.total('wait', 'wait');
        assert.equal(total, 20);
      });

      it('#fetch()', async function() {
        const jobs = await Job.fetch('wait', 'wait', 5, 7);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 7);
        expectJobsToHaveIds(jobs, [15, 14, 13, 12, 11, 10, 9]);
      });

    });

    describe('`active`', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = await buildQueue('active');
        await Promise.all([
          queue.getNextJob(),
          queue.getNextJob(),
          queue.getNextJob(),
          queue.getNextJob(),
          queue.getNextJob()
        ]);
      });

      it('#total()', async function() {
        const total = await Job.total('active', 'active');
        assert.equal(total, 5);
      });

      it('#fetch()', async function() {
        const jobs = await Job.fetch('active', 'active', 1, 3);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 3);
        expectJobsToHaveIds(jobs, [2, 3, 4]);
      });

    });

    describe('`delayed`', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = createQueue('delayed');
        const jobs = [];
        for (let i = 0; i < 10; i++) {
          jobs.push(queue.add({
            foo: 'bar'
          }, {
            delay: 1000 + i * 10
          }));
        }
        await Promise.all(jobs);
      });

      it('#total()', async function() {
        const total = await Job.total('delayed', 'delayed');
        assert.equal(total, 10);
      });

      it('#fetch()', async function() {
        const jobs = await Job.fetch('delayed', 'delayed', 0, 4);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 4);
        expectJobsToHaveIds(jobs, [1, 2, 3, 4]);
      });

    });

    describe('`completed`', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = await buildQueue('completed');
        queue.process(function() {});
        await delay(100);
      });

      it('#total()', async function() {
        const total = await Job.total('completed', 'completed');
        assert.equal(total, 20);
      });

      it('#fetch()', async function() {
        const jobs = await Job.fetch('completed', 'completed', 1, 5);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 5);
        expectJobsToHaveIds(jobs, [2, 3, 4, 5, 6]);
      });

    });

    describe('`failed`', function() {

      beforeEach(async function() {
        await cleanSlate();
        const queue = await buildQueue('failed');
        queue.process(function() {
          throw new Error('Doomed!');
        });
        await delay(100);
      });

      it('#total()', async function() {
        const total = await Job.total('failed', 'failed');
        assert.equal(total, 20);
      });

      it('#fetch()', async function() {
        const jobs = await Job.fetch('failed', 'failed', 3, 7);
        assert.equal(Array.isArray(jobs), true);
        assert.equal(jobs.length, 7);
        expectJobsToHaveIds(jobs, [4, 5, 6, 7, 8, 9, 10]);
      });

    });

  });

});