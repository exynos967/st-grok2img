function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createGenerationQueue({ intervalMs = 0, logger = null } = {}) {
  const queue = [];
  let running = false;
  let currentIntervalMs = Math.max(0, Number(intervalMs) || 0);

  async function processQueue() {
    if (running) {
      return;
    }

    running = true;
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }

      if (currentIntervalMs > 0 && queue.length > 0) {
        logger?.add('info', 'Queue waiting for interval', {
          intervalMs: currentIntervalMs,
          remaining: queue.length
        });
        await delay(currentIntervalMs);
      }
    }
    running = false;
  }

  function enqueue(task, meta = {}) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject, meta });
      logger?.add('info', 'Task enqueued', {
        queueSize: queue.length,
        meta
      });
      processQueue().catch((error) => {
        logger?.add('error', 'Queue processing failed', { message: error.message });
      });
    });
  }

  function setIntervalMs(nextIntervalMs) {
    currentIntervalMs = Math.max(0, Number(nextIntervalMs) || 0);
    logger?.add('info', 'Queue interval updated', { intervalMs: currentIntervalMs });
  }

  function getSize() {
    return queue.length;
  }

  function clear() {
    while (queue.length > 0) {
      const item = queue.shift();
      item.reject(new Error('Queue cleared'));
    }
    logger?.add('warning', 'Queue cleared');
  }

  return {
    enqueue,
    setIntervalMs,
    getSize,
    clear
  };
}
