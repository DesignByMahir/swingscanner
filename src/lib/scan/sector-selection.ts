import type { SectorLeadership, StockSetup } from "../../types/domain";

export function selectSectorBalancedCandidates(
  candidates: StockSetup[],
  leadership: SectorLeadership[],
  maxResults: number,
  leadingPerSector: number,
  otherPerSector: number,
) {
  const sorted = [...candidates].sort(
    (left, right) => right.finalScore - left.finalScore || right.rs - left.rs,
  );
  const selected: StockSetup[] = [];
  const used = new Set<string>();
  const counts = new Map<string, number>();

  const addFromSector = (sectorTicker: string, target: number) => {
    if (target <= 0) return;
    for (const stock of sorted) {
      if (selected.length >= maxResults) break;
      if (stock.sectorTicker !== sectorTicker || used.has(stock.ticker)) continue;
      selected.push(stock);
      used.add(stock.ticker);
      const nextCount = (counts.get(sectorTicker) ?? 0) + 1;
      counts.set(sectorTicker, nextCount);
      if (nextCount >= target) break;
    }
  };

  for (const sector of leadership.filter((item) => item.isLeading)) {
    addFromSector(sector.ticker, leadingPerSector);
  }
  for (const sector of leadership.filter((item) => !item.isLeading)) {
    addFromSector(sector.ticker, otherPerSector);
  }
  for (const stock of sorted) {
    if (selected.length >= maxResults) break;
    if (used.has(stock.ticker)) continue;
    selected.push(stock);
    used.add(stock.ticker);
  }

  return selected;
}
