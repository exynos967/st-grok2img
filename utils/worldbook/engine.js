import { DEFAULT_WORLDBOOK_PRESET_ID } from '../constants.js';
import { checkEntryTrigger } from './matcher.js';

const DEFAULT_WORLDBOOK_URL = new URL('../../defaults/worldbook-default.json', import.meta.url).toString();

function normalizeEntry(input, index) {
  const entry = input && typeof input === 'object' ? input : {};
  return {
    uid: Number.isFinite(entry.uid) ? entry.uid : index,
    key: Array.isArray(entry.key) ? entry.key : [],
    keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
    comment: String(entry.comment || ''),
    content: String(entry.content || ''),
    constant: Boolean(entry.constant),
    selective: Boolean(entry.selective),
    selectiveLogic: Number.isFinite(entry.selectiveLogic) ? entry.selectiveLogic : 0,
    order: Number.isFinite(entry.order) ? entry.order : 0,
    disable: Boolean(entry.disable),
    caseSensitive: Boolean(entry.caseSensitive),
    matchWholeWords: Boolean(entry.matchWholeWords)
  };
}

export function parseWorldbook(rawJson) {
  const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  const sourceEntries = parsed?.entries;

  let list = [];
  if (Array.isArray(sourceEntries)) {
    list = sourceEntries;
  } else if (sourceEntries && typeof sourceEntries === 'object') {
    list = Object.values(sourceEntries);
  }

  return list
    .map((entry, index) => normalizeEntry(entry, index))
    .filter((entry) => Boolean(entry.content))
    .sort((left, right) => right.order - left.order);
}

export function replaceWorldbookVariables(text, variables) {
  const map = variables && typeof variables === 'object' ? variables : {};
  return String(text || '').replace(/\{\{getvar::([^}]+)\}\}/g, (_, key) => {
    const value = map[key.trim()];
    return value == null ? '' : String(value);
  });
}

export function buildWorldbookContent({ entries, sourceText, variables }) {
  const text = String(sourceText || '');
  const matchedEntries = [];

  for (const entry of entries) {
    if (!checkEntryTrigger(entry, text)) {
      continue;
    }

    matchedEntries.push({
      uid: entry.uid,
      comment: entry.comment,
      order: entry.order,
      content: replaceWorldbookVariables(entry.content, variables)
    });
  }

  matchedEntries.sort((left, right) => right.order - left.order);
  const worldbookContent = matchedEntries
    .map((item) => item.content.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return { worldbookContent, matchedEntries };
}

export function getActiveWorldbookPreset(settings) {
  const presets = settings.worldbook?.presets || {};
  const activeId = settings.worldbook?.activePresetId;
  return presets[activeId] || null;
}

export function processWorldbookForPrompt(settings, sourceText) {
  if (!settings.worldbook?.enabled) {
    return { worldbookContent: '', matchedEntries: [] };
  }

  const activePreset = getActiveWorldbookPreset(settings);
  if (!activePreset?.rawJson) {
    return { worldbookContent: '', matchedEntries: [] };
  }

  try {
    const entries = parseWorldbook(activePreset.rawJson);
    return buildWorldbookContent({
      entries,
      sourceText,
      variables: settings.worldbook.variables
    });
  } catch (error) {
    console.warn('[st-grok2img] failed to parse worldbook json', error);
    return { worldbookContent: '', matchedEntries: [] };
  }
}

export async function ensureDefaultWorldbookPreset(settings) {
  if (settings.worldbook?.presets && Object.keys(settings.worldbook.presets).length > 0) {
    return;
  }

  const response = await fetch(DEFAULT_WORLDBOOK_URL);
  if (!response.ok) {
    throw new Error(`failed to load default worldbook: ${response.status}`);
  }

  const rawJson = await response.text();
  settings.worldbook.presets = {
    [DEFAULT_WORLDBOOK_PRESET_ID]: {
      id: DEFAULT_WORLDBOOK_PRESET_ID,
      name: '默认世界书',
      rawJson
    }
  };
  settings.worldbook.activePresetId = DEFAULT_WORLDBOOK_PRESET_ID;
}
