export interface SectorBalancedCandidate {
  ticker: string;
  sector: string;
}

export interface SectorBalancedSelectionOptions {
  limit: number;
  preserveTop?: number;
  reservePerSector?: number;
  maxPerSector?: number;
}

export function selectSectorBalanced<T extends SectorBalancedCandidate>(
  rankedCandidates: T[],
  sectorOrder: string[],
  options: SectorBalancedSelectionOptions,
) {
  const {
    limit,
    preserveTop = 5,
    reservePerSector = 3,
    maxPerSector = Number.POSITIVE_INFINITY,
  } = options;
  if (limit <= 0) return [];

  const selected: T[] = [];
  const selectedTickers = new Set<string>();
  const sectorCounts = new Map<string, number>();
  const add = (candidate: T) => {
    if (selected.length >= limit || selectedTickers.has(candidate.ticker)) return false;
    selected.push(candidate);
    selectedTickers.add(candidate.ticker);
    sectorCounts.set(candidate.sector, (sectorCounts.get(candidate.sector) ?? 0) + 1);
    return true;
  };

  rankedCandidates.slice(0, preserveTop).forEach(add);

  for (let round = 0; round < reservePerSector && selected.length < limit; round += 1) {
    for (const sector of sectorOrder) {
      if (selected.length >= limit) break;
      if ((sectorCounts.get(sector) ?? 0) > round) continue;
      const candidate = rankedCandidates.find(
        (item) => item.sector === sector && !selectedTickers.has(item.ticker),
      );
      if (candidate) add(candidate);
    }
  }

  for (const candidate of rankedCandidates) {
    if (selected.length >= limit) break;
    if ((sectorCounts.get(candidate.sector) ?? 0) >= maxPerSector) continue;
    add(candidate);
  }

  for (const candidate of rankedCandidates) {
    if (selected.length >= limit) break;
    add(candidate);
  }

  return selected;
}
