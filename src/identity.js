/**
 * Local Sovereign Identity
 * Simple keypair-based local identity (Ed25519)
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const ARTIC_DIR = path.join(os.homedir(), '.grok-artic');
const IDENTITY_FILE = path.join(ARTIC_DIR, 'identity.json');

export async function loadIdentity() {
  try {
    const data = await fs.readFile(IDENTITY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function createIdentity(name = 'sovereign-user') {
  await fs.mkdir(ARTIC_DIR, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const fingerprint = crypto
    .createHash('sha256')
    .update(publicKey)
    .digest('hex')
    .slice(0, 16);

  const identity = {
    version: 1,
    name,
    created: new Date().toISOString(),
    fingerprint: `artic:${fingerprint}`,
    publicKey,
    privateKey,
    warning: 'Local development identity. Protect ~/.grok-artic/identity.json',
  };

  await fs.writeFile(IDENTITY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
  return identity;
}

export async function getIdentityStatus() {
  const id = await loadIdentity();
  if (!id) {
    return {
      status: 'none',
      message: 'No local identity. Run: artic identity create',
    };
  }
  return {
    status: 'active',
    name: id.name,
    fingerprint: id.fingerprint,
    created: id.created,
  };
}
