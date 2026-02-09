import { DEFAULT_PROMPT_PRESET_ID } from '../constants.js';
import { runtimeState } from '../state.js';
import { getSettings, sanitizeApiKey, updateSettings } from '../settingsStore.js';
import { bindTabNavigation, loadTabHtml, setActiveTabButton } from './tabs.js';

const SETTINGS_HTML_URL = new URL('../../settings.html', import.meta.url).toString();

function setValue(input, value) {
  if (!input) return;
  if (input.type === 'checkbox') {
    input.checked = Boolean(value);
  } else {
    input.value = value ?? '';
  }
}

function getCurrentPromptPreset(settings) {
  const currentId = settings.prompt.activePresetId || DEFAULT_PROMPT_PRESET_ID;
  return settings.prompt.presets[currentId] || settings.prompt.presets[DEFAULT_PROMPT_PRESET_ID];
}

function updatePromptPresetSelect(root, settings) {
  const select = root.querySelector('#g2-prompt-preset-select');
  if (!select) return;

  const entries = Object.values(settings.prompt.presets);
  select.innerHTML = '';
  for (const preset of entries) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    select.append(option);
  }
  select.value = settings.prompt.activePresetId;
}

function updateWorldbookPresetSelect(root, settings) {
  const select = root.querySelector('#g2-worldbook-preset-select');
  if (!select) return;

  select.innerHTML = '';
  for (const [presetId, preset] of Object.entries(settings.worldbook.presets)) {
    const option = document.createElement('option');
    option.value = presetId;
    option.textContent = preset.name || presetId;
    select.append(option);
  }
  if (!settings.worldbook.presets[settings.worldbook.activePresetId]) {
    settings.worldbook.activePresetId = Object.keys(settings.worldbook.presets)[0] || '';
  }
  select.value = settings.worldbook.activePresetId;
}

function bindMainTab(root) {
  const settings = getSettings();

  setValue(root.querySelector('#g2-enabled'), settings.enabled);
  setValue(root.querySelector('#g2-api-base-url'), settings.api.baseUrl);
  setValue(root.querySelector('#g2-api-key'), settings.api.apiKey);
  setValue(root.querySelector('#g2-api-model'), settings.api.model);
  setValue(root.querySelector('#g2-trigger-auto'), settings.trigger.autoGenerate);
  setValue(root.querySelector('#g2-start-tag'), settings.trigger.startTag);
  setValue(root.querySelector('#g2-end-tag'), settings.trigger.endTag);
  setValue(root.querySelector('#g2-generation-interval'), settings.trigger.generationIntervalMs);
  setValue(root.querySelector('#g2-insert-original'), settings.ui.insertOriginalText);

  root.querySelector('#g2-enabled')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.enabled = event.target.checked;
    });
  });

  root.querySelector('#g2-api-base-url')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.api.baseUrl = event.target.value.trim();
    });
  });

  root.querySelector('#g2-api-key')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.api.apiKey = sanitizeApiKey(event.target.value);
      event.target.value = next.api.apiKey;
    });
  });

  root.querySelector('#g2-api-model')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.api.model = event.target.value.trim();
    });
  });

  root.querySelector('#g2-trigger-auto')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.trigger.autoGenerate = event.target.checked;
    });
  });

  root.querySelector('#g2-start-tag')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.trigger.startTag = event.target.value || '[';
    });
  });

  root.querySelector('#g2-end-tag')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.trigger.endTag = event.target.value || ']';
    });
  });

  root.querySelector('#g2-generation-interval')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const parsed = Number.parseInt(event.target.value, 10);
      next.trigger.generationIntervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      event.target.value = String(next.trigger.generationIntervalMs);
    });
  });

  root.querySelector('#g2-insert-original')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.ui.insertOriginalText = event.target.checked;
    });
  });
}

function bindPromptTab(root) {
  const settings = getSettings();
  const preset = getCurrentPromptPreset(settings);

  updatePromptPresetSelect(root, settings);
  setValue(root.querySelector('#g2-fixed-prefix'), preset.fixedPrefix);
  setValue(root.querySelector('#g2-fixed-suffix'), preset.fixedSuffix);
  setValue(root.querySelector('#g2-negative-prompt'), preset.negativePrompt);
  setValue(root.querySelector('#g2-replace-rules'), preset.replaceRulesText);

  root.querySelector('#g2-prompt-preset-select')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      if (next.prompt.presets[event.target.value]) {
        next.prompt.activePresetId = event.target.value;
      }
    });
    bindPromptTab(root);
  });

  root.querySelector('#g2-fixed-prefix')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getCurrentPromptPreset(next);
      active.fixedPrefix = event.target.value;
    });
  });

  root.querySelector('#g2-fixed-suffix')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getCurrentPromptPreset(next);
      active.fixedSuffix = event.target.value;
    });
  });

  root.querySelector('#g2-negative-prompt')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getCurrentPromptPreset(next);
      active.negativePrompt = event.target.value;
    });
  });

  root.querySelector('#g2-replace-rules')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getCurrentPromptPreset(next);
      active.replaceRulesText = event.target.value;
    });
  });
}

