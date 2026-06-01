import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.AUTH_API_PORT || 8787);

const authUsername = (process.env.AUTH_USERNAME || 'admin').trim();
const authPassword = process.env.AUTH_PASSWORD || 'farm123';
const jwtSecret = process.env.AUTH_JWT_SECRET || 'replace-me-with-a-long-random-secret';
const cookieName = 'wjs_session';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, 'users.json');

const pageKeys = [
  'dashboard',
  'farmAtGlance',
  'tillage',
  'seeding',
  'planterChecks',
  'scouting',
  'spray',
  'potatoYield',
  'harvest',
  'potatoStorage',
  'fieldSummary',
  'seedingPlan',
  'fields',
];

const createPermissions = (mode) => Object.fromEntries(pageKeys.map((key) => [key, mode]));
const fullEditPermissions = createPermissions('edit');
const defaultApprovedPermissions = {
  ...createPermissions('none'),
  dashboard: 'view',
  farmAtGlance: 'view',
};

app.use(express.json());
app.use(cookieParser());

const normalizeUsername = (value) => value.trim().toLowerCase();

const normalizePermissions = (permissions, fallbackPermissions) => {
  const source = permissions && typeof permissions === 'object' ? permissions : {};
  return Object.fromEntries(
    pageKeys.map((key) => {
      const raw = source[key];
      if (raw === 'none' || raw === 'view' || raw === 'edit') {
        return [key, raw];
      }
      return [key, fallbackPermissions[key] ?? 'none'];
    }),
  );
};

const normalizeUser = (user) => {
  const normalizedUsername = String(user?.username || '').trim();
  const isAdmin = normalizeUsername(normalizedUsername) === normalizeUsername(authUsername) || Boolean(user?.isAdmin);
  const hasExplicitPermissions = user?.permissions && typeof user.permissions === 'object';
  const fallbackPermissions = isAdmin
    ? fullEditPermissions
    : hasExplicitPermissions
      ? defaultApprovedPermissions
      : fullEditPermissions;

  return {
    username: normalizedUsername,
    passwordHash: String(user?.passwordHash || ''),
    createdAt: user?.createdAt || new Date().toISOString(),
    status: user?.status === 'pending' ? 'pending' : 'approved',
    isAdmin,
    permissions: normalizePermissions(user?.permissions, fallbackPermissions),
  };
};

const toPublicUser = (user) => ({
  username: user.username,
  createdAt: user.createdAt,
  status: user.status,
  isAdmin: user.isAdmin,
  permissions: user.permissions,
});

