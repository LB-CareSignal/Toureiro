import path from 'node:path';
import fs from 'node:fs';
import express, { type Express, type Request, type Response } from 'express';
import bodyParser from 'body-parser';
import slashes from 'connect-slashes';
import appRedis, { type RedisOptions } from './redis';
import queueRoutes from './routes/queue';
import jobRoutes from './routes/job';

export interface ToureiroConfig {
  development?: boolean;
  readonly?: boolean;
  redis?: RedisOptions;
}

const mutationPaths = ['/job/remove', '/job/promote', '/job/rerun'];

function resolveAssetPath(paths: string[]): string {
  for (const relativePath of paths) {
    const resolvedPath = path.join(__dirname, relativePath);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // Fallback to the first candidate to preserve previous behavior if assets are unexpectedly missing.
  return path.join(__dirname, paths[0]);
}

export default function toureiro(config: ToureiroConfig = {}): Express {
  appRedis.init(config.redis || {});
  const readonly = config.readonly === true;

  const app = express();

  app.use(bodyParser.urlencoded({
    extended: false
  }));
  app.use(bodyParser.json());

  const viewsPath = resolveAssetPath([
    '../views/templates',
    '../../views/templates'
  ]);
  const staticPath = resolveAssetPath([
    '../public',
    '../../public'
  ]);

  app.set('views', viewsPath);
  app.set('view engine', 'pug');

  app.use('/static', express.static(staticPath));

  app.use(slashes());

  app.all('/', function(req: Request, res: Response) {
    res.render('index', { readonly });
  });

  if (readonly) {
    app.use(mutationPaths, function(req: Request, res: Response) {
      res.status(403).json({
        status: 'FAIL',
        message: 'Toureiro is running in readonly mode.'
      });
    });
  }

  app.use('/queue', queueRoutes);
  app.use('/job', jobRoutes);

  app.use('*', function(req: Request, res: Response) {
    // Catch all
    res.sendStatus(404);
  });

  return app;
}