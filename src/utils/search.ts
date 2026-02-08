/**
 * Fuzzy search utility for filtering lists client-side.
 *
 * Scoring:
 * - Exact match (case-insensitive): 1.0
 * - Starts with search term: 0.8
 * - Contains search term: 0.6
 * - No match: filtered out
 */

type SearchableText = string | string[];

function score(text: string, term: string): number {
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();

  if (lower === lowerTerm) return 1.0;
  if (lower.startsWith(lowerTerm)) return 0.8;
  if (lower.includes(lowerTerm)) return 0.6;
  return 0;
}

function bestScore(searchable: SearchableText, term: string): number {
  const fields = Array.isArray(searchable) ? searchable : [searchable];
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const s = score(field, term);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Filter and sort items by fuzzy search match.
 *
 * Returns all items when searchTerm is undefined or empty.
 * Otherwise returns only matching items, sorted by score (best first).
 */
export function filterBySearch<T>(
  items: T[],
  searchTerm: string | undefined,
  getSearchableText: (item: T) => SearchableText
): T[] {
  if (!searchTerm || searchTerm.trim() === "") return items;

  const term = searchTerm.trim();

  return items
    .map((item) => ({ item, score: bestScore(getSearchableText(item), term) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
