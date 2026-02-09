import { eventSource, event_types } from '../../../../script.js';
import { getSettings } from './utils/settingsStore.js';
import { EXTENSION_NAME } from './utils/constants.js';
import { runtimeState } from './utils/state.js';

function handleAppReady() {
  const settings = getSettings();
  runtimeState.initialized = true;
  console.log(`[${EXTENSION_NAME}] initialized`, {
    enabled: settings.enabled,
    model: settings.api.model,
    channel: settings.api.channel
  });
}

eventSource.on(event_types.APP_READY, handleAppReady);
