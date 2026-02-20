import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const SYSTEM_CONTROLS_FILE = path.join(DATA_DIR, 'system-controls.json');

export const DEFAULT_SYSTEM_CONTROLS = {
  emailVerificationEnabled: true,
  requireProfileCompletion: true,
  apiEnabled: true,
  updatedAt: null,
  updatedBy: null,
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(SYSTEM_CONTROLS_FILE)) {
    fs.writeFileSync(
      SYSTEM_CONTROLS_FILE,
      JSON.stringify(DEFAULT_SYSTEM_CONTROLS, null, 2),
      'utf8'
    );
  }
}

function normalizeControls(raw = {}) {
  return {
    emailVerificationEnabled:
      typeof raw.emailVerificationEnabled === 'boolean'
        ? raw.emailVerificationEnabled
        : DEFAULT_SYSTEM_CONTROLS.emailVerificationEnabled,
    requireProfileCompletion:
      typeof raw.requireProfileCompletion === 'boolean'
        ? raw.requireProfileCompletion
        : DEFAULT_SYSTEM_CONTROLS.requireProfileCompletion,
    apiEnabled:
      typeof raw.apiEnabled === 'boolean'
        ? raw.apiEnabled
        : DEFAULT_SYSTEM_CONTROLS.apiEnabled,
    updatedAt: raw.updatedAt || null,
    updatedBy: raw.updatedBy || null,
  };
}

export function getSystemControlsSync() {
  try {
    ensureStorage();
    const raw = fs.readFileSync(SYSTEM_CONTROLS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return normalizeControls(parsed);
  } catch (error) {
    console.error('[system-controls] read failed, using defaults:', error.message);
    return { ...DEFAULT_SYSTEM_CONTROLS };
  }
}

export function updateSystemControlsSync(patch = {}, updatedBy = null) {
  const current = getSystemControlsSync();
  const next = normalizeControls({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy || null,
  });

  ensureStorage();
  fs.writeFileSync(SYSTEM_CONTROLS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
