export function scoreCommand(text: string, query: string): number {
  if (!query) return 0;
  const directIndex = text.indexOf(query);
  if (directIndex >= 0) return 1_000 - directIndex;
  let score = 0;
  let cursor = 0;
  let previousIndex = -2;
  for (const character of query) {
    const index = text.indexOf(character, cursor);
    if (index < 0) return -1;
    score += index === previousIndex + 1 ? 10 : 2;
    score -= index;
    previousIndex = index;
    cursor = index + 1;
  }
  return score;
}
