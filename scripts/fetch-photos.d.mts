export type ParseResult = { ok: true; info: { descriptionUrl: string; imageUrl: string; ext: string; mime: string; license: string; licenseRaw: string; author: string } } | { ok: false; reason: string };
export function parseImageInfo(json: unknown, opts?: { authorOverride?: string }): ParseResult;
export function fileNameFor(title: string, ext: string): string;
export function makeId(crop: string, code: number, title: string): string;
export interface RunOptions {
  argv?: string[]; env?: Record<string, string | undefined>; root: string;
  fetchImpl?: (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>;
  fs?: { readFile(p: string, enc: 'utf-8'): Promise<string>; writeFile(p: string, data: unknown, enc?: 'utf-8'): Promise<void>; mkdir(p: string, o?: { recursive: boolean }): Promise<unknown> };
  log?: (msg: string) => void; now?: () => Date; delayMs?: number;
}
export interface RunResult { added: string[]; skipped: string[]; rejected: { title: string; reason: string }[] }
export function run(o: RunOptions): Promise<RunResult>;
