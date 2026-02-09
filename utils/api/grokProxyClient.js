import { getRequestHeaders } from '../../../../../../script.js';
import { parseImageResponse } from '../generation/imageResponseParser.js';

const PROXY_ENDPOINT = '/api/backends/chat-completions/generate';

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function normalizeGrokBaseUrl(rawBaseUrl) {
  const trimmed = trimTrailingSlash(rawBaseUrl);
  if (!trimmed) {
    return '';
  }

  if (trimmed.endsWith('/v1')) {
    return trimmed;
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimTrailingSlash(trimmed.replace(/\/chat\/completions$/, ''));
  }

  return `${trimmed}/v1`;
}

export function buildGrokProxyPayload({ settings, prompt }) {
  const reverseProxy = normalizeGrokBaseUrl(settings.api.baseUrl);
  if (!reverseProxy) {
    throw new Error('API base URL is empty');
  }

  if (!settings.api.apiKey) {
    throw new Error('API key is empty');
  }

  return {
    chat_completion_source: 'xai',
    reverse_proxy: reverseProxy,
    proxy_password: settings.api.apiKey,
    model: settings.api.model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    n: settings.api.n,
    temperature: 1,
    top_p: 1,
    max_tokens: 1024
  };
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timeout)
  };
}

export async function requestGrokImage({ settings, prompt, logger }) {
  const payload = buildGrokProxyPayload({ settings, prompt });
  logger?.add('info', 'Dispatch proxy request', {
    model: payload.model,
    reverse_proxy: payload.reverse_proxy,
    source: payload.chat_completion_source
  });

  const timeoutMs = Number.isFinite(settings.api.timeoutMs) ? settings.api.timeoutMs : 60000;
  const { controller, cleanup } = createTimeoutController(timeoutMs);

  let response = null;
  try {
    response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    cleanup();
  }

  const rawText = await response.text();
  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    json = { rawText };
  }

  if (!response.ok) {
    logger?.add('error', 'Proxy request failed', {
      status: response.status,
      response: json
    });
    const message = json?.error?.message || json?.message || `Proxy request failed: ${response.status}`;
    throw new Error(message);
  }

  const image = parseImageResponse(json);
  logger?.add('info', 'Image parsed from response', {
    sourceType: image.sourceType
  });

  return {
    payload,
    response: json,
    image
  };
}
