function extractMarkdownImageUrl(text) {
  const markdownMatch = String(text || '').match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  const urlMatch = String(text || '').match(/https?:\/\/[^\s)]+/i);
  return urlMatch?.[0] || null;
}

export function parseImageResponse(payload) {
  const firstData = Array.isArray(payload?.data) ? payload.data[0] : null;

  if (firstData?.b64_json) {
    return {
      sourceType: 'b64_json',
      imageUrl: `data:image/png;base64,${firstData.b64_json}`
    };
  }

  if (firstData?.url) {
    return {
      sourceType: 'url',
      imageUrl: firstData.url
    };
  }

  const assistantContent = payload?.choices?.[0]?.message?.content;
  const markdownImageUrl = extractMarkdownImageUrl(assistantContent);
  if (markdownImageUrl) {
    return {
      sourceType: 'markdown_url',
      imageUrl: markdownImageUrl
    };
  }

  throw new Error('No image payload found in response');
}
