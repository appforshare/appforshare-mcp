#!/usr/bin/env node
// AppForShare MCP server over stdio. Every tool of the hosted server (https://appforshare.io/api/mcp) is passed
// through with the same API token, plus `upload_build`, which reads a file from this computer and uploads it
// with the same resumable API as the CLI, and `check_local_build`, which checks a file here without uploading it
// (the code in ./local and ./inspect is generated from the CLI by scripts/sync-readiness.mjs), and the builder backend
// tools in ./builder-backend.ts, and builder_start_from_document (./builder-intake.ts), which uploads a local document to start
// a builder app. Only JSON-RPC goes to stdout; anything else goes to stderr.
import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import SNAPSHOT from './tools-snapshot.json';
import { checkFile, InspectError } from './local/check';
import { BACKEND_TOOL_NAMES, BACKEND_TOOLS, BackendToolError, runBackendTool } from './builder-backend';
import { INTAKE_TOOL_NAMES, INTAKE_TOOLS, IntakeToolError, runIntakeTool } from './builder-intake';

const VERSION = '1.0.14';
const TOKEN = process.env.APPFORSHARE_TOKEN ?? '';
const API = (process.env.APPFORSHARE_API ?? 'https://appforshare.io').replace(/\/$/, '');
const UA = `appforshare-mcp/${VERSION}`;

type Id = string | number | null;
type Rpc = { jsonrpc: '2.0'; id?: Id; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown };

class ToolError extends Error {}
/** Tool names on the hosted list (last tools/list): a hosted tool wins over a local one of the same name. */
let hosted = new Set<string>();
const localBackend = (name: unknown) => typeof name === 'string' && BACKEND_TOOL_NAMES.has(name) && !hosted.has(name);
const localIntake = (name: unknown) => typeof name === 'string' && INTAKE_TOOL_NAMES.has(name) && !hosted.has(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const send = (m: object): void => void process.stdout.write(`${JSON.stringify(m)}\n`);
const log = (s: string) => process.stderr.write(`appforshare-mcp: ${s}\n`);

const UPLOAD_TOOL = {
  name: 'upload_build',
  title: 'Upload a build',
  description:
    'Upload an .ipa, .apk or .aab from this computer to AppForShare and return its install link and store readiness result. An .aab is turned into one APK for testers. Pro and Team also share desktop builds (.dmg, .pkg, zipped .app, .msix, .msixbundle, .appx, .appxbundle, .msi), which testers download from the install page. Optional release notes and a channel (such as beta) whose stable link then opens this build.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the build file (.ipa, .apk, .aab, or a desktop build on Pro and Team)' },
      notes: { type: 'string', description: 'Release notes shown to testers (Pro and Team)' },
      channel: { type: 'string', description: 'Put the build into this channel when it is ready (Pro and Team)' },
    },
    required: ['path'],
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