const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedValue) => {
  const [salt, storedHash] = String(storedValue || '').split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const suppliedHashBuffer = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(storedHash, 'hex');
  if (suppliedHashBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(suppliedHashBuffer, storedHashBuffer);
};

const readUsers = async () => {
  try {
    const raw = await fs.readFile(usersFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users.map(normalizeUser) : [];
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeUsers = async (users) => {
  await fs.writeFile(usersFilePath, JSON.stringify({ users: users.map(normalizeUser) }, null, 2));
};

const ensureSeedAdmin = async () => {
  const users = await readUsers();
  const normalized = normalizeUsername(authUsername);
  const exists = users.some((user) => normalizeUsername(user.username) === normalized);

  if (exists) {
    return;
  }

  users.push({
    username: authUsername,
    passwordHash: hashPassword(authPassword),
    createdAt: new Date().toISOString(),
    status: 'approved',
    isAdmin: true,
    permissions: fullEditPermissions,
  });
  await writeUsers(users);
};

const issueToken = (user, rememberMe) => {
  const expiresIn = rememberMe ? '14d' : '8h';
  return jwt.sign({ username: user.username, isAdmin: user.isAdmin }, jwtSecret, { expiresIn });
};

const getCookieOptions = (rememberMe) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: rememberMe ? 14 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000,
});

const requireAuth = (req, res, next) => {
  const token = req.cookies[cookieName];
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    res.clearCookie(cookieName, { path: '/' });
    return res.status(401).json({ message: 'Session expired' });
  }
};

const requireAdmin = async (req, res, next) => {
  const requestedUsername = normalizeUsername(req.user?.username || '');
  const users = await readUsers();
  const existingUser = users.find((user) => normalizeUsername(user.username) === requestedUsername);

  if (!existingUser || !existingUser.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  req.currentUser = existingUser;
  return next();
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, rememberMe } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const proceed = async () => {
    const users = await readUsers();
    const requestedUsername = normalizeUsername(username);
    const existingUser = users.find((user) => normalizeUsername(user.username) === requestedUsername);

    const isValid = Boolean(existingUser) && verifyPassword(password, existingUser.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (existingUser.status !== 'approved') {
      return res.status(403).json({ code: 'pending_approval', message: 'Your account is pending admin approval.' });
    }

    const persistent = Boolean(rememberMe);
    const token = issueToken(existingUser, persistent);
    res.cookie(cookieName, token, getCookieOptions(persistent));

    return res.json({
      authenticated: true,
      user: toPublicUser(existingUser),
    });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to sign in right now' }));
});

app.post('/api/auth/signup', (req, res) => {
  const { username, password, rememberMe } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const proceed = async () => {
    const users = await readUsers();
    const requestedUsername = normalizeUsername(trimmedUsername);
    const existingUser = users.find((user) => normalizeUsername(user.username) === requestedUsername);

    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    users.push({
      username: trimmedUsername,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      status: 'pending',
      isAdmin: false,
      permissions: defaultApprovedPermissions,
    });
    await writeUsers(users);

    return res.status(201).json({
      authenticated: false,
      requiresApproval: true,
      message: 'Account request submitted. An admin must approve your access before you can sign in.',
    });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to create account right now' }));
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { path: '/' });
  return res.json({ authenticated: false });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const proceed = async () => {
    const users = await readUsers();
    const existingUser = users.find((user) => normalizeUsername(user.username) === normalizeUsername(req.user.username));

    if (!existingUser || existingUser.status !== 'approved') {
      res.clearCookie(cookieName, { path: '/' });
      return res.status(401).json({ message: 'Not authenticated' });
    }

    return res.json({
      authenticated: true,
      user: toPublicUser(existingUser),
    });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to verify session right now' }));
});

app.get('/api/admin/users', requireAuth, (req, res) => {
  const proceed = async () => {
    const users = await readUsers();
    const currentUser = users.find((user) => normalizeUsername(user.username) === normalizeUsername(req.user.username));

    if (!currentUser?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    return res.json({
      users: users
        .map(toPublicUser)
        .sort((left, right) => left.username.localeCompare(right.username, undefined, { sensitivity: 'base' })),
    });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to load users right now' }));
});

app.patch('/api/admin/users/:username', requireAuth, (req, res) => {
  const proceed = async () => {
    const users = await readUsers();
    const currentUser = users.find((user) => normalizeUsername(user.username) === normalizeUsername(req.user.username));

    if (!currentUser?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const requestedUsername = normalizeUsername(decodeURIComponent(req.params.username || ''));
    const userIndex = users.findIndex((user) => normalizeUsername(user.username) === requestedUsername);

    if (userIndex < 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = users[userIndex];
    if (targetUser.isAdmin) {
      return res.status(400).json({ message: 'Admin account cannot be edited here' });
    }

    const nextStatus = req.body?.status === 'pending' ? 'pending' : 'approved';
    const nextPermissions = normalizePermissions(req.body?.permissions, targetUser.permissions || defaultApprovedPermissions);

    const nextUser = normalizeUser({
      ...targetUser,
      status: nextStatus,
      permissions: nextPermissions,
    });

    users[userIndex] = nextUser;
    await writeUsers(users);

    return res.json({ user: toPublicUser(nextUser) });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to update user right now' }));
});

const startServer = async () => {
  await ensureSeedAdmin();

  app.listen(port, () => {
    console.log(`Auth API running on http://localhost:${port}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start auth server', error);
  process.exit(1);
});
