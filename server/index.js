require('dotenv').config();
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

const db = require('./db');
const { ensureDirSync, saveBufferToFileSync } = require('./fs-utils');
const { hashPin, verifyToken, signToken, getAgentById, getAgentByPin } = require('./auth');

const PORT = process.env.PORT || 3000;
const HOTEL_TZ = process.env.HOTEL_TZ || 'America/New_York';
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || '';
const MANAGER_PIN = process.env.MANAGER_PIN || '0000';
const AUTH_SECRET = process.env.AUTH_SECRET || 'super-secret';
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 1.5);
const DATA_RETENTION_DAYS = Number(process.env.DATA_RETENTION_DAYS || 30);
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

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
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
});
app.use('/api/', limiter);

function seedAgents() {
  const now = DateTime.utc().toISO();
  const existing = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  if (existing.count === 0) {
    const insert = db.prepare(`
      INSERT INTO agents (id, first_name, last_name, role, phone, pin_hash, is_manager, active, created_at_utc, updated_at_utc)
      VALUES (@id, @first_name, @last_name, @role, @phone, @pin_hash, @is_manager, 1, @now, @now)
    `);

    insert.run({
      id: 'agent-lino',
      first_name: 'Lino',
      last_name: 'Bellini',
      role: 'Valet Parking Agent',
      phone: '(786)867-8209',
      pin_hash: hashPin('1234'),
      is_manager: 0,
      now,
    });

    insert.run({
      id: 'hotel-manager',
      first_name: 'Hotel',
      last_name: 'Manager',
      role: 'Hotel Manager',
      phone: '',
      pin_hash: hashPin(MANAGER_PIN),
      is_manager: 1,
      now,
    });
  }
}

seedAgents();

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
    console.error(error);
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

function toVehicleRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketUid: row.ticket_uid,
    plate: {
      number: row.plate_number,
      state: row.plate_state,
      country: row.plate_country,
    },
    vehicle: {
      make: row.vehicle_make,
      model: row.vehicle_model,
      color: row.vehicle_color,
    },
    arrivalTimestampUtc: row.arrival_timestamp_utc,
    departureTimestampUtc: row.departure_timestamp_utc,
    hotelLocalTz: row.hotel_local_tz,
    image: {
      originalUrl: row.image_original_url,
      thumbUrl: row.image_thumb_url,
    },
    notes: row.notes,
    status: row.status,
    agentId: row.agent_id,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    arrivalLocal: row.arrival_local,
    departureLocal: row.departure_local,
  };
}

app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }
  const agent = getAgentByPin(pin);
  if (!agent) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ sub: agent.id, role: agent.role }, { secret: AUTH_SECRET, expiresIn: '12h' });
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
    const { ticketUid, plateNumber, plateState, plateCountry, notes, vehicleMake, vehicleModel, vehicleColor } = req.body;
    const image = req.file;
    if (!ticketUid) {
      return res.status(400).json({ error: 'Ticket UID is required' });
    }
    if (!plateNumber) {
      return res.status(400).json({ error: 'License plate is required' });
    }
    if (!image) {
      return res.status(400).json({ error: 'Vehicle photo is required' });
    }

    const sanitizedPlate = sanitizePlate(plateNumber);
    if (sanitizedPlate.length < 2 || sanitizedPlate.length > 10) {
      return res.status(400).json({ error: 'License plate must be between 2 and 10 characters' });
    }

    const openTicket = db.prepare('SELECT id FROM valet_records WHERE ticket_uid = ? AND status = "parked"').get(ticketUid);
    if (openTicket) {
      return res.status(409).json({ error: 'Ticket UID already exists for an active record' });
    }

    const nowUtc = DateTime.utc();
    const local = nowUtc.setZone(HOTEL_TZ);
    const id = uuidv4();
    const processedImage = await processImage(image.buffer, id);

    const record = {
      id,
      ticket_uid: ticketUid,
      plate_number: sanitizedPlate,
      plate_state: plateState || null,
      plate_country: plateCountry || 'USA',
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

    const insert = db.prepare(`
      INSERT INTO valet_records (
        id, ticket_uid, plate_number, plate_state, plate_country, vehicle_make, vehicle_model, vehicle_color,
        arrival_timestamp_utc, arrival_local, departure_timestamp_utc, departure_local, hotel_local_tz,
        image_original_url, image_thumb_url, notes, status, agent_id, created_at_utc, updated_at_utc
      ) VALUES (
        @id, @ticket_uid, @plate_number, @plate_state, @plate_country, @vehicle_make, @vehicle_model, @vehicle_color,
        @arrival_timestamp_utc, @arrival_local, @departure_timestamp_utc, @departure_local, @hotel_local_tz,
        @image_original_url, @image_thumb_url, @notes, @status, @agent_id, @created_at_utc, @updated_at_utc
      )
    `);
    insert.run(record);

    res.json({
      success: true,
      message: 'Arrival recorded successfully',
      record: toVehicleRecord(record),
    });
  } catch (error) {
    console.error('Arrival error', error);
    res.status(500).json({ error: 'Failed to record arrival' });
  }
});

