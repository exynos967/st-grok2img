import { eventSource, event_types } from '../../../../script.js';
import { EXTENSION_NAME } from './utils/constants.js';
import { mountModal, mountOpenButton } from './utils/ui/modal.js';
import { getSettings } from './utils/settingsStore.js';
import { runtimeState } from './utils/state.js';

async function initializeUi() {
  if (runtimeState.uiMounted) {
    return;
  }

  mountOpenButton();
  await mountModal();
  runtimeState.uiMounted = true;
}

async function handleAppReady() {
  const settings = getSettings();
  runtimeState.initialized = true;

  console.log(`[${EXTENSION_NAME}] app ready`, {
    enabled: settings.enabled,
    model: settings.api.model,
    channel: settings.api.channel
  });

  await initializeUi();
}

eventSource.on(event_types.APP_READY, () => {
  handleAppReady().catch((error) => {
    console.error(`[${EXTENSION_NAME}] initialize failed`, error);
  });
});
