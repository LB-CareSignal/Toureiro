import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import bodyParser from 'body-parser';
import slashes from 'connect-slashes';
import appRedis, { type RedisOptions } from './redis';
import queueRoutes from './routes/queue';
import jobRoutes from './routes/job';

export interface ToureiroConfig {
  development?: boolean;
  redis?: RedisOptions;
}

export default function toureiro(config: ToureiroConfig = {}): Express {
  appRedis.init(config.redis || {});

  const app = express();

  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(bodyParser.json());

  app.set('views', path.join(__dirname, '../views/templates'));
  app.set('view engine', 'pug');

  app.use('/static', express.static(path.join(__dirname, '../public')));

  app.use(slashes());

  app.all('/', function(req: Request, res: Response) {
    res.render('index');
  });
  app.use('/queue', queueRoutes);
  app.use('/job', jobRoutes);

  app.use('*', function(req: Request, res: Response) {
    // Catch all
    res.sendStatus(404);
  });

  return app;
}