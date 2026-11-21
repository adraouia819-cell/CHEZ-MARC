import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../../db/database.ts';
import {
  createRateLimiter,
  hashPassword,
  parseCookies,
  requireAuth,
  resetRateLimit,
  sanitizeText,
  sha256Hex,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshTokenFormat,
  writeAuditLog,
  type AuthenticatedRequest,
} from '../security.ts';

export const authRouter = Router();

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  keyFn: (req) => {
    const id = sanitizeText(req.body?.username || req.body?.email || 'anon', 80).toLowerCase();
    return `login:${req.ip}:${id}`;
  },
  message: 'Trop de tentatives de connexion échouées. Compte temporairement verrouillé pendant 15 minutes.',
});

function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const common = `HttpOnly; Path=/; ${isHttps ? 'Secure; SameSite=None;' : 'SameSite=Lax;'}`;
  res.setHeader('Set-Cookie', [
    `cs_access_token=${encodeURIComponent(accessToken)}; Max-Age=900; ${common}`,
    `cs_refresh_token=${encodeURIComponent(refreshToken)}; Max-Age=604800; ${common}`,
  ]);
}

function clearAuthCookies(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const common = `HttpOnly; Path=/; Max-Age=0; ${isHttps ? 'Secure; SameSite=None;' : 'SameSite=Lax;'}`;
  res.setHeader('Set-Cookie', [
    `cs_access_token=; ${common}`,
    `cs_refresh_token=; ${common}`,
  ]);
}

function issueSession(
  req: Request,
  res: Response,
  user: {
    id: number;
    username: string;
    email: string;
    full_name: string;
    phone: string;
    role_name: string;
    must_change_password: number;
  }
) {
  const db = getDb();
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role_name,
    mustChangePassword: Boolean(user.must_change_password),
  });

  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    user.id,
    sha256Hex(refreshToken),
    expiresAt
  );

  setAuthCookies(req, res, accessToken, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role_name,
      mustChangePassword: Boolean(user.must_change_password),
    },
  };
}

authRouter.post('/admin/login', loginRateLimiter, (req, res) => {
  const db = getDb();
  const username = sanitizeText(req.body?.username, 80);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d’utilisateur et mot de passe requis.' });
  }

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ? AND u.is_active = 1`
    )
    .get(username) as
    | {
        id: number;
        username: string;
        email: string;
        password_hash: string;
        full_name: string;
        phone: string;
        role_name: string;
        must_change_password: number;
      }
    | undefined;

  if (!user || (user.role_name !== 'admin' && user.role_name !== 'manager') || !verifyPassword(password, user.password_hash)) {
    writeAuditLog(db, {
      actorUsername: username || 'unknown',
      action: 'ADMIN_LOGIN_FAILED',
      entityType: 'auth',
      ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Identifiants administrateur invalides.' });
  }

  resetRateLimit(`login:${req.ip}:${username.toLowerCase()}`);

  const session = issueSession(req, res, user);
  writeAuditLog(db, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'auth',
    entityId: user.id,
    ipAddress: req.ip,
  });

  return res.json(session);
});

authRouter.post('/customer/register', (req, res) => {
  const db = getDb();
  const fullName = sanitizeText(req.body?.full_name, 120);
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const phone = sanitizeText(req.body?.phone, 40);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName || !email || !phone || password.length < 8) {
    return res.status(400).json({ error: 'Nom, e-mail, téléphone et mot de passe (8 caractères min.) requis.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR username = ?').get(email, email);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
  }

  const customerRole = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get() as { id: number };
  const passwordHash = hashPassword(password);

  const userId = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, role_id, full_name, phone, must_change_password, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
    )
    .run(email, email, passwordHash, customerRole.id, fullName, phone).lastInsertRowid as number;

  const existingCustomer = db.prepare('SELECT id FROM customers WHERE LOWER(email) = ?').get(email) as { id: number } | undefined;
  if (existingCustomer) {
    db.prepare('UPDATE customers SET user_id = ?, full_name = ?, phone = ? WHERE id = ?').run(
      userId,
      fullName,
      phone,
      existingCustomer.id
    );
  } else {
    db.prepare('INSERT INTO customers (user_id, full_name, email, phone, city) VALUES (?, ?, ?, ?, ?)').run(
      userId,
      fullName,
      email,
      phone,
      'Casablanca'
    );
  }

  const session = issueSession(req, res, {
    id: userId,
    username: email,
    email,
    full_name: fullName,
    phone,
    role_name: 'customer',
    must_change_password: 0,
  });

  return res.status(201).json(session);
});

authRouter.post('/customer/login', loginRateLimiter, (req, res) => {
  const db = getDb();
  const email = sanitizeText(req.body?.email, 140).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail et mot de passe requis.' });
  }

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = ? AND u.is_active = 1`
    )
    .get(email) as
    | {
        id: number;
        username: string;
        email: string;
        password_hash: string;
        full_name: string;
        phone: string;
        role_name: string;
        must_change_password: number;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' });
  }

  resetRateLimit(`login:${req.ip}:${email}`);
  const session = issueSession(req, res, user);
  return res.json(session);
});

