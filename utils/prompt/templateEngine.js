export function parseReplaceRules(replaceRulesText) {
  const rows = String(replaceRulesText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  const rules = [];
  for (const row of rows) {
    const separatorIndex = row.indexOf('=>');
    if (separatorIndex <= 0) {
      continue;
    }

    const from = row.slice(0, separatorIndex).trim();
    const to = row.slice(separatorIndex + 2).trim();
    if (!from) {
      continue;
    }

    rules.push({ from, to });
  }
  return rules;
}

function replaceAllSafe(text, from, to) {
  return String(text).split(from).join(to);
}

export function applyReplaceRules(rawPrompt, replaceRulesText) {
  let result = String(rawPrompt || '');
  const rules = parseReplaceRules(replaceRulesText);
  for (const rule of rules) {
    result = replaceAllSafe(result, rule.from, rule.to);
  }
  return result;
}

export function composePrompt({
  rawPrompt,
  fixedPrefix,
  fixedSuffix,
  negativePrompt,
  replaceRulesText,
  worldbookContent
}) {
  const replaced = applyReplaceRules(rawPrompt, replaceRulesText);
  const parts = [fixedPrefix, replaced, worldbookContent, fixedSuffix]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  let finalPrompt = parts.join('\n');
  const normalizedNegativePrompt = String(negativePrompt || '').trim();
  if (normalizedNegativePrompt) {
    finalPrompt = `${finalPrompt}\nNegative prompt: ${normalizedNegativePrompt}`;
  }

  return finalPrompt.trim();
}

export function buildPromptFromPreset(rawPrompt, preset, worldbookContent) {
  return composePrompt({
    rawPrompt,
    fixedPrefix: preset?.fixedPrefix,
    fixedSuffix: preset?.fixedSuffix,
    negativePrompt: preset?.negativePrompt,
    replaceRulesText: preset?.replaceRulesText,
    worldbookContent
  });
}
