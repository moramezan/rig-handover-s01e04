import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Job counts by each job's last status; null when the night can't be read.
export type NightSummary = {
  night: string;
  counts: { ok: number; retry: number; fail: number } | null;
};

function nightCounts(runsDir: string, night: string): NightSummary['counts'] {
  try {
    const n = readNight(runsDir, night);
    if (!n) return null;
    const counts = { ok: 0, retry: 0, fail: 0 };
    for (const r of n.rows) counts[r.lastStatus]++;
    return counts;
  } catch {
    return null;
  }
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: nightCounts(config.runsDir, night) })),
  };
}