function bindWorldbookTab(root) {
  const settings = getSettings();
  setValue(root.querySelector('#g2-worldbook-enabled'), settings.worldbook.enabled);
  setValue(root.querySelector('#g2-worldbook-variables'), JSON.stringify(settings.worldbook.variables, null, 2));

  updateWorldbookPresetSelect(root, settings);
  const activePreset = settings.worldbook.presets[settings.worldbook.activePresetId];
  setValue(root.querySelector('#g2-worldbook-json'), activePreset?.rawJson || '');

  root.querySelector('#g2-worldbook-enabled')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.worldbook.enabled = event.target.checked;
    });
  });

  root.querySelector('#g2-worldbook-variables')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      try {
        next.worldbook.variables = JSON.parse(event.target.value || '{}');
      } catch {
        event.target.value = JSON.stringify(next.worldbook.variables, null, 2);
      }
    });
  });

  root.querySelector('#g2-worldbook-preset-select')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.worldbook.activePresetId = event.target.value;
    });
    bindWorldbookTab(root);
  });

  root.querySelector('#g2-worldbook-json')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const target = next.worldbook.presets[next.worldbook.activePresetId];
      if (target) {
        target.rawJson = event.target.value;
      }
    });
  });
}

function bindLogTab(root) {
  root.querySelector('#g2-log-clear')?.addEventListener('click', () => {
    const list = root.querySelector('#g2-log-list');
    if (list) {
      list.innerHTML = '';
    }
  });
}

function bindCurrentTab(modalElement, tabId) {
  const content = modalElement.querySelector('#st-grok2img-tab-content');
  if (!content) return;

  if (tabId === 'main') bindMainTab(content);
  if (tabId === 'prompt') bindPromptTab(content);
  if (tabId === 'worldbook') bindWorldbookTab(content);
  if (tabId === 'log') bindLogTab(content);
}

async function renderTab(modalElement, tabId) {
  const content = modalElement.querySelector('#st-grok2img-tab-content');
  if (!content) return;

  runtimeState.activeTab = tabId;
  await loadTabHtml(tabId, content);
  setActiveTabButton(modalElement, tabId);
  bindCurrentTab(modalElement, tabId);
}

function toggleModalVisibility(show) {
  if (!runtimeState.modalElement) return;
  runtimeState.modalElement.classList.toggle('st-g2-hidden', !show);
}

export function openModal() {
  toggleModalVisibility(true);
}

export function closeModal() {
  toggleModalVisibility(false);
}

export async function mountModal() {
  if (runtimeState.modalElement) {
    return runtimeState.modalElement;
  }

  const htmlResponse = await fetch(SETTINGS_HTML_URL);
  if (!htmlResponse.ok) {
    throw new Error(`failed to load settings.html: ${htmlResponse.status}`);
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = await htmlResponse.text();
  const modalElement = wrapper.querySelector('#st-grok2img-modal');
  if (!modalElement) {
    throw new Error('settings modal root not found');
  }

  document.body.append(modalElement);
  runtimeState.modalElement = modalElement;

  modalElement.querySelector('[data-role="close"]')?.addEventListener('click', closeModal);
  modalElement.querySelector('[data-role="backdrop"]')?.addEventListener('click', closeModal);

  bindTabNavigation(modalElement, (tabId) => {
    renderTab(modalElement, tabId).catch((error) => {
      console.error('[st-grok2img] render tab failed', error);
    });
  });

  await renderTab(modalElement, runtimeState.activeTab || 'main');
  return modalElement;
}

export function mountOpenButton() {
  if (runtimeState.openButtonElement) {
    return runtimeState.openButtonElement;
  }

  const button = document.createElement('button');
  button.id = 'st-grok2img-open-btn';
  button.type = 'button';
  button.textContent = 'G2';
  button.title = '打开 Grok2API 生图面板';
  button.className = 'st-g2-open-btn';
  button.addEventListener('click', () => {
    if (!runtimeState.modalElement) {
      mountModal()
        .then(openModal)
        .catch((error) => console.error('[st-grok2img] mount modal failed', error));
      return;
    }
    openModal();
  });

  document.body.append(button);
  runtimeState.openButtonElement = button;
  return button;
}
