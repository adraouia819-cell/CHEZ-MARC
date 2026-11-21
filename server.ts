import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { getDb } from './src/db/database.ts';
import { publicRouter } from './src/server/routes/publicRoutes.ts';
import { authRouter } from './src/server/routes/authRoutes.ts';
import { adminRouter } from './src/server/routes/adminRoutes.ts';

async function startServer() {
  // Initialize SQLite database & run idempotent migrations + seed
  getDb();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers compatible with iframe preview & HTTPS production
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'casa-style-api' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', publicRouter);

  // Global error handler (sanitized)
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Une erreur interne est survenue.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build introuvable.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`CASA STYLE server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
