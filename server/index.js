require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const nodeCron = require('node-cron');
const nodemailer = require('nodemailer');
const { DateTime, Interval } = require('luxon');
const { stringify } = require('csv-stringify/sync');
const { z } = require('zod');

const store = require('./store');
const { ensureDirSync, saveBufferToFileSync } = require('./fs-utils');
const { hashPin, verifyToken, signToken, getAgentById, getAgentByPin } = require('./auth');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;
const HOTEL_TZ = process.env.HOTEL_TZ || 'America/New_York';
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || '';
const MANAGER_PIN = process.env.MANAGER_PIN || '0000';
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 1.5);
const DATA_RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS || 30);
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const CORS_ORIGINS = process.env.CORS_ORIGINS || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

if (!AUTH_SECRET || Buffer.byteLength(AUTH_SECRET, 'utf8') < 32) {
  logger.error('startup.auth_secret.invalid', {
    message: 'AUTH_SECRET must be at least 32 characters long',
  });
  process.exit(1);
}

const CORS_ERROR = 'CORS_NOT_ALLOWED';

const allowedOrigins = CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

const app = express();
app.set('trust proxy', 1);

const allowLocalhost = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (allowLocalhost && /^https?:\/\/localhost(?::\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      const error = new Error(CORS_ERROR);
      error.status = 403;
      return callback(error);
    },
    optionsSuccessStatus: 204,
    credentials: true,
  }),
);

app.use((err, req, res, next) => {
  if (err && err.message === CORS_ERROR) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  return next(err);
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  morgan(
    (tokens, req, res) =>
      JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        contentLength: tokens.res(req, res, 'content-length'),
        responseTimeMs: Number(tokens['response-time'](req, res)),
      }),
    {
      stream: {
        write: (message) => {
          try {
            const parsed = JSON.parse(message);
            logger.http(parsed);
          } catch (error) {
            logger.http({ raw: message.trim(), error: error.message });
          }
        },
      },
    },
  ),
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const uploadsDir = path.join(__dirname, '..', 'uploads');
ensureDirSync(uploadsDir);
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);

app.use(express.static(path.join(__dirname, '..', 'public')));

function seedAgents() {
  const now = DateTime.utc().toISO();
  if (store.countAgents() > 0) {
    return;
  }

  store.createAgent({
    id: 'agent-lino',
    first_name: 'Lino',
    last_name: 'Bellini',
    role: 'Valet Parking Agent',
    phone: '(786)867-8209',
    pin_hash: hashPin('1234'),
    is_manager: 0,
    active: 1,
    created_at_utc: now,
    updated_at_utc: now,
  });

  store.createAgent({
    id: 'hotel-manager',
    first_name: 'Hotel',
    last_name: 'Manager',
    role: 'Hotel Manager',
    phone: '',
    pin_hash: hashPin(MANAGER_PIN),
    is_manager: 1,
    active: 1,
    created_at_utc: now,
    updated_at_utc: now,
  });

  logger.info('seed.agents.completed');
}

seedAgents();

