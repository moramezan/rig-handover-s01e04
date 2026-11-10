import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted, and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('fixtures/refresh: 4 runs, 3 retries, last ok', () => {
    const row = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(row).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('notes/backup: fail with quota exceeded', () => {
    const row = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(row.lastStatus).toBe('fail');
    expect(row.lastError).toBe('quota exceeded');
  });

  it('digest/render keeps the row with a null owner', () => {
    const row = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(row.owner).toBeNull();
    expect(row.runs).toBe(1);
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('empty file: no rows, no bad lines', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('blank lines are not bad lines; invalid fields are', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '',
        '{"at":"2026-01-03T02:00:00+01:00","job":"a","status":"nope","owner":"x"}',
        '{"job":"b","status":"ok","owner":"x"}',
        '[]',
        '',
      ].join('\n'),
    );
    const n = readNight(dir, '2026-01-03')!;
    expect(n.badLines).toBe(3);
    expect(n.rows).toHaveLength(1);
  });
});
