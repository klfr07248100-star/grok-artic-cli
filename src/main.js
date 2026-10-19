/**
 * Grok Artic CLI — Core Entry Point
 * Sovereign, local-first command line interface
 */

import { createIdentity, getIdentityStatus, loadIdentity } from './identity.js';
import {
  getResonanceStatus,
  addResonanceEntry,
  listResonanceEntries,
  exportResonance,
  importResonance,
  getActivationState,
  setActivationState,
} from './resonance.js';

const VERSION = '0.4.0';
const NAME = 'Grok Artic CLI';

const HELP = `
${NAME} v${VERSION}
Sovereign · Local-first · AI-native

Usage:
  artic <command> [options]

Core:
  version, -v          Show version
  help, -h             Show this help
  status               Show full local system status
  init                 Initialize local Grok Artic workspace
  manifesto            Show Successor Manifesto summary

Identity:
  identity             Show identity status
  identity create      Create local sovereign identity
  whoami               Alias for identity

Resonance:
  resonance            Show Resonance store + activation status
  resonance list       List entries
  resonance add        Add prompt/strategy
  resonance export     Export all entries + activation state
  resonance import     Import entries from JSON file
  resonance activate   Mark Resonance as activated
  resonance deactivate Clear activation state

Examples:
  artic identity create
  artic resonance add --title="Principle" --content="User is root of trust"
  artic resonance activate
  artic resonance export
  artic status
`;

