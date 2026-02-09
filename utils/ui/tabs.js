import { TAB_IDS } from '../constants.js';

const TAB_HTML_URLS = Object.freeze({
  main: new URL('../../html/tabs/main.html', import.meta.url).toString(),
  prompt: new URL('../../html/tabs/prompt.html', import.meta.url).toString(),
  worldbook: new URL('../../html/tabs/worldbook.html', import.meta.url).toString(),
  log: new URL('../../html/tabs/log.html', import.meta.url).toString()
});

export function setActiveTabButton(modalElement, activeTabId) {
  const tabButtons = modalElement.querySelectorAll('.st-g2-tab-btn');
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === activeTabId;
    button.classList.toggle('is-active', isActive);
  }
}

export function bindTabNavigation(modalElement, onSelectTab) {
  const tabButtons = modalElement.querySelectorAll('.st-g2-tab-btn');
  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      if (!TAB_IDS.includes(tabId)) {
        return;
      }
      onSelectTab(tabId);
    });
  }
}

export async function loadTabHtml(tabId, contentElement) {
  const url = TAB_HTML_URLS[tabId];
  if (!url) {
    throw new Error(`Unknown tab id: ${tabId}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load tab ${tabId}: ${response.status}`);
  }

  const html = await response.text();
  contentElement.innerHTML = html;
}
