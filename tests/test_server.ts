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
const { cleanSlate, buildQueue } = bullContext;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  });

});