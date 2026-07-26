// ============================================================================
// mentions.js
// Extrae menciones @username de un texto. El username solo puede contener
// letras minúsculas, números, guion y guion_bajo (igual que la validación
// de registro), así que el regex se mantiene en sincronía con esa regla.
// ============================================================================
const MENTION_REGEX = /@([a-z0-9_-]{3,24})\b/gi;

export function extractMentionedUsernames(content) {
  if (!content) return [];
  const matches = content.matchAll(MENTION_REGEX);
  const usernames = new Set();
  for (const match of matches) {
    usernames.add(match[1].toLowerCase());
  }
  return Array.from(usernames);
}
