import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { parseLine } from './digest/read.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Run-line counts by status for the night (ok / retry / fail lines in the log), parsed with the
// digest reader's own line parser; null when the night can't be read.
export type NightSummary = {
  night: string;
  counts: { ok: number; retry: number; fail: number } | null;
};

function nightCounts(runsDir: string, night: string): NightSummary['counts'] {
  try {
    const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
    const counts = { ok: 0, retry: 0, fail: 0 };
    for (const line of text.split('\n')) {
      const run = line.trim() ? parseLine(line) : null;
      if (run) counts[run.status]++;
    }
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
