#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { processTree, processFile, runSelfTest } from './cleanup-comments.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(ROOT, 'backups');
const STATE_FILE = path.join(BACKUP_DIR, 'cleanup-state.json');
const LOG_FILE = path.join(BACKUP_DIR, 'cleanup-log.txt');
const TZ = 'Africa/Dakar';

const FOLDERS = [
  { name: 'src/lib', paths: ['src/lib'] },
  { name: 'src/components/bitlab', paths: ['src/components/bitlab'] },
  { name: 'src/components/ui+hooks', paths: ['src/components/ui', 'src/hooks'] },
  { name: 'src/app', paths: ['src/app'] },
  { name: 'tests', paths: ['tests'] },
  { name: 'scripts', paths: ['scripts'] },
  { name: 'rust/lnlab', paths: ['rust/lnlab/src'] },
  { name: 'rust/miner', paths: ['rust/miner/src'] },
  {
    name: 'public-workers',
    files: [
      'public/miner/worker.js',
      'public/miner/js-engine.js',
      'public/miner/bytes.js',
      'public/miner/miner.js',
      'public/lnlab/worker.js',
      'public/lnlab/lnlab.js',
    ],
  },
];

function nowParts() {
  const d = new Date();
  const hour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(d);
  const stamp = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(d);
  return { hour: hour === '24' ? '00' : hour, stamp: stamp.replace(',', ' —') };
}

function logLine(msg) {
  const { stamp } = nowParts();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `[${stamp}] ${msg}\n`, 'utf8');
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
      ;
    }
  }
  return { nextIndex: 0, history: [], complete: false, startedAt: null };
}

function saveState(state) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function hasNodeModules() {
  return fs.existsSync(path.join(ROOT, 'node_modules', '.bin'));
}

function runGate(what, cmd, args) {
  try {
    execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 240000 });
    return { ok: true };
  } catch (e) {
    const out = `${e.stdout || ''}\n${e.stderr || ''}`.trim().slice(0, 2000);
    return { ok: false, output: out };
  }
}

function qualityGates() {
  if (!hasNodeModules()) return { ok: true, skipped: 'node_modules absent' };
  const tsc = runGate('tsc', path.join(ROOT, 'node_modules', '.bin', 'tsc'), ['--noEmit']);
  if (!tsc.ok) return { ok: false, gate: 'tsc', output: tsc.output };
  const vitest = runGate('vitest', path.join(ROOT, 'node_modules', '.bin', 'vitest'), ['run', '--reporter=dot']);
  if (!vitest.ok) return { ok: false, gate: 'vitest', output: vitest.output };
  return { ok: true };
}

function rollbackFiles(files) {
  if (!files.length) return;
  try {
    git(['checkout', '--', ...files.map((f) => path.relative(ROOT, f))]);
  } catch (e) {
    logLine(`ROLLBACK FAILED: ${e.message}`);
  }
}

function processFolder(folder, { dryRun }) {
  const changed = [];
  const errors = [];
  let totals = {
    files: 0, filesChanged: 0, commentsRemoved: 0, fr: 0, en: 0,
    directivesPreserved: 0, licensePreserved: 0, linesBefore: 0, linesAfter: 0,
  };
  if (folder.files) {
    for (const rel of folder.files) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      try {
        const r = processFile(abs, { dryRun });
        if (!r.skipped) {
          totals.files++;
          if (r.changed) {
            totals.filesChanged++;
            changed.push(abs);
            totals.commentsRemoved += r.stats.commentsRemoved;
            totals.fr += r.stats.fr;
            totals.en += r.stats.en;
            totals.directivesPreserved += r.stats.directivesPreserved;
            totals.licensePreserved += r.stats.licensePreserved;
            totals.linesBefore += r.stats.linesBefore;
            totals.linesAfter += r.stats.linesAfter;
          }
        }
      } catch (e) {
        errors.push({ file: abs, error: e.message });
      }
    }
  } else {
    for (const p of folder.paths) {
      const abs = path.join(ROOT, p);
      if (!fs.existsSync(abs)) continue;
      const { results, totals: t } = processTree(abs, { dryRun });
      totals.files += t.files;
      totals.filesChanged += t.filesChanged;
      totals.commentsRemoved += t.commentsRemoved;
      totals.fr += t.fr;
      totals.en += t.en;
      totals.directivesPreserved += t.directivesPreserved;
      totals.licensePreserved += t.licensePreserved;
      totals.linesBefore += t.linesBefore;
      totals.linesAfter += t.linesAfter;
      for (const r of results) if (r.changed) changed.push(r.file);
      errors.push(...t.errors);
    }
  }
  return { changed, errors, totals };
}

