import { DEFAULT_PROMPT_PRESET_ID } from '../constants.js';
import { runtimeState } from '../state.js';
import { getSettings, sanitizeApiKey, updateSettings } from '../settingsStore.js';
import {
  createPromptPreset,
  deletePromptPreset,
  exportPromptPreset,
  getActivePromptPreset,
  importPromptPreset,
  setActivePromptPreset
} from '../prompt/presetManager.js';
import { bindTabNavigation, loadTabHtml, setActiveTabButton } from './tabs.js';

const SETTINGS_HTML_URL = new URL('../../settings.html', import.meta.url).toString();

function notify(type, message) {
  if (window.toastr && typeof window.toastr[type] === 'function') {
    window.toastr[type](message);
    return;
  }
  console.log(`[st-grok2img][${type}] ${message}`);
}

function setValue(input, value) {
  if (!input) return;
  if (input.type === 'checkbox') {
    input.checked = Boolean(value);
  } else {
    input.value = value ?? '';
  }
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
      runtimeState.actions.updateQueueInterval?.(next.trigger.generationIntervalMs);
    });
  });

  root.querySelector('#g2-insert-original')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.ui.insertOriginalText = event.target.checked;
    });
  });

  root.querySelector('#g2-manual-generate')?.addEventListener('click', async () => {
    const promptInput = root.querySelector('#g2-manual-prompt');
    const prompt = String(promptInput?.value || '').trim();
    if (!prompt) {
      notify('warning', '请输入提示词');
      return;
    }

    if (typeof runtimeState.actions.requestGeneration !== 'function') {
      notify('error', '生图服务尚未初始化');
      return;
    }

    const button = root.querySelector('#g2-manual-generate');
    button.disabled = true;

    try {
      await runtimeState.actions.requestGeneration({
        rawPrompt: prompt,
        source: 'manual',
        taggedText: ''
      });
      notify('success', '已提交生图任务');
    } catch (error) {
      notify('error', error.message || '生图失败');
    } finally {
      button.disabled = false;
    }
  });
}

function bindPromptTab(root) {
  const settings = getSettings();
  const preset = getActivePromptPreset(settings);

  updatePromptPresetSelect(root, settings);
  setValue(root.querySelector('#g2-fixed-prefix'), preset.fixedPrefix);
  setValue(root.querySelector('#g2-fixed-suffix'), preset.fixedSuffix);
  setValue(root.querySelector('#g2-negative-prompt'), preset.negativePrompt);
  setValue(root.querySelector('#g2-replace-rules'), preset.replaceRulesText);

  root.querySelector('#g2-prompt-preset-select')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      setActivePromptPreset(next, event.target.value);
    });
    bindPromptTab(root);
  });

  root.querySelector('#g2-fixed-prefix')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getActivePromptPreset(next);
      active.fixedPrefix = event.target.value;
    });
  });

  root.querySelector('#g2-fixed-suffix')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getActivePromptPreset(next);
      active.fixedSuffix = event.target.value;
    });
  });

  root.querySelector('#g2-negative-prompt')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getActivePromptPreset(next);
      active.negativePrompt = event.target.value;
    });
  });

  root.querySelector('#g2-replace-rules')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const active = getActivePromptPreset(next);
      active.replaceRulesText = event.target.value;
    });
  });

  root.querySelector('#g2-prompt-preset-save')?.addEventListener('click', () => {
    updateSettings(() => {});
    notify('success', '提示词预设已保存');
  });

  root.querySelector('#g2-prompt-preset-save-as')?.addEventListener('click', () => {
    const name = window.prompt('输入新预设名称', `${preset.name}-副本`);
    if (!name) {
      return;
    }

    updateSettings((next) => {
      createPromptPreset(next, name, getActivePromptPreset(next));
    });
    bindPromptTab(root);
    notify('success', `已创建预设：${name}`);
  });

  root.querySelector('#g2-prompt-preset-delete')?.addEventListener('click', () => {
    updateSettings((next) => {
      if (!deletePromptPreset(next, next.prompt.activePresetId)) {
        notify('warning', '至少保留一个提示词预设');
      }
    });
    bindPromptTab(root);
  });

  root.querySelector('#g2-prompt-preset-export')?.addEventListener('click', () => {
    const payload = exportPromptPreset(getSettings(), getSettings().prompt.activePresetId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `st-grok2img-prompt-${payload.preset.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  root.querySelector('#g2-prompt-preset-import')?.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const text = await file.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        notify('error', '预设文件不是合法 JSON');
        return;
      }

      updateSettings((next) => {
        const imported = importPromptPreset(next, payload);
        notify('success', `已导入预设：${imported.name}`);
      });
      bindPromptTab(root);
    };
    fileInput.click();
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
  const list = root.querySelector('#g2-log-list');
  runtimeState.logger?.renderList(list);

  root.querySelector('#g2-log-clear')?.addEventListener('click', () => {
    runtimeState.logger?.clear();
    runtimeState.logger?.renderList(list);
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