app.get('/api/records/search', authMiddleware, (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }
  const sanitized = sanitizePlate(query);
  const matches = db
    .prepare(
      `SELECT * FROM valet_records WHERE status = 'parked' AND (ticket_uid = ? OR plate_number = ?)`
    )
    .all(query, sanitized)
    .map(toVehicleRecord);

  res.json({ results: matches });
});

app.post('/api/departures', authMiddleware, (req, res) => {
  const { recordId } = req.body;
  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }
  const record = db.prepare('SELECT * FROM valet_records WHERE id = ?').get(recordId);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (record.status === 'closed') {
    return res.status(409).json({ error: 'Record is already closed' });
  }
  const nowUtc = DateTime.utc();
  const local = nowUtc.setZone(HOTEL_TZ);
  const arrivalUtc = DateTime.fromISO(record.arrival_timestamp_utc, { zone: 'utc' });
  const durationMinutes = Math.max(1, Math.round(nowUtc.diff(arrivalUtc, 'minutes').minutes));

  db.prepare(
    `UPDATE valet_records SET status = 'closed', departure_timestamp_utc = ?, departure_local = ?, updated_at_utc = ?, agent_id = ? WHERE id = ?`
  ).run(nowUtc.toISO(), local.toISO(), nowUtc.toISO(), req.agent.id, recordId);

  const updated = db.prepare('SELECT * FROM valet_records WHERE id = ?').get(recordId);

  res.json({
    success: true,
    message: 'Departure recorded',
    durationMinutes,
    record: toVehicleRecord(updated),
  });
});

app.get('/api/admin/records', authMiddleware, managerMiddleware, (req, res) => {
  const { status, date } = req.query;
  let sql = 'SELECT * FROM valet_records WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (date) {
    const dayStart = DateTime.fromISO(date, { zone: HOTEL_TZ }).startOf('day');
    const dayEnd = dayStart.endOf('day');
    sql += ' AND arrival_local BETWEEN ? AND ?';
    params.push(dayStart.toISO(), dayEnd.toISO());
  }
  sql += ' ORDER BY arrival_timestamp_utc DESC LIMIT 500';
  const rows = db.prepare(sql).all(...params);
  res.json({ records: rows.map(toVehicleRecord) });
});

function generateCsv(rows) {
  const records = rows.map((row) => {
    const departure = row.departure_local ? DateTime.fromISO(row.departure_local).setZone(HOTEL_TZ) : null;
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
  const departures = rows
    .filter((row) => row.departure_local)
    .map((row) => DateTime.fromISO(row.departure_local).setZone(HOTEL_TZ));

  rows.forEach((row) => {
    if (row.departure_local) {
      const interval = Interval.fromDateTimes(
        DateTime.fromISO(row.arrival_local),
        DateTime.fromISO(row.departure_local)
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
              DateTime.fromISO(row.departure_local)
            ).length('minutes')
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
  return db
    .prepare('SELECT * FROM valet_records WHERE arrival_local BETWEEN ? AND ? ORDER BY arrival_timestamp_utc ASC')
    .all(dayStart.toISO(), dayEnd.toISO());
}

function sendDailyReport(dateISO) {
  if (!MANAGER_EMAIL || !SMTP_HOST) {
    console.warn('Skipping email report - missing SMTP or manager email');
    return;
  }
  const rows = getRowsForDate(dateISO);
  const csv = generateCsv(rows);
  const html = buildHtmlSummary(rows);
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
    .then(() => console.log('Daily report emailed'))
    .catch((err) => console.error('Email send error', err));
}

function purgeOldData() {
  if (!DATA_RETENTION_DAYS || DATA_RETENTION_DAYS <= 0) return;
  const cutoff = DateTime.utc().minus({ days: DATA_RETENTION_DAYS }).toISO();
  const stmt = db.prepare('DELETE FROM valet_records WHERE arrival_timestamp_utc < ?');
  const info = stmt.run(cutoff);
  if (info.changes > 0) {
    console.log(`Purged ${info.changes} records older than ${DATA_RETENTION_DAYS} days`);
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

// Schedule daily tasks
nodeCron.schedule('59 23 * * *', () => {
  const now = DateTime.now().setZone(HOTEL_TZ);
  const dateISO = now.toFormat('yyyy-LL-dd');
  sendDailyReport(dateISO);
  purgeOldData();
}, {
  timezone: HOTEL_TZ,
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`Valet server listening on port ${PORT}`);
});
