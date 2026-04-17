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

app.use(express.json());
app.use(cookieParser());

const normalizeUsername = (value) => value.trim().toLowerCase();

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
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeUsers = async (users) => {
  await fs.writeFile(usersFilePath, JSON.stringify({ users }, null, 2));
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
  });
  await writeUsers(users);
};

const issueToken = (username, rememberMe) => {
  const expiresIn = rememberMe ? '14d' : '8h';
  return jwt.sign({ username }, jwtSecret, { expiresIn });
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

    const persistent = Boolean(rememberMe);
    const token = issueToken(existingUser.username, persistent);
    res.cookie(cookieName, token, getCookieOptions(persistent));

    return res.json({
      authenticated: true,
      user: {
        username: existingUser.username,
      },
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
    });
    await writeUsers(users);

    const persistent = Boolean(rememberMe);
    const token = issueToken(trimmedUsername, persistent);
    res.cookie(cookieName, token, getCookieOptions(persistent));

    return res.status(201).json({
      authenticated: true,
      user: {
        username: trimmedUsername,
      },
    });
  };

  proceed().catch(() => res.status(500).json({ message: 'Unable to create account right now' }));
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { path: '/' });
  return res.json({ authenticated: false });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    authenticated: true,
    user: {
      username: req.user.username,
    },
  });
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
