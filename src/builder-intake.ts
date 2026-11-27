// Start an AI App Builder app from a document on this computer (statement of work, idea doc or spec): the hosted
// server cannot read the person's disk, so this stdio tool uploads the file to the same /api/ci route as
// `appforshare builder new --file` and asks for the questions. The rest of the start is the hosted tool
// builder_answer_questions (builder_start_from_idea for an idea only).
import { readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

export class IntakeToolError extends Error {}

type Ctx = { api: string; token: string; ua: string };
type Args = Record<string, unknown>;

const DOC_MAX = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown' };

export const INTAKE_TOOLS = [
  {
    name: 'builder_start_from_document',
    title: 'Start a builder app from a document',
    description:
      'First step of starting an AI App Builder app from a document on this computer: a statement of work from a client, an idea doc or a spec (PDF, Word .docx, TXT or Markdown, up to 10 MB; scanned pages without text cannot be read). The file is uploaded, checked for known malware, and only its text is kept. Optional idea adds a line of your own; kind mobile (iOS and Android, default) or web. appId (optional) = the app id for the stores, only when the person has one. Answers doc (name, pages, characters, truncated = only the start of a long text is used), intake (the id for builder_answer_questions), summary (what we understood), name (the suggested app name), questions (0 to 3, only about what the document leaves open: id q1 to q3, text and chips numbered from 0), designCredits and creditsLeft. Free: no credits. Ask the questions one at a time, then an optional note, then call builder_answer_questions (it costs designCredits: ask first). Developer role. Every plan with an account.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the document (.pdf, .docx, .txt, .md)' },
        idea: { type: 'string', description: 'A line of your own about the app (optional)' },
        kind: { type: 'string', enum: ['mobile', 'web'], default: 'mobile' },
        appId: { type: 'string', description: 'Optional app id for Google Play and the App Store (Android package and iOS bundle id), like com.yourcompany.app. Cannot change after the first store upload. Leave out for the generated one.' },
      },
      required: ['path'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

export const INTAKE_TOOL_NAMES = new Set(INTAKE_TOOLS.map((t) => t.name));

async function send<T>(c: Ctx, method: string, path: string, body?: { json?: unknown; form?: FormData }): Promise<T> {
  if (!c.token) throw new IntakeToolError('APPFORSHARE_TOKEN is not set. Create an API token at https://appforshare.io/dashboard/settings.');
  let res: Response;
  try {
    res = await fetch(`${c.api}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${c.token}`, 'User-Agent': c.ua, ...(body?.json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body?.form ?? (body?.json !== undefined ? JSON.stringify(body.json) : undefined),
    });
  } catch (err) {
    throw new IntakeToolError(`Network error: ${(err as Error).message}`);
  }
  const d = (await res.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!res.ok) throw new IntakeToolError((Array.isArray(d.message) ? d.message[0] : d.message) || `Request failed with ${res.status}`);
  return d;
}

type View = { id: number; kind: string; summary: string | null; name: string | null; bundleId?: string | null; suggestedBundleId?: string | null; questions: { id: string; topic: string; text: string; chips: string[] }[]; doc: { name: string; bytes: number } | null };
type Doc = { name: string; bytes: number; kind: string; pages: number | null; chars: number; truncated: boolean };

export async function runIntakeTool(c: Ctx, name: string, a: Args): Promise<Record<string, unknown>> {
  if (name !== 'builder_start_from_document') throw new IntakeToolError(`Unknown tool ${name}`);
  if (typeof a.path !== 'string' || !a.path.trim()) throw new IntakeToolError('path is required: the document on this computer.');
  const file = resolve(a.path);
  const type = TYPES[extname(file).toLowerCase()];
  if (!type) throw new IntakeToolError('builder_start_from_document reads a PDF, Word (.docx), TXT or Markdown document.');
  let size: number;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch {
    throw new IntakeToolError(`File not found: ${file}`);
  }
  if (size > DOC_MAX) throw new IntakeToolError('The document is over 10 MB. Paste the main points into builder_start_from_idea instead.');
  const kind = a.kind === undefined ? 'MOBILE' : a.kind === 'web' ? 'WEB' : a.kind === 'mobile' ? 'MOBILE' : null;
  if (!kind) throw new IntakeToolError('kind is "mobile" or "web".');
  const idea = typeof a.idea === 'string' ? a.idea.trim().slice(0, 2000) : '';
  const appId = typeof a.appId === 'string' ? a.appId.trim() : '';
  if (appId && kind === 'WEB') throw new IntakeToolError('Web apps have no store app id. Leave appId out.');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(readFileSync(file))], { type }), basename(file));
  const up = await send<{ intakeId: number; doc: Doc }>(c, 'POST', '/ci/builder/intake/doc', { form });
  const view = await send<View>(c, 'POST', '/ci/builder/intake', { json: { idea: idea || null, kind, intakeId: up.intakeId, ...(appId ? { bundleId: appId } : {}) } });
  const o = await send<{ prices?: { designSpec?: number }; credits?: { total?: number } }>(c, 'GET', '/ci/builder').catch(() => ({}) as { prices?: { designSpec?: number }; credits?: { total?: number } });
  return {
    doc: up.doc,
    intake: view.id,
    kind: view.kind,
    summary: view.summary,
    name: view.name,
    appId: view.bundleId ?? null,
    suggestedAppId: view.suggestedBundleId ?? null,
    questions: view.questions,
    designCredits: o.prices?.designSpec ?? null,
    creditsLeft: o.credits?.total ?? null,
    next: view.questions.length
      ? `Ask the ${view.questions.length} question(s) one at a time, then an optional note, then call builder_answer_questions with intake ${view.id} (it costs designCredits: ask the person first and pass confirm: true).`
      : `No questions: the document says enough. Ask for an optional note, then call builder_answer_questions with intake ${view.id} (it costs designCredits: ask the person first and pass confirm: true).`,
  };
}