function runCycle({ dryRun = false } = {}) {
  const { hour, stamp } = nowParts();
  const state = loadState();
  if (!state.startedAt) state.startedAt = stamp;
  const idx = state.nextIndex % FOLDERS.length;
  const folder = FOLDERS[idx];
  const firstPass = state.nextIndex < FOLDERS.length;

  const res = processFolder(folder, { dryRun });
  const entry = {
    folder: folder.name,
    stamp,
    hour,
    firstPass,
    files: res.totals.files,
    filesChanged: res.totals.filesChanged,
    commentsRemoved: res.totals.commentsRemoved,
    fr: res.totals.fr,
    en: res.totals.en,
    linesRemoved: res.totals.linesBefore - res.totals.linesAfter,
  };

  if (res.errors.length) {
    rollbackFiles(res.changed);
    entry.status = 'error-rolled-back';
    entry.errors = res.errors.map((e) => `${path.relative(ROOT, e.file)}: ${e.error.split('\n')[0]}`);
    logLine(`ERREUR ${folder.name} — rollback de ${res.changed.length} fichiers. ${entry.errors.join(' | ')}`);
    if (!dryRun) {
      state.nextIndex++;
      state.history.push(entry);
      saveState(state);
    }
    return entry;
  }

  if (res.totals.filesChanged === 0) {
    entry.status = firstPass ? 'already-clean' : 'nothing-to-do';
    logLine(`${folder.name} — rien à nettoyer (${res.totals.files} fichiers scannés).`);
    if (!dryRun) {
      state.nextIndex++;
      if (state.nextIndex >= FOLDERS.length) state.complete = true;
      state.history.push(entry);
      saveState(state);
    }
    return entry;
  }

  if (dryRun) {
    entry.status = 'dry-run';
    rollbackFiles(res.changed);
    return entry;
  }

  const gates = qualityGates();
  if (!gates.ok) {
    rollbackFiles(res.changed);
    entry.status = 'gate-failed-rolled-back';
    entry.gate = gates.gate;
    logLine(`GARDE-FOU ${gates.gate} ÉCHOUÉ sur ${folder.name} — rollback de ${res.changed.length} fichiers. Détail: ${(gates.output || '').split('\n').slice(0, 6).join(' | ').slice(0, 600)}`);
    state.nextIndex++;
    state.history.push(entry);
    saveState(state);
    return entry;
  }

  const relFiles = res.changed.map((f) => path.relative(ROOT, f));
  git(['add', '--', ...relFiles]);
  const msg = `chore(comments): strip FR+EN comments from ${folder.name} (${res.totals.commentsRemoved} comments, ${entry.linesRemoved} lines)`;
  git(['-c', 'user.name=BitLab Cleanup Scheduler', '-c', 'user.email=scheduler@bitlab.local', 'commit', '-m', msg]);
  const commitHash = git(['rev-parse', '--short', 'HEAD']);

  const zipName = `backup-bitlab-${hour}h.zip`;
  const zipPath = path.join(BACKUP_DIR, zipName);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  execFileSync('git', ['archive', '--format=zip', '--output', zipPath, 'HEAD'], { cwd: ROOT });
  const zipKB = Math.round(fs.statSync(zipPath).size / 1024);

  entry.status = 'success';
  entry.commit = commitHash.slice(0, 7);
  entry.backup = zipName;
  entry.backupKB = zipKB;
  logLine(`${folder.name} — ${res.totals.commentsRemoved} commentaires supprimés (fr ${res.totals.fr} / en ${res.totals.en}), ${entry.linesRemoved} lignes en moins sur ${res.totals.filesChanged}/${res.totals.files} fichiers — commit ${entry.commit} — ${zipName} (${zipKB} KB)`);

  state.nextIndex++;
  if (state.nextIndex >= FOLDERS.length) state.complete = true;
  state.history.push(entry);
  saveState(state);
  return entry;
}

function printStatus() {
  const state = loadState();
  const { stamp } = nowParts();
  console.log(`BitLab comment-cleanup scheduler — état au ${stamp} (TZ ${TZ})`);
  console.log(`Dossier projet : ${ROOT}`);
  console.log('');
  console.log('Rotation (1 dossier par heure) :');
  FOLDERS.forEach((f, k) => {
    const h = state.history.filter((e) => e.folder === f.name && e.firstPass);
    const done = h.length > 0 ? h[0] : null;
    const mark = done ? (done.status === 'success' ? `✔ ${done.commentsRemoved} comm. — ${done.commit || ''}` : done.status === 'already-clean' ? '✔ déjà propre' : `✘ ${done.status}`) : (k < state.nextIndex ? '?' : 'en attente');
    console.log(`  ${String(k + 1).padStart(2)}. ${f.name.padEnd(24)} ${mark}`);
  });
  console.log('');
  console.log(`Cycle complet : ${state.complete ? 'OUI (mode maintenance)' : 'NON'} — prochaine étape : index ${state.nextIndex}`);
  console.log(`Historique : ${state.history.length} cycles enregistrés`);
  if (fs.existsSync(LOG_FILE)) {
    console.log('');
    console.log('Dernières lignes du journal :');
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    console.log(lines.slice(-8).map((l) => `  ${l}`).join('\n'));
  }
  if (fs.existsSync(BACKUP_DIR)) {
    console.log('');
    console.log('Backups présents :');
    for (const f of fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.zip')).sort()) {
      const kb = Math.round(fs.statSync(path.join(BACKUP_DIR, f)).size / 1024);
      console.log(`  ${f} (${kb} KB)`);
    }
  }
  try {
    console.log('');
    console.log('Derniers commits :');
    console.log(git(['log', '--oneline', '-8']).split('\n').map((l) => `  ${l}`).join('\n'));
  } catch {
    ;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--status')) {
    printStatus();
    return;
  }
  if (args.includes('--reset')) {
    fs.rmSync(STATE_FILE, { force: true });
    console.log('state réinitialisé — la rotation repartira du premier dossier.');
    return;
  }
  const dryRun = args.includes('--dry-run');
  const selfTest = runSelfTest();
  if (selfTest.passed !== selfTest.total) {
    console.error(`self-test échoué (${selfTest.passed}/${selfTest.total}) — exécution annulée.`);
    process.exit(1);
  }
  const entry = runCycle({ dryRun });
  if (dryRun) {
    console.log(`[dry-run] ${entry.folder}: ${entry.commentsRemoved} commentaires seraient supprimés (${entry.filesChanged}/${entry.files} fichiers, ${entry.linesRemoved} lignes).`);
  } else {
    console.log(`${entry.folder} — ${entry.status}${entry.commit ? ` — commit ${entry.commit}` : ''}${entry.backup ? ` — ${entry.backup}` : ''}`);
  }
}

main();
