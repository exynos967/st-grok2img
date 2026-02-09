import { reloadCurrentChat, saveChatConditional } from '../../../../../script.js';

function buildMessageContent({ imageUrl, prompt, insertOriginalText, taggedText }) {
  const markdownImage = `![st-grok2img](${imageUrl})`;
  if (!insertOriginalText) {
    return markdownImage;
  }

  const sourceText = taggedText || prompt;
  return `${sourceText}\n\n${markdownImage}`;
}

export async function insertGeneratedImageMessage({ imageUrl, prompt, taggedText, insertOriginalText }) {
  const context = SillyTavern.getContext();
  if (!context?.chat) {
    throw new Error('Chat context unavailable');
  }

  const message = {
    name: context.name2 || 'Assistant',
    is_user: false,
    is_system: false,
    mes: buildMessageContent({ imageUrl, prompt, insertOriginalText, taggedText }),
    send_date: Date.now(),
    extra: {
      st_grok2img: true,
      prompt,
      image_url: imageUrl
    }
  };

  context.chat.push(message);

  if (typeof saveChatConditional === 'function') {
    await saveChatConditional();
  }

  if (typeof reloadCurrentChat === 'function') {
    await reloadCurrentChat();
  }

  return message;
}
