# appforshare-mcp

[![mcptry](https://mcptry.com/badge/io.appforshare/appforshare)](https://mcptry.com/servers/io.appforshare/appforshare)

<img src="assets/logo-400.png" alt="AppForShare" width="96" height="96">

MCP server for [AppForShare](https://appforshare.io). Lets Claude Code, Cursor, Codex, VS Code, Gemini CLI and other
MCP clients upload iOS and Android builds, find install links, read the store readiness check and follow App Store
and Google Play releases and reviews.

Needs an AppForShare API token (Pro and Team), from https://appforshare.io/dashboard/settings, and Node 18 or newer.

```json
{
  "mcpServers": {
    "appforshare": {
      "command": "npx",
      "args": ["-y", "appforshare-mcp"],
      "env": { "APPFORSHARE_TOKEN": "afs_your_token" }
    }
  }
}
```

Claude Code:

```sh
claude mcp add appforshare --env APPFORSHARE_TOKEN=afs_your_token -- npx -y appforshare-mcp
```

No local uploads needed? Use the hosted server instead: `https://appforshare.io/api/mcp`, with OAuth (Claude, ChatGPT and other clients that sign in) or the header `Authorization: Bearer afs_your_token`. Setup for each client: https://appforshare.io/docs/mcp

## Tools

| Tool | What it does |
|---|---|
| `upload_build` | Upload a local .ipa, .apk or .aab (release notes, channel). Returns the install link and readiness result. |
| `check_local_build` | Check a local .ipa, .apk or .aab without uploading it: store readiness, install problems and the security scan (findings with a Pro or Team token). |
| `create_upload_link`, `upload_from_url`, `check_upload` | A one time browser upload link for chat assistants (30 minutes), an upload from a public https URL, and their result. |
| `list_builds`, `latest_build` | Builds with install links, filtered by platform, app, project or channel. |
| `build_info` | One build with every store readiness finding and its fix. |
| `get_security_scan` | Security scan findings of one build, MASVS mapped, with a fix each (Pro). |
| `get_install_badge` | Download button for a README: Markdown and HTML of the Install test build badge for a build, or the live badge of a channel. Read only. |
| `list_projects`, `whoami` | Projects in the account; account, plan and role of the token. |
| `release_status`, `list_reviews` | App Store and Google Play release status and reviews. Read only. |
| `promote_build`, `delete_build`, `restore_build` | Change a channel, delete a build or restore one deleted in the last 7 days. Developer role and `confirm: true` required. |
| `resign_build` | Re-sign an iOS build with a new profile from the connected Apple account, saved as a new build. Without `confirm` it only checks; Developer role and `confirm: true` to queue. |
| `list_webhooks` | Webhooks with their events and recent deliveries, never a URL or secret. Read only. |
| `start_builder_build`, `builder_build` | Builds of an App Builder app: provider `github` (your GitHub Actions), `eas_own` (your Expo account), `eas_ours` (AppForShare's Expo account, builder credits, Pro and Team), each coming back as an AppForShare build with an install link, or Android on AppForShare's servers (provider `self_hosted`): a release APK and AAB signed with the app's own key, each build on a fresh machine of its own, added as an AppForShare build with an install link, usually in about 10 to 15 minutes. Builder credits, `confirm: true`, Developer role; `builder_build` follows a build (step, APK and AAB facts, install link, the end of the log with `log: true`). |
| `builder_release`, `builder_review_notes` | Store hand-off of a finished App Builder build: the AppForShare store (the app's repository as the store source), Google Play (the kept .aab) and the App Store (TestFlight, then review), what each still needs, the store checklist and every send. Read only; sends are made by an Admin in the dashboard or with `appforshare builder release --to ... --yes`. `builder_review_notes` returns the Notes for App Review and What to Test (template, or `ai: true` with `confirm: true` for one AI action). |
| `builder_github`, `set_builder_github` | Builds of an App Builder app on the customer's own GitHub (`start_builder_build` provider `github`): the GitHub installs, the app's repository, last push and iOS signing; picking an empty repository or creating one in an organization, the Apple Team ID, the App Store Connect key source and App Store builds (`iosAppStore`: iOS builds signed for TestFlight and App Store review), or forgetting the repository (`confirm: true`, Admin role). Every plan with an account. |
| `builder_bugs`, `builder_fix_bug` | Tester bug reports on the builds of an App Builder app (device, screenshots, status, the AI fix state) and Fix with AI: a report becomes a change request in the app's chat (builder credits, `confirm: true`, Developer role); when a build of the new version arrives the report gets "Fixed in version X" and is resolved. Every plan with an account. |
| `builder_figma_export` | The design of an App Builder app for Figma: design tokens in the W3C Design Tokens format and the list of screens; with a screen, that screen as an SVG with editable text in Inter that pastes into Figma as a frame. Read only. Every plan with an account. |
| `builder_start_from_idea`, `builder_start_from_document`, `builder_answer_questions` | Start an App Builder app from an idea or a local document (statement of work, idea doc or spec: PDF, DOCX, TXT, MD, up to 10 MB; `builder_start_from_document` runs in this npm package and uploads the file, only its text is kept): up to 3 short questions with suggested answers (no credits), then the answers (or skip) and an optional note make the app and start its design (design credits, given back if it fails; Developer role and `confirm: true` required). |
| `builder_import_figma` | Start from Figma (Pro and Team): whether Figma is connected, the screens of a Figma file, page or frame link, a readiness check of the picked screens (no credits), and a new App Builder app made from them (the design step uses builder credits; asks for confirmation first). The Figma token is connected in the dashboard, never through the tool |
| `builder_backend_status`, `request_builder_backend_change`, `apply_builder_backend`, `export_builder_backend` | The managed backend of an App Builder app: its state in plain words, a change in plain words (builder credits, `confirm: true`), making changes live (`confirm: true`; changes that remove data also need `confirmDataLoss: true` and are backed up first), and the backend code, data or a backup saved as a file on this computer. This npm server only. |

Environment: `APPFORSHARE_TOKEN` (required), `APPFORSHARE_API` (default `https://appforshare.io`).

## Agent skill

[`skills/appforshare`](skills/appforshare) is an agent skill (a folder with a `SKILL.md`) that tells Claude Code,
Codex and other agents that load skills when to upload, which tools and CLI flags to use, how to read the store
readiness result, and which actions need the person's confirmation. It points to the hosted OAuth server first and
to `npx appforshare` as the fallback. Copy the folder to `~/.claude/skills/` (Claude Code, all projects),
`.claude/skills/` in a project, or `~/.agents/skills/` (Codex). Free to use; the tools it calls need Pro or Team.

MIT licence.

## Registry

Listed in the official MCP Registry as `io.appforshare/appforshare`.
