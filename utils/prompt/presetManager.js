import { DEFAULT_PROMPT_PRESET_ID } from '../constants.js';

function normalizePreset(input, fallbackId = DEFAULT_PROMPT_PRESET_ID) {
  const id = String(input?.id || fallbackId);
  return {
    id,
    name: String(input?.name || id),
    fixedPrefix: String(input?.fixedPrefix || ''),
    fixedSuffix: String(input?.fixedSuffix || ''),
    negativePrompt: String(input?.negativePrompt || ''),
    replaceRulesText: String(input?.replaceRulesText || '')
  };
}

export function ensurePromptPresetState(settings) {
  if (!settings.prompt || typeof settings.prompt !== 'object') {
    settings.prompt = { activePresetId: DEFAULT_PROMPT_PRESET_ID, presets: {} };
  }

  if (!settings.prompt.presets || typeof settings.prompt.presets !== 'object') {
    settings.prompt.presets = {};
  }

  const entries = Object.entries(settings.prompt.presets);
  if (entries.length === 0) {
    settings.prompt.presets[DEFAULT_PROMPT_PRESET_ID] = normalizePreset({
      id: DEFAULT_PROMPT_PRESET_ID,
      name: '默认'
    });
  }

  for (const [key, preset] of Object.entries(settings.prompt.presets)) {
    settings.prompt.presets[key] = normalizePreset(preset, key);
  }

  if (!settings.prompt.activePresetId || !settings.prompt.presets[settings.prompt.activePresetId]) {
    settings.prompt.activePresetId = Object.keys(settings.prompt.presets)[0];
  }
}

export function listPromptPresets(settings) {
  ensurePromptPresetState(settings);
  return Object.values(settings.prompt.presets);
}

export function getActivePromptPreset(settings) {
  ensurePromptPresetState(settings);
  return settings.prompt.presets[settings.prompt.activePresetId];
}

export function setActivePromptPreset(settings, presetId) {
  ensurePromptPresetState(settings);
  if (settings.prompt.presets[presetId]) {
    settings.prompt.activePresetId = presetId;
  }
  return getActivePromptPreset(settings);
}

export function updateActivePromptPreset(settings, patch) {
  const active = getActivePromptPreset(settings);
  const merged = normalizePreset({ ...active, ...patch }, active.id);
  settings.prompt.presets[active.id] = merged;
  return merged;
}

function buildPresetId(name) {
  const compact = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Date.now().toString(36);
  return `${compact || 'preset'}-${suffix}`;
}

export function createPromptPreset(settings, name, seedPreset) {
  ensurePromptPresetState(settings);
  const base = seedPreset ? normalizePreset(seedPreset, buildPresetId(name)) : normalizePreset({ id: buildPresetId(name), name });
  base.id = buildPresetId(name || base.name);
  base.name = String(name || base.name || base.id);
  settings.prompt.presets[base.id] = base;
  settings.prompt.activePresetId = base.id;
  return base;
}

export function deletePromptPreset(settings, presetId) {
  ensurePromptPresetState(settings);
  const ids = Object.keys(settings.prompt.presets);
  if (ids.length <= 1) {
    return false;
  }
  if (!settings.prompt.presets[presetId]) {
    return false;
  }

  delete settings.prompt.presets[presetId];
  if (settings.prompt.activePresetId === presetId) {
    settings.prompt.activePresetId = Object.keys(settings.prompt.presets)[0];
  }
  return true;
}

export function exportPromptPreset(settings, presetId) {
  ensurePromptPresetState(settings);
  const target = settings.prompt.presets[presetId] || getActivePromptPreset(settings);
  return {
    schema: 'st-grok2img/prompt-preset@1',
    exportedAt: new Date().toISOString(),
    preset: target
  };
}

export function importPromptPreset(settings, payload) {
  ensurePromptPresetState(settings);
  const sourcePreset = payload?.preset || payload;
  const imported = normalizePreset(sourcePreset, buildPresetId(sourcePreset?.name || 'imported'));
  imported.id = buildPresetId(imported.name);
  settings.prompt.presets[imported.id] = imported;
  settings.prompt.activePresetId = imported.id;
  return imported;
}
