import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DatabaseSync } from 'node:sqlite';

const DEV_ACCESS_FALLBACK = crypto.randomBytes(32).toString('hex');
const DEV_REFRESH_FALLBACK = crypto.randomBytes(32).toString('hex');

function getAccessSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return DEV_ACCESS_FALLBACK;
}

function getRefreshSecret(): string {
  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length >= 16) {
    return process.env.JWT_REFRESH_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET must be configured in production.');
  }
  return DEV_REFRESH_FALLBACK;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derivedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export interface AccessTokenPayload {
  sub: number;
  username: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>, ttlSeconds = 900): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AccessTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', getAccessSecret()).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', getAccessSecret()).update(`${header}.${body}`).digest()
    );
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(base64UrlDecode(body)) as AccessTokenPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function signRefreshToken(userId: number): string {
  const raw = `${userId}.${crypto.randomBytes(32).toString('hex')}`;
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', getRefreshSecret()).update(raw).digest()
  );
  return `${raw}.${sig}`;
}

export function verifyRefreshTokenFormat(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [uidStr, nonce, sig] = parts;
  const raw = `${uidStr}.${nonce}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getRefreshSecret()).update(raw).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  const uid = Number(uidStr);
  return Number.isInteger(uid) && uid > 0 ? uid : null;
}

export function sanitizeText(value: unknown, maxLen = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export function createRateLimiter(options: {
  windowMs: number;
  maxAttempts: number;
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyFn ? options.keyFn(req) : `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    if (current.count >= options.maxAttempts) {
      const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: options.message || `Trop de tentatives. Réessayez dans ${retryAfterSec} secondes.`,
        retryAfterSec,
      });
    }
    current.count += 1;
    return next();
  };
}

export function resetRateLimit(key: string): void {
  rateBuckets.delete(key);
}

export function writeAuditLog(
  db: DatabaseSync,
  params: {
    actorUserId?: number | null;
    actorUsername: string;
    action: string;
    entityType: string;
    entityId?: string | number;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_username, action, entity_type, entity_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      params.actorUserId ?? null,
      params.actorUsername,
      params.action,
      params.entityType,
      params.entityId !== undefined ? String(params.entityId) : '',
      JSON.stringify(params.details ?? {}),
      params.ipAddress ?? ''
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: AccessTokenPayload;
}

export function extractAccessToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.cs_access_token || null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expirée ou jeton invalide.' });
  }
  req.authUser = payload;
  return next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.authUser || (req.authUser.role !== 'admin' && req.authUser.role !== 'manager')) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    return next();
  });
}
