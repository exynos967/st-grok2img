import { eventSource, event_types } from '../../../../script.js';
import { EXTENSION_EVENTS, EXTENSION_NAME } from './utils/constants.js';
import { mountModal, mountOpenButton } from './utils/ui/modal.js';
import { getSettings, saveSettings } from './utils/settingsStore.js';
import { registerCleanup, runtimeState } from './utils/state.js';
import { ensureDefaultWorldbookPreset, processWorldbookForPrompt } from './utils/worldbook/engine.js';
import { createLogger } from './utils/log/logger.js';
import { getActivePromptPreset } from './utils/prompt/presetManager.js';
import { buildPromptFromPreset } from './utils/prompt/templateEngine.js';
import { requestGrokImage } from './utils/api/grokProxyClient.js';
import { createGenerationQueue } from './utils/generation/queue.js';
import { extractTaggedPrompts } from './utils/generation/triggerParser.js';
import { insertGeneratedImageMessage } from './utils/generation/chatInserter.js';

function emitEvent(eventName, payload) {
  try {
    eventSource.emit(eventName, payload);
  } catch {
    // ignore event delivery failures
  }
}

function getErrorMessage(error, fallback = '未知错误') {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return fallback;
}

async function executeGenerationTask(task) {
  const settings = getSettings();
  if (!settings.enabled) {
    throw new Error('插件已禁用');
  }

  const sourcePrompt = String(task.rawPrompt || '').trim();
  if (!sourcePrompt) {
    throw new Error('提示词为空');
  }

  const activePreset = getActivePromptPreset(settings);
  const worldbookResult = processWorldbookForPrompt(settings, sourcePrompt);
  const finalPrompt = buildPromptFromPreset(sourcePrompt, activePreset, worldbookResult.worldbookContent);

  if (!finalPrompt) {
    throw new Error('最终提示词为空');
  }

  const eventPayload = {
    source: task.source,
    rawPrompt: sourcePrompt,
    finalPrompt,
    matchedWorldbook: worldbookResult.matchedEntries
  };

  runtimeState.logger?.add('info', 'Generation started', {
    source: task.source,
    promptLength: finalPrompt.length,
    worldbookMatches: worldbookResult.matchedEntries.length
  });

  emitEvent(EXTENSION_EVENTS.GENERATION_STARTED, eventPayload);

  try {
    const response = await requestGrokImage({
      settings,
      prompt: finalPrompt,
      logger: runtimeState.logger
    });

    await insertGeneratedImageMessage({
      imageUrl: response.image.imageUrl,
      prompt: sourcePrompt,
      taggedText: task.taggedText,
      insertOriginalText: settings.ui.insertOriginalText
    });

    runtimeState.logger?.add('info', 'Generation succeeded', {
      source: task.source,
      imageSource: response.image.sourceType
    });

    emitEvent(EXTENSION_EVENTS.GENERATION_SUCCEEDED, {
      ...eventPayload,
      imageSource: response.image.sourceType
    });

    return response;
  } catch (error) {
    const message = getErrorMessage(error);

    runtimeState.logger?.add('error', 'Generation failed', {
      source: task.source,
      message
    });

    emitEvent(EXTENSION_EVENTS.GENERATION_FAILED, {
      ...eventPayload,
      error: message
    });

    throw new Error(message);
  }
}

function enqueueGenerationTask(task) {
  if (!runtimeState.generationQueue) {
    throw new Error('生图队列尚未初始化');
  }

  return runtimeState.generationQueue.enqueue(() => executeGenerationTask(task), {
    source: task.source
  });
}

function getLatestUserMessageText() {
  const context = SillyTavern.getContext();
  if (!context?.chat?.length) {
    return '';
  }

  const message = context.chat[context.chat.length - 1];
  if (message?.is_user === false) {
    return '';
  }

  return String(message.mes || message.message || '').trim();
}

function handleAutoTriggerEvent() {
  const settings = getSettings();
  if (!settings.enabled || !settings.trigger.autoGenerate) {
    return;
  }

  const latestMessageText = getLatestUserMessageText();
  if (!latestMessageText) {
    return;
  }

  const promptItems = extractTaggedPrompts(
    latestMessageText,
    settings.trigger.startTag,
    settings.trigger.endTag
  );

  if (promptItems.length === 0) {
    return;
  }

  runtimeState.logger?.add('info', 'Auto trigger matched', {
    count: promptItems.length
  });

  for (const item of promptItems) {
    enqueueGenerationTask({
      rawPrompt: item.prompt,
      source: 'auto',
      taggedText: item.taggedText
    }).catch((error) => {
      runtimeState.logger?.add('error', 'Auto trigger task failed', {
        message: getErrorMessage(error)
      });
      console.error(`[${EXTENSION_NAME}] auto trigger task failed`, error);
    });
  }
}

function registerActions() {
  runtimeState.actions.requestGeneration = (task) => enqueueGenerationTask(task);
  runtimeState.actions.updateQueueInterval = (nextIntervalMs) => {
    runtimeState.generationQueue?.setIntervalMs(nextIntervalMs);
  };
  runtimeState.actions.updateLogLimit = (nextLimit) => {
    runtimeState.logger?.setMaxItems(nextLimit);
  };
}

async function initializeUi() {
  if (runtimeState.uiMounted) {
    return;
  }

  mountOpenButton();
  await mountModal();
  runtimeState.uiMounted = true;
}

function registerEventCleanup(eventName, listener) {
  registerCleanup(() => {
    if (typeof eventSource.off === 'function') {
      eventSource.off(eventName, listener);
      return;
    }

    if (typeof eventSource.removeListener === 'function') {
      eventSource.removeListener(eventName, listener);
    }
  });
}

function registerRuntimeCleanup() {
  registerCleanup(() => {
    runtimeState.logTabUnsubscribe?.();
    runtimeState.logTabUnsubscribe = null;

    runtimeState.generationQueue?.clear();
    runtimeState.generationQueue = null;

    runtimeState.actions.requestGeneration = null;
    runtimeState.actions.updateQueueInterval = null;
    runtimeState.actions.updateLogLimit = null;
  });
}

async function handleAppReady() {
  if (runtimeState.initialized) {
    return;
  }

  const settings = getSettings();

  await ensureDefaultWorldbookPreset(settings);
  saveSettings();

  runtimeState.logger = createLogger(settings.log.maxItems);
  runtimeState.logger.add('info', 'Logger initialized');

  runtimeState.generationQueue = createGenerationQueue({
    intervalMs: settings.trigger.generationIntervalMs,
    logger: runtimeState.logger
  });

  registerActions();
  registerRuntimeCleanup();

  eventSource.on(event_types.MESSAGE_SENT, handleAutoTriggerEvent);
  registerEventCleanup(event_types.MESSAGE_SENT, handleAutoTriggerEvent);

  runtimeState.initialized = true;

  console.log(`[${EXTENSION_NAME}] app ready`, {
    enabled: settings.enabled,
    model: settings.api.model,
    channel: settings.api.channel,
    worldbookPresetCount: Object.keys(settings.worldbook.presets || {}).length
  });

  await initializeUi();
}

eventSource.on(event_types.APP_READY, () => {
  handleAppReady().catch((error) => {
    console.error(`[${EXTENSION_NAME}] initialize failed`, error);
  });
});
