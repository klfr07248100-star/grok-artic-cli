/**
 * Local Resonance Store
 * Portable AI context, prompts, strategies + activation metadata
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const ARTIC_DIR = path.join(os.homedir(), '.grok-artic');
const RESONANCE_DIR = path.join(ARTIC_DIR, 'resonance');
const INDEX_FILE = path.join(RESONANCE_DIR, 'index.json');
const STATE_FILE = path.join(ARTIC_DIR, 'resonance-state.json');

async function ensureDir() {
  await fs.mkdir(RESONANCE_DIR, { recursive: true });
}

async function loadIndex() {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { version: 2, entries: [], updated: null };
  }
}

async function saveIndex(index) {
  index.updated = new Date().toISOString();
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export async function getResonanceStatus() {
  try {
    await ensureDir();
    const index = await loadIndex();
    const state = await getActivationState();
    return {
      status: 'active',
      location: RESONANCE_DIR,
      entries: index.entries.length,
      lastUpdated: index.updated || null,
      activated: state.activated,
      activatedAt: state.activatedAt,
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

export async function getActivationState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { activated: false, activatedAt: null, note: null };
  }
}

export async function setActivationState(activated, note = null) {
  await ensureDir();
  const state = {
    activated: !!activated,
    activatedAt: activated ? new Date().toISOString() : null,
    note: note || null,
    updated: new Date().toISOString(),
  };
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

export async function addResonanceEntry({ title, type = 'prompt', content, tags = [], activationRelated = false }) {
  await ensureDir();
  const index = await loadIndex();

  const id = `res_${Date.now().toString(36)}`;
  const entry = {
    id,
    title,
    type,
    created: new Date().toISOString(),
    content,
    tags: Array.isArray(tags) ? tags : [],
    activationRelated: !!activationRelated,
    version: 2,
  };

  const filePath = path.join(RESONANCE_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2));

  index.entries.push({
    id,
    title,
    type,
    created: entry.created,
    tags: entry.tags,
    activationRelated: entry.activationRelated,
  });

  await saveIndex(index);
  return entry;
}

export async function listResonanceEntries() {
  const index = await loadIndex();
  return index.entries;
}

export async function exportResonance(outPath) {
  await ensureDir();
  const index = await loadIndex();
  const state = await getActivationState();
  const fullEntries = [];

  for (const meta of index.entries) {
    try {
      const raw = await fs.readFile(path.join(RESONANCE_DIR, `${meta.id}.json`), 'utf8');
      fullEntries.push(JSON.parse(raw));
    } catch {
      // skip
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 2,
    activationState: state,
    entries: fullEntries,
  };

  const target = outPath || path.join(process.cwd(), `resonance-export-${Date.now()}.json`);
  await fs.writeFile(target, JSON.stringify(payload, null, 2));
  return { file: target, count: fullEntries.length };
}

export async function importResonance(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(raw);

  if (!payload.entries || !Array.isArray(payload.entries)) {
    throw new Error('Invalid Resonance export file');
  }

  let imported = 0;
  for (const entry of payload.entries) {
    await addResonanceEntry({
      title: entry.title || 'Imported',
      type: entry.type || 'prompt',
      content: entry.content || '',
      tags: entry.tags || [],
      activationRelated: entry.activationRelated || false,
    });
    imported++;
  }

  return { imported };
}
