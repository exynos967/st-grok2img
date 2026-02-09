function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

export function createLogger(maxItems = 200) {
  const limit = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 200;
  const entries = [];

  function add(level, message, details = null) {
    entries.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      details,
      createdAt: new Date().toISOString()
    });

    if (entries.length > limit) {
      entries.length = limit;
    }
  }

  function clear() {
    entries.length = 0;
  }

  function list() {
    return [...entries];
  }

  function renderList(container) {
    if (!container) {
      return;
    }

    container.innerHTML = '';
    for (const entry of entries) {
      const item = document.createElement('li');
      item.className = `st-g2-log-item level-${entry.level}`;
      const detailsText = entry.details == null ? '' : `\n${JSON.stringify(entry.details, null, 2)}`;
      item.textContent = `[${formatTimestamp(entry.createdAt)}] [${entry.level}] ${entry.message}${detailsText}`;
      container.append(item);
    }
  }

  return {
    add,
    clear,
    list,
    renderList
  };
}