const CHECK_TOOL = {
  name: 'check_local_build',
  title: 'Check a local build before sharing',
  description:
    'Check an .ipa, .apk or .aab on this computer without uploading it: the store readiness check (App Store and Google Play rules, each finding with a fix), why a phone would refuse to install it (signing, provisioning profile, bundle ID, test only, v1 only signature), and the Security scan counts. The file never leaves this computer. With a Pro or Team token the Security scan findings (masked secrets, MASVS category, fix) are included too. Guidance only, not a promise of store approval. Read only.',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string', description: 'Path to the .ipa, .apk or .aab file' } },
    required: ['path'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

/** check_local_build: the same local check as `appforshare check` (generated copy in ./local and ./inspect). */
async function checkLocal(args: Record<string, unknown>) {
  if (typeof args.path !== 'string' || !args.path.trim()) throw new ToolError('path is required');
  const file = resolve(args.path);
  if (!/\.(ipa|apk|aab)$/i.test(file)) throw new ToolError('check_local_build reads an .ipa, .apk or .aab.');
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    throw new ToolError(`File not found: ${file}`);
  }
  let findings = false;
  if (TOKEN) {
    try {
      const res = await fetch(`${API}/api/ci/whoami`, { headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      findings = res.ok && !!((await res.json().catch(() => ({}))) as { localCheck?: boolean }).localCheck;
    } catch {
      // Offline: counts only.
    }
  }
  let r: Awaited<ReturnType<typeof checkFile>>;
  try {
    r = await checkFile(file);
  } catch (err) {
    throw new ToolError(err instanceof InspectError ? err.message : `Could not read ${basename(file)}: ${(err as Error).message}`);
  }
  const security = findings
    ? { ...r.security, access: 'findings' }
    : { ...r.security, findings: [], passed: [], groups: [], access: 'counts', note: 'The Security scan findings with how to fix them are part of Pro and Team: set APPFORSHARE_TOKEN to a Pro or Team API token to see them.' };
  return { ...r, security };
}

/** One call to the hosted MCP endpoint. */
async function remote(msg: Rpc): Promise<Rpc> {
  if (!TOKEN) throw new ToolError('APPFORSHARE_TOKEN is not set. Create an API token at https://appforshare.io/dashboard/settings and add it to this MCP server\'s env.');
  const res = await fetch(`${API}/api/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'User-Agent': UA },
    body: JSON.stringify(msg),
  });
  const data = (await res.json().catch(() => null)) as Rpc | { message?: string } | null;
  if (data && 'jsonrpc' in data) return data;
  throw new ToolError((data as { message?: string } | null)?.message ?? `AppForShare answered ${res.status}`);
}

async function rest<T>(method: string, path: string, opts: { json?: unknown; body?: Buffer; headers?: Record<string, string> } = {}): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API}/api${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'User-Agent': UA,
          ...(opts.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.body ? { 'Content-Type': 'application/octet-stream' } : {}),
          ...opts.headers,
        },
        body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body ? new Uint8Array(opts.body) : undefined,
      });
    } catch (err) {
      if (attempt >= 6) throw new ToolError(`Network error: ${(err as Error).message}`);
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as T & { message?: string | string[]; offset?: number };
    if (res.status >= 500 && attempt < 6) {
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok && res.status !== 409 && !(res.status === 400 && typeof data.offset === 'number')) {
      const msg = Array.isArray(data.message) ? data.message[0] : data.message;
      throw new ToolError(msg || `Request failed with ${res.status}`);
    }
    return data;
  }
}

function readChunk(fd: number, offset: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const n = readSync(fd, buf, read, length - read, offset + read);
    if (!n) break;
    read += n;
  }
  return buf.subarray(0, read);
}

type Status = { status: string; error: string | null; url: string | null; slug: string | null; expiresAt: string | null; channel: { name: string; url: string } | null; build: { name: string; version: string | null } | null };

async function upload(args: Record<string, unknown>) {
  if (!TOKEN) throw new ToolError('APPFORSHARE_TOKEN is not set. Create an API token at https://appforshare.io/dashboard/settings.');
  if (typeof args.path !== 'string' || !args.path.trim()) throw new ToolError('path is required');
  const file = resolve(args.path);
  if (!/\.(ipa|apk|aab|zip|dmg|pkg|msix|msixbundle|appx|appxbundle|msi)$/i.test(file)) {
    throw new ToolError('Only .ipa, .apk and .aab files (on Pro and Team also .dmg, .pkg, zipped .app, .msix, .msixbundle, .appx, .appxbundle and .msi) can be shared. An .aab is turned into an APK for testers.');
  }
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    throw new ToolError(`File not found: ${file}`);
  }
  const notes = typeof args.notes === 'string' && args.notes.trim() ? args.notes.slice(0, 5000) : undefined;
  const channel = typeof args.channel === 'string' && args.channel.trim() ? args.channel.trim() : undefined;
  const created = await rest<{ id: string; token: string; chunkBytes: number; offset: number }>('POST', '/uploads', {
    json: { fileName: basename(file), size, ...(notes ? { releaseNotes: notes } : {}), ...(channel ? { channel } : {}) },
  });
  const fd = openSync(file, 'r');
  let offset = created.offset;
  try {
    while (offset < size) {
      const chunk = readChunk(fd, offset, Math.min(created.chunkBytes, size - offset));
      const d = await rest<{ offset: number }>('PUT', `/uploads/${created.id}?offset=${offset}`, { body: chunk, headers: { 'X-Upload-Token': created.token } });
      offset = typeof d.offset === 'number' ? d.offset : offset + chunk.length;
    }
  } finally {
    closeSync(fd);
  }
  const h = { headers: { 'X-Upload-Token': created.token } };
  await rest('POST', `/uploads/${created.id}/complete`, h);
  const deadline = Date.now() + 20 * 60 * 1000;
  let s: Status;
  for (;;) {
    s = await rest<Status>('GET', `/uploads/${created.id}`, h);
    if (s.status === 'READY' || s.status === 'FAILED') break;
    if (Date.now() > deadline) throw new ToolError('Processing is taking too long. Check the AppForShare dashboard.');
    await sleep(2000);
  }
  if (s.status === 'FAILED') throw new ToolError(s.error ?? 'The build could not be processed.');
  for (let i = 0; channel && !s.channel && i < 5; i++) {
    await sleep(1000);
    s = await rest<Status>('GET', `/uploads/${created.id}`, h);
  }
  let readiness: unknown = null;
  try {
    readiness = (await rest<{ readinessReport: unknown }>('GET', `/ci/builds/${encodeURIComponent(s.slug ?? '')}`)).readinessReport;
  } catch {
    // Readiness is extra; the upload worked.
  }
  return { url: s.url, slug: s.slug, name: s.build?.name, version: s.build?.version, expiresAt: s.expiresAt, channel: s.channel, readiness };
}

async function handle(m: Rpc): Promise<void> {
  const reply = (result: unknown) => send({ jsonrpc: '2.0', id: m.id, result });
  const fail = (code: number, message: string) => send({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
  if (m.id === undefined) return; // notifications need no answer
  try {
    switch (m.method) {
      case 'initialize': {
        const asked = typeof m.params?.protocolVersion === 'string' ? m.params.protocolVersion : '2025-06-18';
        if (!TOKEN) log('APPFORSHARE_TOKEN is not set; tools will answer with an error until it is.');
        return reply({
          protocolVersion: asked,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'appforshare', title: 'AppForShare', version: VERSION, websiteUrl: 'https://appforshare.io/docs/mcp' },
          instructions:
            'AppForShare shares iOS and Android test builds by install link and tracks App Store and Google Play releases. upload_build uploads a local .ipa or .apk. ' +
            'check_local_build checks a local .ipa, .apk or .aab (store readiness, install problems, Security scan) without uploading it. ' +
            'builder_start_from_idea (an idea) or builder_start_from_document (a local PDF, DOCX, TXT or MD document) start a builder app with up to 3 questions; builder_answer_questions answers them and starts the design (credits: ask first). ' +
            'builder_backend_status, request_builder_backend_change, apply_builder_backend and export_builder_backend work on the managed backend of a builder app (export saves the file on this computer). ' +
            'promote_build, delete_build, request_builder_backend_change and apply_builder_backend change things: ask the person first and pass confirm: true.',
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list': {
        let tools: unknown[] = [];
        try {
          const r = await remote({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
          tools = ((r.result as { tools?: unknown[] } | undefined)?.tools ?? []) as unknown[];
        } catch (err) {
          log((err as Error).message);
        }
        // No token yet (or offline): show the tool list shipped with this version, so the person and directories
        // can see every tool. Calls still need APPFORSHARE_TOKEN.
        if (!tools.length) tools = SNAPSHOT;
        hosted = new Set(tools.map((t) => (t as { name?: string }).name ?? ''));
        return reply({ tools: [UPLOAD_TOOL, CHECK_TOOL, ...tools, ...BACKEND_TOOLS.filter((t) => !hosted.has(t.name)), ...INTAKE_TOOLS.filter((t) => !hosted.has(t.name))] });
      }
      case 'tools/call': {
        if (m.params?.name === UPLOAD_TOOL.name || m.params?.name === CHECK_TOOL.name) {
          try {
            const a = (m.params.arguments ?? {}) as Record<string, unknown>;
            const data = m.params.name === CHECK_TOOL.name ? await checkLocal(a) : await upload(a);
            return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
          } catch (err) {
            return reply({ content: [{ type: 'text', text: err instanceof ToolError ? err.message : String(err) }], isError: true });
          }
        }
        if (localIntake(m.params?.name)) {
          try {
            const data = await runIntakeTool({ api: API, token: TOKEN, ua: UA }, m.params!.name as string, (m.params!.arguments ?? {}) as Record<string, unknown>);
            return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
          } catch (err) {
            return reply({ content: [{ type: 'text', text: err instanceof IntakeToolError ? err.message : String(err) }], isError: true });
          }
        }
        if (localBackend(m.params?.name)) {
          try {
            const data = await runBackendTool({ api: API, token: TOKEN, ua: UA }, m.params!.name as string, (m.params!.arguments ?? {}) as Record<string, unknown>);
            return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, isError: false });
          } catch (err) {
            return reply({ content: [{ type: 'text', text: err instanceof BackendToolError ? err.message : String(err) }], isError: true });
          }
        }
        try {
          const r = await remote({ jsonrpc: '2.0', id: m.id ?? 1, method: 'tools/call', params: m.params });
          return r.error ? send({ ...r, id: m.id }) : reply(r.result);
        } catch (err) {
          return reply({ content: [{ type: 'text', text: (err as Error).message }], isError: true });
        }
      }
      default:
        return fail(-32601, `Method not found: ${m.method}`);
    }
  } catch (err) {
    fail(-32603, (err as Error).message);
  }
}

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let m: Rpc;
  try {
    m = JSON.parse(line) as Rpc;
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  void handle(m);
});
