import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import {
  DEFAULT_PROMPT_PRESET_ID,
  DEFAULT_SETTINGS,
  DEFAULT_WORLDBOOK_PRESET_ID,
  EXTENSION_NAME
} from './constants.js';

function cloneDefaults() {
  return structuredClone(DEFAULT_SETTINGS);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeDefaults(target, defaults) {
  const output = isPlainObject(target) ? target : {};
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const currentValue = output[key];

    if (Array.isArray(defaultValue)) {
      output[key] = Array.isArray(currentValue) ? currentValue : structuredClone(defaultValue);
      continue;
    }

    if (isPlainObject(defaultValue)) {
      output[key] = deepMergeDefaults(isPlainObject(currentValue) ? currentValue : {}, defaultValue);
      continue;
    }

    if (currentValue === undefined || currentValue === null) {
      output[key] = defaultValue;
    }
  }
  return output;
}

function ensurePromptPreset(settings) {
  if (!settings.prompt.presets[DEFAULT_PROMPT_PRESET_ID]) {
    settings.prompt.presets[DEFAULT_PROMPT_PRESET_ID] = structuredClone(
      DEFAULT_SETTINGS.prompt.presets[DEFAULT_PROMPT_PRESET_ID]
    );
  }
  if (!settings.prompt.activePresetId) {
    settings.prompt.activePresetId = DEFAULT_PROMPT_PRESET_ID;
  }
}

function ensureWorldbookPresetPointer(settings) {
  if (!settings.worldbook.activePresetId) {
    settings.worldbook.activePresetId = DEFAULT_WORLDBOOK_PRESET_ID;
  }
}

export function getSettings() {
  if (!extension_settings[EXTENSION_NAME]) {
    extension_settings[EXTENSION_NAME] = cloneDefaults();
    saveSettingsDebounced();
  }

  const merged = deepMergeDefaults(extension_settings[EXTENSION_NAME], DEFAULT_SETTINGS);
  ensurePromptPreset(merged);
  ensureWorldbookPresetPointer(merged);
  extension_settings[EXTENSION_NAME] = merged;
  return merged;
}

export function saveSettings() {
  saveSettingsDebounced();
}

export function updateSettings(mutator) {
  const settings = getSettings();
  mutator(settings);
  saveSettings();
  return settings;
}

export function sanitizeApiKey(input) {
  const key = (input ?? '').trim();
  return key.replace(/^Bearer\s+/i, '');
}
