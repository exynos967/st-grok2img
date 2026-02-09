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
const WORLDBOOK_SCHEMA = 'st-grok2img/worldbook-preset@1';

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

function parsePositiveInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function buildPresetId(name, fallback = 'preset') {
  const compact = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${compact || fallback}-${Date.now().toString(36)}`;
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
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

function exportJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pickJsonFile(onLoaded) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    onLoaded(text);
  };
  fileInput.click();
}

function getActiveWorldbookPreset(settings) {
  return settings.worldbook.presets[settings.worldbook.activePresetId] || null;
}

function createWorldbookPreset(settings, name, seedPreset) {
  const baseName = String(name || '').trim() || '新世界书';
  const id = buildPresetId(baseName, 'worldbook');
  settings.worldbook.presets[id] = {
    id,
    name: baseName,
    rawJson: String(seedPreset?.rawJson || '')
  };
  settings.worldbook.activePresetId = id;
  return settings.worldbook.presets[id];
}

function deleteWorldbookPreset(settings, presetId) {
  const ids = Object.keys(settings.worldbook.presets || {});
  if (ids.length <= 1) {
    return false;
  }

  if (!settings.worldbook.presets[presetId]) {
    return false;
  }

  delete settings.worldbook.presets[presetId];
  if (settings.worldbook.activePresetId === presetId) {
    settings.worldbook.activePresetId = Object.keys(settings.worldbook.presets)[0] || '';
  }
  return true;
}

function exportWorldbookPreset(settings, presetId) {
  const preset = settings.worldbook.presets[presetId];
  if (!preset) {
    throw new Error('当前世界书预设不存在');
  }

  return {
    schema: WORLDBOOK_SCHEMA,
    exportedAt: new Date().toISOString(),
    preset
  };
}

function importWorldbookPreset(settings, payload) {
  const source = payload?.preset || payload;
  const rawJson = String(source?.rawJson || '');
  if (!rawJson.trim()) {
    throw new Error('导入文件缺少 rawJson');
  }

  const parsed = tryParseJson(rawJson);
  if (!parsed.ok) {
    throw new Error('导入的世界书 JSON 无法解析');
  }

  const name = String(source?.name || '导入世界书').trim();
  return createWorldbookPreset(settings, name, { rawJson });
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
      const parsed = parsePositiveInteger(event.target.value, 0);
      next.trigger.generationIntervalMs = parsed;
      event.target.value = String(parsed);
      runtimeState.actions.updateQueueInterval?.(parsed);
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
      notify('success', '生图任务已完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify('error', message || '生图失败');
    } finally {
      button.disabled = false;
    }
  });
}

function bindPromptTab(modalElement, root) {
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
    renderTab(modalElement, 'prompt').catch((error) => {
      console.error('[st-grok2img] rerender prompt tab failed', error);
    });
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

    renderTab(modalElement, 'prompt').catch((error) => {
      console.error('[st-grok2img] rerender prompt tab failed', error);
    });
    notify('success', `已创建预设：${name}`);
  });

  root.querySelector('#g2-prompt-preset-delete')?.addEventListener('click', () => {
    updateSettings((next) => {
      if (!deletePromptPreset(next, next.prompt.activePresetId)) {
        notify('warning', '至少保留一个提示词预设');
      }
    });

    renderTab(modalElement, 'prompt').catch((error) => {
      console.error('[st-grok2img] rerender prompt tab failed', error);
    });
  });

  root.querySelector('#g2-prompt-preset-export')?.addEventListener('click', () => {
    const currentSettings = getSettings();
    const payload = exportPromptPreset(currentSettings, currentSettings.prompt.activePresetId);
    exportJsonFile(`st-grok2img-prompt-${payload.preset.id}.json`, payload);
  });

  root.querySelector('#g2-prompt-preset-import')?.addEventListener('click', () => {
    pickJsonFile((text) => {
      const parsed = tryParseJson(text);
      if (!parsed.ok) {
        notify('error', '预设文件不是合法 JSON');
        return;
      }

      updateSettings((next) => {
        const imported = importPromptPreset(next, parsed.value);
        notify('success', `已导入预设：${imported.name}`);
      });

      renderTab(modalElement, 'prompt').catch((error) => {
        console.error('[st-grok2img] rerender prompt tab failed', error);
      });
    });
  });
}

function bindWorldbookTab(modalElement, root) {
  const settings = getSettings();
  const activePreset = getActiveWorldbookPreset(settings);

  setValue(root.querySelector('#g2-worldbook-enabled'), settings.worldbook.enabled);
  setValue(root.querySelector('#g2-worldbook-variables'), JSON.stringify(settings.worldbook.variables, null, 2));
  updateWorldbookPresetSelect(root, settings);
  setValue(root.querySelector('#g2-worldbook-json'), activePreset?.rawJson || '');

  root.querySelector('#g2-worldbook-enabled')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.worldbook.enabled = event.target.checked;
    });
  });

  root.querySelector('#g2-worldbook-variables')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const parsed = tryParseJson(event.target.value || '{}');
      if (!parsed.ok || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
        notify('warning', '变量必须是 JSON 对象，已恢复为之前内容');
        event.target.value = JSON.stringify(next.worldbook.variables, null, 2);
        return;
      }
      next.worldbook.variables = parsed.value;
    });
  });

  root.querySelector('#g2-worldbook-preset-select')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      next.worldbook.activePresetId = event.target.value;
    });

    renderTab(modalElement, 'worldbook').catch((error) => {
      console.error('[st-grok2img] rerender worldbook tab failed', error);
    });
  });

  root.querySelector('#g2-worldbook-json')?.addEventListener('change', (event) => {
    updateSettings((next) => {
      const target = next.worldbook.presets[next.worldbook.activePresetId];
      if (target) {
        target.rawJson = event.target.value;
      }
    });
  });

  root.querySelector('#g2-worldbook-save')?.addEventListener('click', () => {
    const editor = root.querySelector('#g2-worldbook-json');
    const rawJson = String(editor?.value || '').trim();
    const parsed = tryParseJson(rawJson || '{}');
    if (!parsed.ok) {
      notify('error', '世界书 JSON 格式错误，无法保存');
      return;
    }

    updateSettings((next) => {
      const target = next.worldbook.presets[next.worldbook.activePresetId];
      if (target) {
        target.rawJson = rawJson;
      }
    });

    notify('success', '世界书已保存');
  });

  root.querySelector('#g2-worldbook-save-as')?.addEventListener('click', () => {
    const currentPreset = getActiveWorldbookPreset(getSettings());
    const name = window.prompt('输入新世界书名称', `${currentPreset?.name || '世界书'}-副本`);
    if (!name) {
      return;
    }

    updateSettings((next) => {
      createWorldbookPreset(next, name, next.worldbook.presets[next.worldbook.activePresetId]);
    });

    renderTab(modalElement, 'worldbook').catch((error) => {
      console.error('[st-grok2img] rerender worldbook tab failed', error);
    });
    notify('success', `已创建世界书：${name}`);
  });

  root.querySelector('#g2-worldbook-delete')?.addEventListener('click', () => {
    updateSettings((next) => {
      if (!deleteWorldbookPreset(next, next.worldbook.activePresetId)) {
        notify('warning', '至少保留一个世界书预设');
      }
    });

    renderTab(modalElement, 'worldbook').catch((error) => {
      console.error('[st-grok2img] rerender worldbook tab failed', error);
    });
  });

  root.querySelector('#g2-worldbook-export')?.addEventListener('click', () => {
    try {
      const currentSettings = getSettings();
      const payload = exportWorldbookPreset(currentSettings, currentSettings.worldbook.activePresetId);
      exportJsonFile(`st-grok2img-worldbook-${payload.preset.id}.json`, payload);
    } catch (error) {
      notify('error', error instanceof Error ? error.message : '导出世界书失败');
    }
  });

  root.querySelector('#g2-worldbook-import')?.addEventListener('click', () => {
    pickJsonFile((text) => {
      const parsed = tryParseJson(text);
      if (!parsed.ok) {
        notify('error', '导入文件不是合法 JSON');
        return;
      }

      try {
        updateSettings((next) => {
          const imported = importWorldbookPreset(next, parsed.value);
          notify('success', `已导入世界书：${imported.name}`);
        });
      } catch (error) {
        notify('error', error instanceof Error ? error.message : '导入世界书失败');
        return;
      }

      renderTab(modalElement, 'worldbook').catch((error) => {
        console.error('[st-grok2img] rerender worldbook tab failed', error);
      });
    });
  });
}

function bindLogTab(root) {
  const settings = getSettings();
  const list = root.querySelector('#g2-log-list');
  const maxItemsInput = root.querySelector('#g2-log-max-items');

  setValue(maxItemsInput, settings.log.maxItems);

  runtimeState.logTabUnsubscribe?.();
  runtimeState.logTabUnsubscribe = runtimeState.logger?.subscribe((entries) => {
    runtimeState.logger?.renderList(list, entries);
  });

  root.querySelector('#g2-log-clear')?.addEventListener('click', () => {
    runtimeState.logger?.clear();
  });

  maxItemsInput?.addEventListener('change', (event) => {
    const currentLimit = runtimeState.logger?.getMaxItems() || settings.log.maxItems || 200;
    const nextLimit = parsePositiveInteger(event.target.value, currentLimit);

    updateSettings((next) => {
      next.log.maxItems = nextLimit;
    });

    runtimeState.actions.updateLogLimit?.(nextLimit);
    event.target.value = String(nextLimit);
    notify('success', `日志上限已更新为 ${nextLimit}`);
  });
}

function bindCurrentTab(modalElement, tabId) {
  const content = modalElement.querySelector('#st-grok2img-tab-content');
  if (!content) return;

  if (tabId === 'main') bindMainTab(content);
  if (tabId === 'prompt') bindPromptTab(modalElement, content);
  if (tabId === 'worldbook') bindWorldbookTab(modalElement, content);
  if (tabId === 'log') bindLogTab(content);
}

async function renderTab(modalElement, tabId) {
  const content = modalElement.querySelector('#st-grok2img-tab-content');
  if (!content) return;

  runtimeState.logTabUnsubscribe?.();
  runtimeState.logTabUnsubscribe = null;

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
