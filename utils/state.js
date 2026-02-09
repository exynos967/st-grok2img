export const runtimeState = {
  initialized: false,
  uiMounted: false,
  modalElement: null,
  openButtonElement: null,
  activeTab: 'main',
  logTabUnsubscribe: null,
  generationQueue: null,
  logger: null,
  unbinders: [],
  actions: {
    requestGeneration: null,
    updateQueueInterval: null,
    updateLogLimit: null
  }
};

export function registerCleanup(handler) {
  if (typeof handler === 'function') {
    runtimeState.unbinders.push(handler);
  }
}

export function cleanupRuntime() {
  for (const unbind of runtimeState.unbinders.splice(0)) {
    try {
      unbind();
    } catch {
      // ignore cleanup errors
    }
  }
}
