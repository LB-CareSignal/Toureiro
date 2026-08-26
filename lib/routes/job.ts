import express, { type Request, type Response } from 'express';
import Queue from '../models/queue';
import Job from '../models/job';

const router = express.Router();

router.all('/', async function(req: Request, res: Response) {
  const qName = req.query.queue as string;
  const id = req.query.id as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    const job = await Job.get(qName, id);
    if (job) {
      const data = job.toData();
      data.id = job.jobId;
      data.state = job.state;
      res.json({
        status: 'OK',
        job: data
      });
      return;
    }

    res.json({
      status: 'FAIL',
      message: 'The job does not exist.'
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/remove', async function(req: Request, res: Response) {
  const qName = req.body.queue as string;
  const id = req.body.id as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    await Job.remove(qName, id);
    res.json({
      status: 'OK'
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/promote', async function(req: Request, res: Response) {
  const qName = req.body.queue as string;
  const id = req.body.id as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    await Job.promote(qName, id);
    res.json({
      status: 'OK'
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/rerun', async function(req: Request, res: Response) {
  const qName = req.body.queue as string;
  const id = req.body.id as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    const job = await Job.get(qName, id);
    if (job) {
      if (job.state !== 'completed' && job.state !== 'failed') {
        res.json({
          status: 'FAIL',
          message: 'Cannot rerun a job that is not completed or failed.'
        });
        return;
      }

      const jobData: any = job.toData();
      const opts: any = typeof jobData.opts === 'string' ? JSON.parse(jobData.opts) : (jobData.opts || {});
      if (opts && typeof opts === 'object' && opts.delay) {
        delete opts.delay;
      }

      const rerunData = typeof jobData.data === 'string' ? JSON.parse(jobData.data) : jobData.data;
      const rerunJob = await Job.add(qName, rerunData, opts);
      if (!rerunJob) {
        throw new Error('Failed to rerun job.');
      }

      const data = rerunJob.toData();
      data.id = rerunJob.jobId;
      data.state = rerunJob.state;
      res.json({
        status: 'OK',
        job: data
      });
      return;
    }

    res.json({
      status: 'FAIL',
      message: 'The job does not exist.'
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/total/:type(((wait)|(active)|(delayed)|(completed)|(failed)))', async function(req: Request, res: Response) {
  const qName = req.query.queue as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    const total = await Job.total(qName, req.params.type as any);
    res.json({
      status: 'OK',
      total: total
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/fetch/:type(((wait)|(active)|(delayed)|(completed)|(failed)))', async function(req: Request, res: Response) {
  let page = 0;
  if (req.query.page) {
    page = parseInt(String(req.query.page), 10);
  }

  let limit = 30;
  if (req.query.limit) {
    limit = parseInt(String(req.query.limit), 10);
  }

  const qName = req.query.queue as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    const jobs = await Job.fetch(qName, req.params.type as any, page * limit, limit);
    const queueJobs = [];

    for (const job of jobs) {
      if (job && job.toData) {
        const data = job.toData();
        data.id = job.jobId;
        data.state = job.state;
        queueJobs.push(data);
      } else {
        console.log('Job appears corrupt:', job);
      }
    }

    const total = await Job.total(qName, req.params.type as any);
    res.json({
      status: 'OK',
      jobs: queueJobs,
      total: total,
      page: page,
      limit: limit
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

export default router;