if (!CRON_SECRET) {
  logger.warn('cron.secret.missing', {
    message: 'Set CRON_SECRET to enable authenticated worker triggers in production.',
  });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  try {
    const payload = verifyToken(token, { secret: AUTH_SECRET });
    const agent = getAgentById(payload.sub);
    if (!agent || agent.active !== 1) {
      return res.status(401).json({ error: 'Agent not active' });
    }
    req.agent = agent;
    next();
  } catch (error) {
    logger.warn('auth.token.invalid', { error });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function managerMiddleware(req, res, next) {
  if (!req.agent || req.agent.is_manager !== 1) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

function sanitizePlate(plate) {
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

const arrivalSchema = z.object({
  ticketUid: z.string().trim().min(2).max(32),
  plateNumber: z.string().trim().min(2).max(20),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  vehicleMake: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  vehicleModel: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
  vehicleColor: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value)),
});

const departureSchema = z.object({
  recordId: z.string().uuid(),
});

const searchSchema = z.object({
  query: z.string().trim().min(2).max(32),
});

const adminQuerySchema = z.object({
  status: z.enum(['parked', 'closed']).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body || {};
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }
  const agent = getAgentByPin(pin);
  if (!agent) {
    logger.warn('auth.login.failed', { reason: 'invalid_pin' });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ sub: agent.id, role: agent.role }, { secret: AUTH_SECRET });
  logger.info('auth.login.success', { agentId: agent.id });
  res.json({
    token,
    agent: {
      id: agent.id,
      firstName: agent.first_name,
      lastName: agent.last_name,
      role: agent.role,
      phone: agent.phone,
      isManager: agent.is_manager === 1,
    },
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({
    id: req.agent.id,
    firstName: req.agent.first_name,
    lastName: req.agent.last_name,
    role: req.agent.role,
    phone: req.agent.phone,
    isManager: req.agent.is_manager === 1,
  });
});

async function processImage(buffer, id) {
  const baseDir = path.join(__dirname, '..', 'uploads');
  ensureDirSync(baseDir);
  const originalName = `${id}.jpg`;
  const thumbName = `${id}-thumb.jpg`;
  const originalPath = path.join(baseDir, originalName);
  const thumbPath = path.join(baseDir, thumbName);

  const originalBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: 1280,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer();

  const thumbBuffer = await sharp(originalBuffer)
    .resize({ width: 360, height: 360, fit: 'inside' })
    .jpeg({ quality: 70 })
    .toBuffer();

  saveBufferToFileSync(originalBuffer, originalPath);
  saveBufferToFileSync(thumbBuffer, thumbPath);

  return {
    originalUrl: `/uploads/${originalName}`,
    thumbUrl: `/uploads/${thumbName}`,
  };
}

app.post('/api/arrivals', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const parseResult = arrivalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ error: 'Invalid payload', details: parseResult.error.flatten() });
    }

    const { ticketUid, plateNumber, notes, vehicleMake, vehicleModel, vehicleColor } =
      parseResult.data;
    const normalizedTicket = ticketUid.trim();
    const sanitizedPlate = sanitizePlate(plateNumber);
    if (sanitizedPlate.length < 2 || sanitizedPlate.length > 10) {
      return res.status(400).json({ error: 'License plate must be between 2 and 10 characters' });
    }

    const image = req.file;
    if (!image) {
      return res.status(400).json({ error: 'Vehicle photo is required' });
    }

    const openTicket = store.findActiveTicket(normalizedTicket);
    if (openTicket) {
      logger.warn('arrival.duplicate_ticket', {
        ticketUid: normalizedTicket,
        agentId: req.agent.id,
      });
      return res.status(409).json({ error: 'Ticket UID already exists for an active record' });
    }

    const nowUtc = DateTime.utc();
    const local = nowUtc.setZone(HOTEL_TZ);
    const id = uuidv4();
    const processedImage = await processImage(image.buffer, id);

    const record = {
      id,
      ticket_uid: normalizedTicket,
      plate_number: sanitizedPlate,
      plate_state: null,
      plate_country: 'USA',
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
      vehicle_color: vehicleColor || null,
      arrival_timestamp_utc: nowUtc.toISO(),
      arrival_local: local.toISO(),
      departure_timestamp_utc: null,
      departure_local: null,
      hotel_local_tz: HOTEL_TZ,
      image_original_url: processedImage.originalUrl,
      image_thumb_url: processedImage.thumbUrl,
      notes: notes || null,
      status: 'parked',
      agent_id: req.agent.id,
      created_at_utc: nowUtc.toISO(),
      updated_at_utc: nowUtc.toISO(),
    };

    const created = store.createArrivalRecord(record);

    logger.info('arrival.created', {
      ticketUid: normalizedTicket,
      plate: sanitizedPlate,
      agentId: req.agent.id,
    });

    res.json({
      success: true,
      message: 'Arrival recorded successfully',
      record: created,
    });
  } catch (error) {
    logger.error('arrival.error', { error });
    res.status(500).json({ error: 'Failed to record arrival' });
  }
});

app.get('/api/records/search', authMiddleware, (req, res) => {
  const parseResult = searchSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Query is required' });
  }
  const { query } = parseResult.data;
  const sanitized = sanitizePlate(query);
  const matches = store.searchOpenRecords({ ticketUid: query.trim(), plateNumber: sanitized });
  res.json({ results: matches });
});

app.post('/api/departures', authMiddleware, (req, res) => {
  const parseResult = departureSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'recordId is required' });
  }
  const { recordId } = parseResult.data;
  const record = store.getRecordById(recordId);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (record.status === 'closed') {
    return res.status(409).json({ error: 'Record is already closed' });
  }
  const nowUtc = DateTime.utc();
  const local = nowUtc.setZone(HOTEL_TZ);
  const arrivalUtc = DateTime.fromISO(record.arrivalTimestampUtc, { zone: 'utc' });
  const durationMinutes = Math.max(1, Math.round(nowUtc.diff(arrivalUtc, 'minutes').minutes));

  const updated = store.closeRecord({
    id: recordId,
    departureTimestampUtc: nowUtc.toISO(),
    departureLocal: local.toISO(),
    agentId: req.agent.id,
  });

  logger.info('departure.closed', {
    ticketUid: record.ticketUid,
    plate: record.plate.number,
    durationMinutes,
    agentId: req.agent.id,
  });

  res.json({
    success: true,
    message: 'Departure recorded',
    durationMinutes,
    record: updated,
  });
});