async function main(args) {
  const command = (args[0] || 'help').toLowerCase();
  const sub = (args[1] || '').toLowerCase();

  switch (command) {
    case 'version':
    case '-v':
    case '--version':
      console.log(`${NAME} v${VERSION}`);
      break;

    case 'help':
    case '-h':
    case '--help':
      console.log(HELP);
      break;

    case 'status':
      await printFullStatus();
      break;

    case 'whoami':
    case 'identity':
      if (sub === 'create') {
        await handleIdentityCreate(args);
      } else {
        await printIdentity();
      }
      break;

    case 'resonance':
      if (sub === 'list') {
        await handleResonanceList();
      } else if (sub === 'add') {
        await handleResonanceAdd(args);
      } else if (sub === 'export') {
        await handleResonanceExport(args);
      } else if (sub === 'import') {
        await handleResonanceImport(args);
      } else if (sub === 'activate') {
        await handleActivate(args);
      } else if (sub === 'deactivate') {
        await handleDeactivate();
      } else {
        await printResonance();
      }
      break;

    case 'init':
      await initLocal();
      break;

    case 'manifesto':
      printManifestoSummary();
      break;

    default:
      console.log(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

async function printFullStatus() {
  const idStatus = await getIdentityStatus();
  const resStatus = await getResonanceStatus();

  console.log(`
◈ Grok Artic Status
──────────────────
CLI Version     : ${VERSION}
Mode            : Local-first (default)

Identity        : ${idStatus.status === 'active' ? idStatus.fingerprint : idStatus.message}
Resonance       : ${resStatus.status === 'active' ? resStatus.entries + ' entries' : resStatus.status}
Activated       : ${resStatus.activated ? 'Yes (' + (resStatus.activatedAt || '').slice(0, 10) + ')' : 'No'}
Workspace       : Local (~/.grok-artic)
Cloud Sync      : Disabled (sovereign default)
`);
}

async function printIdentity() {
  const status = await getIdentityStatus();
  if (status.status === 'active') {
    console.log(`
◈ Identity
──────────
Status          : Active
Name            : ${status.name}
Fingerprint     : ${status.fingerprint}
Created         : ${status.created}
`);
  } else {
    console.log(`
◈ Identity
──────────
Status          : None
${status.message}
`);
  }
}

async function handleIdentityCreate(args) {
  const nameArg = args.find(a => a.startsWith('--name='));
  const name = nameArg ? nameArg.split('=')[1] : 'sovereign-user';

  const existing = await loadIdentity();
  if (existing) {
    console.log('Identity already exists.');
    console.log(`Fingerprint: ${existing.fingerprint}`);
    console.log('Delete ~/.grok-artic/identity.json first if you want to recreate.');
    return;
  }

  const id = await createIdentity(name);
  console.log(`
◈ Local Sovereign Identity Created
──────────────────────────────────
Name            : ${id.name}
Fingerprint     : ${id.fingerprint}
Location        : ~/.grok-artic/identity.json

Keep this file safe. It is your local root of trust.
`);
}

async function printResonance() {
  const status = await getResonanceStatus();
  console.log(`
◈ Resonance Layer
─────────────────
Status          : ${status.status}
Location        : ${status.location || 'N/A'}
Entries         : ${status.entries ?? 0}
Activated       : ${status.activated ? 'Yes' : 'No'}
Activated At    : ${status.activatedAt || '—'}
Last Updated    : ${status.lastUpdated || 'Never'}
`);
}

async function handleResonanceList() {
  const entries = await listResonanceEntries();
  if (entries.length === 0) {
    console.log('No Resonance entries yet.');
    return;
  }
  console.log('\n◈ Resonance Entries\n');
  for (const e of entries) {
    const flag = e.activationRelated ? ' [activation]' : '';
    console.log(`  ${e.id}  [${e.type}]  ${e.title}${flag}  (${e.created.slice(0, 10)})`);
  }
  console.log();
}

async function handleResonanceAdd(args) {
  const titleArg = args.find(a => a.startsWith('--title='));
  const contentArg = args.find(a => a.startsWith('--content='));
  const typeArg = args.find(a => a.startsWith('--type='));
  const tagsArg = args.find(a => a.startsWith('--tags='));
  const actArg = args.find(a => a === '--activation' || a === '--activation-related');

  const title = titleArg ? titleArg.split('=').slice(1).join('=') : 'Untitled';
  const content = contentArg ? contentArg.split('=').slice(1).join('=') : '';
  const type = typeArg ? typeArg.split('=')[1] : 'prompt';
  const tags = tagsArg ? tagsArg.split('=')[1].split(',').map(t => t.trim()) : [];
  const activationRelated = !!actArg;

  if (!content) {
    console.log('Usage: artic resonance add --title="My Prompt" --content="..." [--type=prompt|strategy] [--tags=a,b] [--activation]');
    return;
  }

  const entry = await addResonanceEntry({ title, type, content, tags, activationRelated });
  console.log(`
◈ Resonance Entry Added
───────────────────────
ID     : ${entry.id}
Title  : ${entry.title}
Type   : ${entry.type}
`);
}

async function handleResonanceExport(args) {
  const outArg = args.find(a => a.startsWith('--out='));
  const outPath = outArg ? outArg.split('=')[1] : undefined;
  const result = await exportResonance(outPath);
  console.log(`
◈ Resonance Exported
────────────────────
File   : ${result.file}
Entries: ${result.count}
`);
}

async function handleResonanceImport(args) {
  const file = args[2];
  if (!file) {
    console.log('Usage: artic resonance import <file.json>');
    return;
  }
  const result = await importResonance(file);
  console.log(`
◈ Resonance Imported
────────────────────
Entries imported: ${result.imported}
`);
}

async function handleActivate(args) {
  const noteArg = args.find(a => a.startsWith('--note='));
  const note = noteArg ? noteArg.split('=').slice(1).join('=') : null;
  const state = await setActivationState(true, note);
  console.log(`
◈ Resonance Activated
─────────────────────
Activated At : ${state.activatedAt}
Note         : ${state.note || '—'}

This is a local, user-controlled flag. It does not phone home.
`);
}

async function handleDeactivate() {
  await setActivationState(false);
  console.log('◈ Resonance activation state cleared.');
}

async function initLocal() {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const articDir = path.join(os.homedir(), '.grok-artic');

  try {
    await fs.mkdir(articDir, { recursive: true });
    await fs.mkdir(path.join(articDir, 'resonance'), { recursive: true });
    await fs.mkdir(path.join(articDir, 'workspace'), { recursive: true });

    const config = {
      version: VERSION,
      initialized: new Date().toISOString(),
      mode: 'local-first',
    };

    await fs.writeFile(
      path.join(articDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log(`
◈ Local Grok Artic workspace initialized
────────────────────────────────────────
Location : ${articDir}
Mode     : local-first

Next:
  artic identity create
  artic resonance add --title="..." --content="..."
  artic resonance activate
`);
  } catch (err) {
    console.error('Failed to initialize:', err.message);
    process.exitCode = 1;
  }
}

function printManifestoSummary() {
  console.log(`
◈ Grok Artic Successor Manifesto (Summary)
──────────────────────────────────────────

We are building a successor layer to centralized platforms.

Core Principles:
  • User as root of trust
  • Local-first, cloud-optional
  • AI context travels with the user (Resonance)
  • Fair economics (low take-rates)
  • Progress that can benefit more than one person

Aligned with 2026 local-first and portable-memory directions.
This CLI is the first real, runnable component of that vision.
`);
}

export { main };
