function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

function normalizeLimit(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export function createLogger(maxItems = 200) {
  let limit = normalizeLimit(maxItems, 200);
  const entries = [];
  const subscribers = new Set();

  function list() {
    return [...entries];
  }

  function renderList(container, sourceEntries = entries) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    for (const entry of sourceEntries) {
      const item = document.createElement('li');
      item.className = `st-g2-log-item level-${entry.level}`;
      const detailsText = entry.details == null ? '' : `\n${JSON.stringify(entry.details, null, 2)}`;
      item.textContent = `[${formatTimestamp(entry.createdAt)}] [${entry.level}] ${entry.message}${detailsText}`;
      container.append(item);
    }
  }

  function notifySubscribers() {
    const snapshot = list();
    for (const listener of subscribers) {
      try {
        listener(snapshot);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  function trimToLimit() {
    if (entries.length > limit) {
      entries.length = limit;
    }
  }

  function add(level, message, details = null) {
    entries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      details,
      createdAt: new Date().toISOString()
    });

    trimToLimit();
    notifySubscribers();
  }

  function clear() {
    if (entries.length === 0) {
      return;
    }

    entries.length = 0;
    notifySubscribers();
  }

  function setMaxItems(nextMaxItems) {
    limit = normalizeLimit(nextMaxItems, limit);
    trimToLimit();
    notifySubscribers();
    return limit;
  }

  function getMaxItems() {
    return limit;
  }

  function subscribe(listener, { emitCurrent = true } = {}) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    subscribers.add(listener);

    if (emitCurrent) {
      listener(list());
    }

    return () => {
      subscribers.delete(listener);
    };
  }

  return {
    add,
    clear,
    list,
    renderList,
    setMaxItems,
    getMaxItems,
    subscribe
  };
}
