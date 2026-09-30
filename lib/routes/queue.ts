import express, { type Request, type Response } from 'express';
import Queue from '../models/queue';
import Job from '../models/job';

const router = express.Router();

router.all('/', async function(req: Request, res: Response) {
  const qName = req.query.name as string;

  try {
    const result = await Queue.exists(qName);
    if (!result) {
      res.json({
        status: 'FAIL',
        message: 'The queue does not exist.'
      });
      return;
    }

    const results = await Promise.all([
      Queue.total(qName),
      Job.total(qName, 'wait'),
      Job.total(qName, 'active'),
      Job.total(qName, 'delayed'),
      Job.total(qName, 'completed'),
      Job.total(qName, 'failed')
    ]);

    const jobData = {
      total: results[0],
      wait: results[1],
      active: results[2],
      delayed: results[3],
      completed: results[4],
      failed: results[5]
    };

    res.json({
      status: 'OK',
      queue: {
        name: qName,
        stats: jobData
      }
    });
  } catch (err: any) {
    console.log(err.stack);
    res.json({
      status: 'FAIL',
      message: err.message
    });
  }
});

router.all('/list', async function(req: Request, res: Response) {
  try {
    const queues = await Queue.list();
    res.json({
      status: 'OK',
      queues: queues
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