function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchKeyword(keyword, sourceText, { caseSensitive = false, matchWholeWords = false } = {}) {
  const normalizedKeyword = String(keyword || '').trim();
  if (!normalizedKeyword) {
    return false;
  }

  if (matchWholeWords) {
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, flags);
    return pattern.test(sourceText);
  }

  const left = caseSensitive ? sourceText : sourceText.toLowerCase();
  const right = caseSensitive ? normalizedKeyword : normalizedKeyword.toLowerCase();
  return left.includes(right);
}

export function checkKeywords(keywords, sourceText, options = {}, mode = 'any') {
  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const candidates = keywordList
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return false;
  }

  const results = candidates.map((keyword) => matchKeyword(keyword, sourceText, options));

  if (mode === 'all') {
    return results.every(Boolean);
  }

  if (mode === 'not_any') {
    return !results.some(Boolean);
  }

  return results.some(Boolean);
}

export function checkEntryTrigger(entry, sourceText) {
  if (entry.disable) {
    return false;
  }

  if (entry.constant) {
    return true;
  }

  const options = {
    caseSensitive: entry.caseSensitive,
    matchWholeWords: entry.matchWholeWords
  };

  const primaryMatched = checkKeywords(entry.key, sourceText, options, 'any');
  if (!primaryMatched) {
    return false;
  }

  if (!entry.selective) {
    return primaryMatched;
  }

  const secondary = Array.isArray(entry.keysecondary) ? entry.keysecondary : [];
  if (secondary.length === 0) {
    return true;
  }

  if (entry.selectiveLogic === 1) {
    return checkKeywords(secondary, sourceText, options, 'all');
  }

  if (entry.selectiveLogic === 2) {
    return checkKeywords(secondary, sourceText, options, 'not_any');
  }

  return checkKeywords(secondary, sourceText, options, 'any');
}
