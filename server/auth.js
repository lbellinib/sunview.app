const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');

const HASH_ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function hashPin(pin, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.pbkdf2Sync(pin, salt, HASH_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPin(pin, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(pin, salt, HASH_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function signToken(payload, { secret, expiresIn = '12h' }) {
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token, { secret }) {
  return jwt.verify(token, secret);
}

function getAgentById(id) {
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
}

function getAgentByPin(pin) {
  const agents = db.prepare('SELECT * FROM agents WHERE active = 1').all();
  return agents.find((agent) => verifyPin(pin, agent.pin_hash));
}

module.exports = {
  hashPin,
  verifyPin,
  signToken,
  verifyToken,
  getAgentById,
  getAgentByPin,
};