app.get('/api/admin/records', authMiddleware, managerMiddleware, (req, res) => {
  const parseResult = adminQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }
  const { status, date } = parseResult.data;
  let startIso;
  let endIso;
  if (date) {
    const dayStart = DateTime.fromISO(date, { zone: HOTEL_TZ }).startOf('day');
    startIso = dayStart.toISO();
    endIso = dayStart.endOf('day').toISO();
  }
  const records = store.listRecords({ status, startIso, endIso });
  res.json({ records });
});

function generateCsv(rows) {
  const records = rows.map((row) => {
    const departure = row.departure_local
      ? DateTime.fromISO(row.departure_local).setZone(HOTEL_TZ)
      : null;
    const arrival = DateTime.fromISO(row.arrival_local).setZone(HOTEL_TZ);
    const duration = departure
      ? Math.round(Interval.fromDateTimes(arrival, departure).length('minutes'))
      : '';
    return {
      ticketUid: row.ticket_uid,
      plate: row.plate_number,
      arrivalLocal: arrival.toFormat('yyyy-LL-dd HH:mm'),
      departureLocal: departure ? departure.toFormat('yyyy-LL-dd HH:mm') : '',
      parkedMinutes: duration,
      notes: row.notes || '',
    };
  });
  return stringify(records, {
    header: true,
    columns: ['ticketUid', 'plate', 'arrivalLocal', 'departureLocal', 'parkedMinutes', 'notes'],
  });
}

function summarizeRows(rows) {
  if (!rows.length) {
    return {
      total: 0,
      avgDuration: 0,
      firstArrival: null,
      lastArrival: null,
      countByHour: {},
    };
  }
  const durations = [];
  const countByHour = {};
  const arrivals = rows.map((row) => DateTime.fromISO(row.arrival_local).setZone(HOTEL_TZ));
  rows.forEach((row) => {
    if (row.departure_local) {
      const interval = Interval.fromDateTimes(
        DateTime.fromISO(row.arrival_local),
        DateTime.fromISO(row.departure_local),
      );
      durations.push(Math.round(interval.length('minutes')));
    }
    const hour = DateTime.fromISO(row.arrival_local).setZone(HOTEL_TZ).toFormat('HH');
    countByHour[hour] = (countByHour[hour] || 0) + 1;
  });

  const avgDuration = durations.length
    ? Math.round(durations.reduce((sum, val) => sum + val, 0) / durations.length)
    : 0;

  return {
    total: rows.length,
    avgDuration,
    firstArrival: DateTime.min(...arrivals).toISO(),
    lastArrival: DateTime.max(...arrivals).toISO(),
    countByHour,
  };
}

function buildHtmlSummary(rows) {
  const summary = summarizeRows(rows);
  const firstArrival = summary.firstArrival
    ? DateTime.fromISO(summary.firstArrival).setZone(HOTEL_TZ).toFormat('yyyy-LL-dd HH:mm')
    : 'N/A';
  const lastArrival = summary.lastArrival
    ? DateTime.fromISO(summary.lastArrival).setZone(HOTEL_TZ).toFormat('yyyy-LL-dd HH:mm')
    : 'N/A';
  const rowsHtml = rows
    .map((row) => {
      const arrival = DateTime.fromISO(row.arrival_local).setZone(HOTEL_TZ).toFormat('HH:mm');
      const departure = row.departure_local
        ? DateTime.fromISO(row.departure_local).setZone(HOTEL_TZ).toFormat('HH:mm')
        : '—';
      const duration = row.departure_local
        ? Math.round(
            Interval.fromDateTimes(
              DateTime.fromISO(row.arrival_local),
              DateTime.fromISO(row.departure_local),
            ).length('minutes'),
          )
        : '—';
      return `<tr><td>${row.ticket_uid}</td><td>${row.plate_number}</td><td>${arrival}</td><td>${departure}</td><td>${duration}</td><td>${row.notes || ''}</td></tr>`;
    })
    .join('');

  const countByHour = Object.entries(summary.countByHour)
    .map(([hour, count]) => `<li><strong>${hour}:00</strong> — ${count}</li>`)
    .join('');

  return `
  <h2>Daily Valet Summary</h2>
  <p>Total vehicles: <strong>${summary.total}</strong></p>
  <p>Average duration: <strong>${summary.avgDuration} minutes</strong></p>
  <p>First arrival: ${firstArrival}</p>
  <p>Last arrival: ${lastArrival}</p>
  <h3>Arrivals by hour</h3>
  <ul>${countByHour}</ul>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr><th>Ticket</th><th>Plate</th><th>Arrival</th><th>Departure</th><th>Minutes</th><th>Notes</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  `;
}

