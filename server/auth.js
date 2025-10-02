const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const store = require('./store');

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

function assertSecret(secret) {
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_SECRET must be at least 32 bytes long');
  }
}

function signToken(payload, { secret, expiresIn = '8h' }) {
  assertSecret(secret);
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
    audience: 'sunview-app',
    issuer: 'sunview-auth',
  });
}

function verifyToken(token, { secret }) {
  assertSecret(secret);
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    audience: 'sunview-app',
    issuer: 'sunview-auth',
  });
}

function getAgentById(id) {
  return store.getAgentById(id);
}

function getAgentByPin(pin) {
  const agents = store.getActiveAgents();
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