authRouter.post('/refresh', (req, res) => {
  const db = getDb();
  const cookies = parseCookies(req.headers.cookie);
  const rawToken =
    (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null) || cookies.cs_refresh_token;

  if (!rawToken) {
    return res.status(401).json({ error: 'Jeton de rafraîchissement manquant.' });
  }

  const uid = verifyRefreshTokenFormat(rawToken);
  if (!uid) {
    return res.status(401).json({ error: 'Jeton de rafraîchissement invalide.' });
  }

  const tokenHash = sha256Hex(rawToken);
  const stored = db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ?')
    .get(tokenHash, uid) as { id: number; revoked: number; expires_at: string } | undefined;

  if (!stored || stored.revoked || new Date(stored.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter.' });
  }

  // Rotate: revoke old refresh token immediately
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);

  const user = db
    .prepare(
      `SELECT u.*, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = 1`
    )
    .get(uid) as
    | {
        id: number;
        username: string;
        email: string;
        full_name: string;
        phone: string;
        role_name: string;
        must_change_password: number;
      }
    | undefined;

  if (!user) {
    return res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
  }

  const session = issueSession(req, res, user);
  return res.json(session);
});

authRouter.post('/logout', (req, res) => {
  const db = getDb();
  const cookies = parseCookies(req.headers.cookie);
  const rawToken =
    (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null) || cookies.cs_refresh_token;

  if (rawToken) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(sha256Hex(rawToken));
  }

  clearAuthCookies(req, res);
  return res.json({ success: true });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone, u.must_change_password, r.name as role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = 1`
    )
    .get(req.authUser!.sub) as Record<string, unknown> | undefined;

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
    },
  });
});

authRouter.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!currentPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }

  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE id = ?').get(req.authUser!.sub) as
    | { id: number; username: string; password_hash: string }
    | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }

  const nextHash = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?").run(
    nextHash,
    user.id
  );
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(user.id);

  writeAuditLog(db, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: 'PASSWORD_CHANGED',
    entityType: 'user',
    entityId: user.id,
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
});

authRouter.get('/customer/orders', requireAuth, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const customer = db
    .prepare('SELECT * FROM customers WHERE user_id = ? OR LOWER(email) = ? LIMIT 1')
    .get(req.authUser!.sub, req.authUser!.email.toLowerCase()) as { id: number } | undefined;

  if (!customer) {
    return res.json({ orders: [] });
  }

  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(customer.id) as Array<Record<string, unknown>>;

  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const hydrated = orders.map((o) => ({
    ...o,
    items: itemStmt.all(Number(o.id)),
  }));

  return res.json({ orders: hydrated });
});