function getRowsForDate(dateISO) {
  const dayStart = DateTime.fromISO(dateISO, { zone: HOTEL_TZ }).startOf('day');
  const dayEnd = dayStart.endOf('day');
  return store.getRowsForDateRange(dayStart.toISO(), dayEnd.toISO());
}

function sendDailyReport(dateISO, options = {}) {
  if (!MANAGER_EMAIL || !SMTP_HOST) {
    logger.warn('report.daily.skipped', { reason: 'missing_configuration' });
    return;
  }
  let rows = options.rows;
  if (!options.csv || !options.html) {
    rows = rows || getRowsForDate(dateISO);
  }
  const csv = options.csv || (rows ? generateCsv(rows) : null);
  const html = options.html || (rows ? buildHtmlSummary(rows) : null);
  if (!csv || !html) {
    logger.error('report.daily.error', {
      error: new Error('Missing report content for email dispatch'),
    });
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER
      ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        }
      : undefined,
  });
  const subject = `Valet Daily Report ${dateISO}`;
  transporter
    .sendMail({
      from: SMTP_USER || 'valet@localhost',
      to: MANAGER_EMAIL,
      subject,
      html,
      attachments: [
        {
          filename: `valet-report-${dateISO}.csv`,
          content: csv,
        },
      ],
    })
    .then(() => logger.info('report.daily.sent', { dateISO, source: options.source || 'server' }))
    .catch((err) => logger.error('report.daily.error', { error: err }));
}

function purgeOldData() {
  if (!DATA_RETENTION_DAYS || DATA_RETENTION_DAYS <= 0) return;
  const cutoff = DateTime.utc().minus({ days: DATA_RETENTION_DAYS }).toISO();
  const info = store.deleteRecordsBefore(cutoff);
  if (info && info.changes > 0) {
    logger.info('records.purged', { changes: info.changes, cutoff });
  }
}

app.get('/api/admin/reports/daily', authMiddleware, managerMiddleware, (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
  }
  const rows = getRowsForDate(date);
  const csv = generateCsv(rows);
  res.header('Content-Type', 'text/csv');
  res.attachment(`valet-report-${date}.csv`);
  res.send(csv);
});

app.get('/api/admin/reports/daily/html', authMiddleware, managerMiddleware, (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
  }
  const rows = getRowsForDate(date);
  const html = buildHtmlSummary(rows);
  res.header('Content-Type', 'text/html');
  res.send(html);
});

app.post('/api/system/reports/daily', (req, res) => {
  if (!CRON_SECRET) {
    return res.status(503).json({ error: 'Cron secret not configured' });
  }
  if (req.headers['x-cron-key'] !== CRON_SECRET) {
    logger.warn('report.system.unauthorized', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { date, report } = req.body || {};
  const dateISO = date || DateTime.now().setZone(HOTEL_TZ).toFormat('yyyy-LL-dd');
  logger.info('report.system.triggered', {
    dateISO,
    hasExternalPayload: Boolean(report && report.csv && report.html),
  });
  if (report && report.csv && report.html) {
    sendDailyReport(dateISO, { csv: report.csv, html: report.html, source: 'worker' });
  } else {
    sendDailyReport(dateISO, { source: 'server' });
  }
  purgeOldData();
  res.json({ ok: true });
});

const diskCheckPath = path.join(uploadsDir, '.healthcheck');
async function checkDiskWritable() {
  try {
    await fs.promises.writeFile(diskCheckPath, Date.now().toString(), 'utf8');
    await fs.promises.unlink(diskCheckPath);
    return true;
  } catch (error) {
    logger.error('health.disk.error', { error });
    return false;
  }
}

app.get('/api/healthz', async (req, res) => {
  try {
    const dbResult = store.healthCheck();
    const diskWritable = await checkDiskWritable();
    res.json({
      status: 'ok',
      diskWritable,
      db: {
        lastUpdated: dbResult ? dbResult.value : null,
      },
    });
  } catch (error) {
    logger.error('health.error', { error });
    res.status(500).json({ status: 'error' });
  }
});

const enableLocalCron =
  process.env.ENABLE_LOCAL_CRON === 'true' || process.env.NODE_ENV !== 'production';
if (enableLocalCron) {
  nodeCron.schedule(
    '59 23 * * *',
    () => {
      const now = DateTime.now().setZone(HOTEL_TZ);
      const dateISO = now.toFormat('yyyy-LL-dd');
      sendDailyReport(dateISO, { source: 'local-cron' });
      purgeOldData();
    },
    {
      timezone: HOTEL_TZ,
    },
  );
  logger.info('cron.local.enabled', { timezone: HOTEL_TZ });
} else {
  logger.info('cron.local.disabled');
}

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res) => {
  logger.error('express.unhandled', { error: err, path: req.path });
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  logger.info('server.started', { port: PORT });
});
