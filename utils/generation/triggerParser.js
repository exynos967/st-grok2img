function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractTaggedPrompts(text, startTag, endTag) {
  const source = String(text || '');
  const start = String(startTag || '').trim();
  const end = String(endTag || '').trim();

  if (!source || !start || !end) {
    return [];
  }

  const pattern = new RegExp(`${escapeRegex(start)}([\\s\\S]*?)${escapeRegex(end)}`, 'g');
  const results = [];

  for (const match of source.matchAll(pattern)) {
    const prompt = String(match[1] || '').trim();
    if (!prompt) {
      continue;
    }

    results.push({
      prompt,
      taggedText: match[0],
      index: match.index ?? -1
    });
  }

  return results;
}
