import type { Night } from './types.js';

// Stub until #2 lands: the signature is the contract.
export function readNight(runsDir: string, night: string): Night | null {
  void runsDir;
  void night;
  throw new Error('readNight: not implemented yet (#2)');
}
