import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { listRoutes } from '../common/utils/routeIntrospect.js';

const router = Router();
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '../../package.json'), 'utf8'));

router.get('/routes', (req, res, next) => {
  try {
    const app = req.app;
    const routes = listRoutes(app);
    res.json({
      success: true,
      message: 'OK',
      data: {
        name: pkg.name,
        version: pkg.version,
        count: routes.length,
        routes
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
