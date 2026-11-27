// The managed backend of a builder app (phase 3.5) for this stdio server: status, a change in plain words, making
// the draft live, and downloads saved on this computer (never streamed into the chat). They call the same /api/ci
// routes as `appforshare builder backend`. When the hosted MCP list has a tool of the same name, the hosted one is
// used instead (server.ts).
import { existsSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export class BackendToolError extends Error {}

type Ctx = { api: string; token: string; ua: string };
type Args = Record<string, unknown>;

const appProp = { type: 'integer', description: 'Builder app id from builder_status' };

export const BACKEND_TOOLS = [
  {
    name: 'builder_backend_status',
    title: 'App builder backend status',
    description:
      'The managed backend of one builder app in plain words: allowed and liveAllowed (a live backend is Pro and Team), limits (live backends used and allowed, caps in bytes), blueprints (starting points: id, label, summary), draft (sign in methods, invite only, roles, tables with their fields and who may see, add, change and delete, files, automations, webhooks), pending (changes of the draft that are not live yet, each a plain sentence; destructive = true when it removes data), live (address, status, privacy page, the publishable key that ships in the app, only the first characters of the secret key, usage: data, files and traffic this month against the caps in bytes, capReachedAt when new data is refused), storeAnswers (App Store and Google Play privacy answers), addons (extra live backends and cap boosts with the monthly price in USD cents), backups (newest first: id, reason, size, rows, time) and lastAiStep (the newest AI backend step: status QUEUED, RUNNING, SUCCEEDED or FAILED, credits, refunded, error, and the changes it made as sentences). Never the JSON spec, the secret key or the webhook secret. Read only. Every plan with an account.',
    inputSchema: { type: 'object', properties: { app: appProp }, required: ['app'] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'request_builder_backend_change',
    title: 'Ask the app builder to make or change the backend',
    description:
      'Describe the backend of a builder app in plain words ("people book a class, staff confirm it", "ask for a phone number on bookings"). The AI writes or changes the backend draft (tables, sign in, who may do what, files, automations); the answer lists the changes as sentences, never code. Costs builder credits: backendSpec for the first backend, backendEdit for a change (see the prices in builder_status); all of it comes back when the step fails. Tell the person the cost, ask, and pass confirm: true. It takes about a minute: then call builder_backend_status (lastAiStep has the changes). The change is only a draft: on a live backend apply_builder_backend makes it live. One AI step per app at a time. Developer role. Every plan with an account (credits needed).',
    inputSchema: {
      type: 'object',
      properties: { app: appProp, request: { type: 'string', description: 'The backend or the change in plain words (3 to 2000 characters)' }, confirm: { type: 'boolean', const: true } },
      required: ['app', 'request', 'confirm'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'apply_builder_backend',
    title: 'Make the backend changes live',
    description:
      'Make the waiting backend changes of a builder app live (pending in builder_backend_status), on an app that already has a live backend. Show the person the changes, ask, and pass confirm: true. Changes that remove data (a table or field removed, a field type changed) are not made: the answer has applied: false and needsConfirm with each of them as a sentence, and nothing changes. Show those to the person and say what data goes; only when they agree, call again with confirm: true and confirmDataLoss: true. AppForShare then backs up all the data first (backupId in the answer) and makes the changes in one step. Going live the first time is done in the dashboard or with appforshare builder backend <app> live, not here. Developer role. Pro and Team.',
    inputSchema: {
      type: 'object',
      properties: {
        app: appProp,
        confirm: { type: 'boolean', const: true },
        confirmDataLoss: { type: 'boolean', default: false, description: 'true only after the person agreed to the changes in needsConfirm that remove data' },
      },
      required: ['app', 'confirm'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'export_builder_backend',
    title: 'Download the backend code or data',
    description:
      'Save a download of a builder app\'s backend as a file on this computer and return its path and size (the file is never put into the chat). what: code = the backend as a NestJS + Prisma + Postgres project ZIP with OpenAPI, a Postman collection and a deploy guide (every plan with an account); data = all tables of the live backend as a ZIP of JSON or CSV files (format), app users included, so it holds personal data: say so; backup = one backup by its id from builder_backend_status (.jsonl.gz). path = where to save it (default this folder with the file name AppForShare gives); an existing file is never replaced. Read only on AppForShare.',
    inputSchema: {
      type: 'object',
      properties: {
        app: appProp,
        what: { type: 'string', enum: ['code', 'data', 'backup'], default: 'code' },
        format: { type: 'string', enum: ['json', 'csv'], default: 'json', description: 'With what: data' },
        backup: { type: 'integer', description: 'Backup id from builder_backend_status, with what: backup' },
        path: { type: 'string', description: 'File path to save to (optional)' },
      },
      required: ['app'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

export const BACKEND_TOOL_NAMES = new Set(BACKEND_TOOLS.map((t) => t.name));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(c: Ctx, method: string, path: string, json?: unknown): Promise<Response> {
  if (!c.token) throw new BackendToolError('APPFORSHARE_TOKEN is not set. Create an API token at https://appforshare.io/dashboard/settings.');
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${c.api}/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${c.token}`, 'User-Agent': c.ua, ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: json !== undefined ? JSON.stringify(json) : undefined,
      });
    } catch (err) {
      // A POST is not sent twice (an AI step costs credits): only reads are tried again.
      if (attempt >= 4 || method !== 'GET') throw new BackendToolError(`Network error: ${(err as Error).message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status >= 500 && attempt < 4 && method === 'GET') {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { message?: string | string[]; errors?: unknown };
      const msg = (Array.isArray(d.message) ? d.message[0] : d.message) || `Request failed with ${res.status}`;
      throw new BackendToolError(Array.isArray(d.errors) && d.errors.length ? `${msg} ${JSON.stringify(d.errors).slice(0, 1500)}` : msg);
    }
    return res;
  }
}

const getJson = async <T>(c: Ctx, method: string, path: string, json?: unknown) => (await (await request(c, method, path, json)).json()) as T;

function appId(a: Args): number {
  const id = a.app;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) throw new BackendToolError('app is required: a builder app id from builder_status');
  return id;
}

function needConfirm(a: Args) {
  if (a.confirm !== true) throw new BackendToolError('Set confirm to true once the person has agreed to this change.');
}

type Run = { id: number; kind: string; status: string; credits: number; refunded: boolean; error: string | null; createdAt?: string; finishedAt?: string | null; report?: { changes?: string[]; destructive?: boolean } | null };

export async function runBackendTool(c: Ctx, name: string, a: Args): Promise<Record<string, unknown>> {
  const id = appId(a);
  const base = `/ci/builder/apps/${id}/backend`;
  if (name === 'builder_backend_status') {
    const [view, app] = await Promise.all([
      getJson<Record<string, unknown> & { live?: Record<string, unknown> | null }>(c, 'GET', base),
      getJson<{ runs?: Run[] }>(c, 'GET', `/ci/builder/apps/${id}`).catch(() => ({ runs: [] as Run[] })),
    ]);
    // The webhook secret signs calls to the customer's own server: it stays in the dashboard, not in a chat.
    if (view.live && 'webhookSecret' in view.live) {
      const { webhookSecret, ...live } = view.live;
      view.live = { ...live, webhookSecretSet: !!webhookSecret };
    }
    const r = (app.runs ?? []).find((x) => x.kind === 'BACKEND');
    const lastAiStep = r ? { id: r.id, status: r.status, credits: r.credits, refunded: r.refunded, error: r.error, changes: r.report?.changes ?? [], removesData: !!r.report?.destructive, createdAt: r.createdAt, finishedAt: r.finishedAt } : null;
    return { ...view, lastAiStep };
  }
  if (name === 'request_builder_backend_change') {
    needConfirm(a);
    const text = typeof a.request === 'string' ? a.request.trim() : '';
    if (text.length < 3 || text.length > 2000) throw new BackendToolError('request is the backend or the change in plain words, 3 to 2000 characters.');
    const run = await getJson<Run>(c, 'POST', `${base}/ai`, { request: text });
    return { ...run, next: `Queued (${run.credits} builder credits, given back if it fails). The AI answers in about a minute: call builder_backend_status with app ${id}; lastAiStep has the changes. The change is a draft until apply_builder_backend makes it live.` };
  }
  if (name === 'apply_builder_backend') {
    needConfirm(a);
    const r = await getJson<{ applied: boolean; needsConfirm: { text: string }[]; changes: { text: string }[]; backupId?: number }>(c, 'POST', `${base}/apply`, a.confirmDataLoss === true ? { confirm: true } : {});
    if (!r.applied && r.needsConfirm.length) {
      return { ...r, next: 'Nothing was changed. These changes remove data (needsConfirm). Show them to the person and say which data goes. Only if they agree, call again with confirm: true and confirmDataLoss: true; AppForShare backs up all the data first.' };
    }
    return { ...r, next: !r.changes.length ? 'No changes were waiting: the live backend is up to date.' : r.backupId ? `Live now. Backup ${r.backupId} was taken first (export_builder_backend with what: backup).` : 'Live now.' };
  }
  if (name === 'export_builder_backend') {
    const what = a.what ?? 'code';
    let path: string;
    if (what === 'code') path = `${base}/export`;
    else if (what === 'data') {
      const format = a.format ?? 'json';
      if (format !== 'json' && format !== 'csv') throw new BackendToolError('format is "json" or "csv".');
      path = `${base}/data-export?format=${format}`;
    } else if (what === 'backup') {
      if (typeof a.backup !== 'number' || !Number.isInteger(a.backup) || a.backup <= 0) throw new BackendToolError('backup is required with what: backup (an id from builder_backend_status).');
      path = `${base}/backups/${a.backup}/download`;
    } else throw new BackendToolError('what is "code", "data" or "backup".');
    if (typeof a.path === 'string' && a.path.trim() && existsSync(resolve(a.path))) throw new BackendToolError(`${resolve(a.path)} already exists. Pick another path.`);
    const res = await request(c, 'GET', path);
    const served = basename(/filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? '');
    const file = resolve(typeof a.path === 'string' && a.path.trim() ? a.path : served || (what === 'backup' ? `backend-${id}-backup-${a.backup}.jsonl.gz` : `backend-${id}-${what}.zip`));
    if (existsSync(file)) throw new BackendToolError(`${file} already exists. Pass another path.`);
    const body = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, body, { flag: 'wx' });
    return {
      path: file,
      bytes: body.length,
      what,
      ...(what === 'data' ? { note: 'This file holds the personal data of the app\'s users. Keep it private and delete it when it is no longer needed.' } : {}),
    };
  }
  throw new BackendToolError(`Unknown tool ${name}`);
}
