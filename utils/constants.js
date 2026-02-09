export const EXTENSION_NAME = 'st-grok2img';

export const EXTENSION_EVENTS = Object.freeze({
  GENERATION_STARTED: 'st_grok2img_generation_started',
  GENERATION_SUCCEEDED: 'st_grok2img_generation_succeeded',
  GENERATION_FAILED: 'st_grok2img_generation_failed'
});

export const TAB_IDS = Object.freeze(['main', 'prompt', 'worldbook', 'log']);

export const DEFAULT_PROMPT_PRESET_ID = 'default';
export const DEFAULT_WORLDBOOK_PRESET_ID = 'default';

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  ui: {
    insertOriginalText: false,
    showDebugLog: true
  },
  api: {
    channel: 'st_proxy_chat_completions',
    baseUrl: 'http://127.0.0.1:8100',
    apiKey: '',
    model: 'grok-imagine-1.0',
    responseFormat: 'b64_json',
    n: 1,
    stream: false,
    timeoutMs: 60000
  },
  trigger: {
    autoGenerate: true,
    startTag: '[',
    endTag: ']',
    generationIntervalMs: 0
  },
  prompt: {
    activePresetId: DEFAULT_PROMPT_PRESET_ID,
    presets: {
      [DEFAULT_PROMPT_PRESET_ID]: {
        id: DEFAULT_PROMPT_PRESET_ID,
        name: '默认',
        fixedPrefix: '',
        fixedSuffix: '',
        negativePrompt: '',
        replaceRulesText: ''
      }
    }
  },
  worldbook: {
    enabled: true,
    compatMode: 'core',
    activePresetId: DEFAULT_WORLDBOOK_PRESET_ID,
    variables: {},
    presets: {}
  },
  log: {
    maxItems: 200
  }
});
