const { DateTime } = require('luxon');
const db = require('./db');

const toVehicleRecord = (row) => {
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
};

const countAgents = () => {
  const result = db.prepare('SELECT COUNT(*) AS count FROM agents').get();
  return result.count;
};

const createAgent = (agent) => {
  return db
    .prepare(
      `
      INSERT INTO agents (
        id, first_name, last_name, role, phone, pin_hash, is_manager, active, created_at_utc, updated_at_utc
      ) VALUES (
        @id, @first_name, @last_name, @role, @phone, @pin_hash, @is_manager, @active, @created_at_utc, @updated_at_utc
      )
    `,
    )
    .run(agent);
};

const getAgentById = (id) => db.prepare('SELECT * FROM agents WHERE id = ?').get(id);

const getActiveAgents = () => db.prepare('SELECT * FROM agents WHERE active = 1').all();

const findActiveTicket = (ticketUid) =>
  db
    .prepare("SELECT * FROM valet_records WHERE ticket_uid = ? AND status = 'parked'")
    .get(ticketUid);

const createArrivalRecord = (record) => {
  db.prepare(
    `
      INSERT INTO valet_records (
        id, ticket_uid, plate_number, plate_state, plate_country, vehicle_make, vehicle_model, vehicle_color,
        arrival_timestamp_utc, arrival_local, departure_timestamp_utc, departure_local, hotel_local_tz,
        image_original_url, image_thumb_url, notes, status, agent_id, created_at_utc, updated_at_utc
      ) VALUES (
        @id, @ticket_uid, @plate_number, @plate_state, @plate_country, @vehicle_make, @vehicle_model, @vehicle_color,
        @arrival_timestamp_utc, @arrival_local, @departure_timestamp_utc, @departure_local, @hotel_local_tz,
        @image_original_url, @image_thumb_url, @notes, @status, @agent_id, @created_at_utc, @updated_at_utc
      )
    `,
  ).run(record);
  return getRecordById(record.id);
};

const searchOpenRecords = ({ ticketUid, plateNumber }) => {
  return db
    .prepare(
      `SELECT * FROM valet_records WHERE status = 'parked' AND (ticket_uid = @ticketUid OR plate_number = @plateNumber)`,
    )
    .all({ ticketUid, plateNumber })
    .map(toVehicleRecord);
};

const getRecordById = (id) => {
  const row = db.prepare('SELECT * FROM valet_records WHERE id = ?').get(id);
  return toVehicleRecord(row);
};

const closeRecord = ({ id, departureTimestampUtc, departureLocal, agentId }) => {
  db.prepare(
    `UPDATE valet_records SET status = 'closed', departure_timestamp_utc = @departureTimestampUtc, departure_local = @departureLocal, updated_at_utc = @updatedAtUtc, agent_id = @agentId WHERE id = @id`,
  ).run({
    id,
    departureTimestampUtc,
    departureLocal,
    agentId,
    updatedAtUtc: departureTimestampUtc,
  });
  return getRecordById(id);
};

const listRecords = ({ status, startIso, endIso, limit = 500 }) => {
  const clauses = [];
  const params = {};
  if (status) {
    clauses.push('status = @status');
    params.status = status;
  }
  if (startIso && endIso) {
    clauses.push('arrival_local BETWEEN @startIso AND @endIso');
    params.startIso = startIso;
    params.endIso = endIso;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT * FROM valet_records ${where} ORDER BY arrival_timestamp_utc DESC LIMIT @limit`,
    )
    .all({ ...params, limit });
  return rows.map(toVehicleRecord);
};

const getRowsForDateRange = (startIso, endIso) =>
  db
    .prepare(
      'SELECT * FROM valet_records WHERE arrival_local BETWEEN ? AND ? ORDER BY arrival_timestamp_utc ASC',
    )
    .all(startIso, endIso);

const deleteRecordsBefore = (cutoffIso) =>
  db.prepare('DELETE FROM valet_records WHERE arrival_timestamp_utc < ?').run(cutoffIso);

const healthCheck = () => {
  const now = DateTime.utc().toISO();
  db.prepare(
    'INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run('healthcheck', now);
  return db.prepare('SELECT value FROM metadata WHERE key = ?').get('healthcheck');
};

module.exports = {
  countAgents,
  createAgent,
  getAgentById,
  getActiveAgents,
  findActiveTicket,
  createArrivalRecord,
  searchOpenRecords,
  getRecordById,
  closeRecord,
  listRecords,
  getRowsForDateRange,
  deleteRecordsBefore,
  toVehicleRecord,
  healthCheck,
};
