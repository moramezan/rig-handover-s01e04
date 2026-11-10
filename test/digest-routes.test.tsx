import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

type DigestJson = { night: string; rows: DigestRow[]; badLines: number };

let runsDir = '';

function app() {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function line(at: string, job: string, status: string, owner: string | null, error?: string) {
  return JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });
}

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(
    path.join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta/sync', 'retry', 'ana'),
      line('2026-01-01T01:05:00+01:00', 'zeta/sync', 'retry', 'ana'),
      line('2026-01-01T01:10:00+01:00', 'zeta/sync', 'retry', 'ana'),
      line('2026-01-01T01:15:00+01:00', 'zeta/sync', 'ok', 'ana'),
      line('2026-01-01T02:00:00+01:00', 'alpha/export', 'fail', null, 'boom'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-01-03.jsonl'),
    line('2026-01-03T00:30:00+01:00', 'a/b', 'ok', 'bo') + '\n{"at":"2026-01-03T01:00:00+01:00","job":"x/y',
  );
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('200 for a normal night; page and JSON agree', async () => {
    const page = await app().request('/digest/2026-01-01');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('zeta/sync');
    expect(html).toContain('alpha/export');
    expect(html).toContain('—');

    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(Object.keys(body).sort()).toEqual(['badLines', 'night', 'rows']);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/export', 'zeta/sync']);

    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('404 for a night with no file', async () => {
    expect((await app().request('/digest/2026-01-09')).status).toBe(404);
    expect((await app().request('/api/digest/2026-01-09')).status).toBe(404);
  });

  it('empty night says nothing ran', async () => {
    const page = await app().request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const res = await app().request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.rows).toEqual([]);
  });

  it('a bad line is counted, not fatal', async () => {
    const page = await app().request('/digest/2026-01-03');
    expect(page.status).toBe(200);
    const res = await app().request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(1);
  });
});
