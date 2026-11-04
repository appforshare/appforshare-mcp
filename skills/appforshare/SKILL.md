---
name: appforshare
description: Share iOS and Android test builds with AppForShare (appforshare.io). Use when the person wants to upload an .ipa, .apk or .aab and get an install link or QR code, find the newest build or its link, read the store readiness check, put a build into a channel such as beta or live, make extra share links per client, pause or retire a test build, email a link, manage testers, read tester feedback, or check App Store and Google Play release status and reviews. Do not use for submitting to App Store review, editing store listings or uploading to TestFlight or Google Play; AppForShare does not do those from an assistant.
---

# AppForShare

AppForShare shares iOS and Android test builds by install link and QR code, checks each build against App Store and
Google Play rules, and follows store releases. You reach it through the AppForShare MCP server or the `appforshare`
CLI. Both work in one workspace with the person's role there.

## 1. Pick the connection

1. **Preferred: the hosted MCP server, `https://appforshare.io/api/mcp`.** The person signs in with OAuth from their
   client and picks a workspace; there is no token to paste. If AppForShare tools (`whoami`, `list_builds`, ...) are
   already available, use them. If not, tell the person how to add it, for example in Claude Code:
   `claude mcp add --transport http --scope user appforshare https://appforshare.io/api/mcp`, then `/mcp` and sign
   in. Other clients: https://appforshare.io/docs/mcp
2. **Uploading a file from this computer.** The hosted server cannot read the disk, so it has no upload tool. Use
   `upload_build` if the local npm server `appforshare-mcp` is connected (it adds `upload_build` and passes every
   other tool through). Otherwise use the CLI: `npx appforshare upload <file>`.
3. **Fallback: the CLI, `npx appforshare`.** Needs an API token in `APPFORSHARE_TOKEN` (or `--token`), made under
   Dashboard, Settings, API tokens. Never ask the person to paste a token into the chat; ask them to set the
   environment variable themselves. Add `--json` when you need to read the result. Commands are in
   [reference/cli.md](reference/cli.md).

Plans: the MCP server, the CLI and API tokens are part of Pro and Team. On Free, uploads happen on the website
(https://appforshare.io); say so instead of trying workarounds. Tools and commands marked Team below need Team.
Call `whoami` (or `npx appforshare whoami`) when you are not sure of the plan or role.

## 2. Upload a build

When the person asks to share, upload or send a build to testers:

1. Find the file. Common places: `build/ios/ipa/` (Flutter iOS), `build/app/outputs/flutter-apk/` (Flutter Android),
   `android/app/build/outputs/apk/release/` (React Native), `app/build/outputs/apk/release/` (native Android).
   `npx appforshare upload <folder>` takes the newest .ipa, .apk or .aab in a folder. If the project has
   `appforshare.config.json` (written by `npx appforshare init`), `npx appforshare upload` with no file sends the
   newest iOS and Android builds from the folders it lists.
2. Upload:
   - MCP: `upload_build` with `path`, optional `notes` (release notes, Pro and Team) and `channel`.
   - CLI: `npx appforshare upload app.ipa --notes "What to test" [--channel beta] --json`.
   An .aab is turned into one APK for testers.
3. Give the person the install link (`url`) and, if a channel was set, the channel link. Then report the store
   readiness result (section 3) in one or two lines.

Upload options that reach other people (ask first unless the person already named them): `--channel` (moves the
channel link to this build), `--email` (mails the link, up to 5 addresses, Pro), `--groups` and `--testers`
(shares and mails, Team), `--start` (link opens later, Pro and Team). `--password` protects the link.

In CI, `--fail-on blocked` (or `review`) makes the CLI exit with code 2 on that readiness result. The build is still
uploaded and its link works.

## 3. Read the store readiness result

Every account build is checked against current App Store and Google Play rules. The status is one of:

- `ready`: no blocker or warning found. Say it looks ready for the store check, not that it will be approved.
- `review`: warnings to look at before a store submission. List the titles and their fixes.
- `blocked`: at least one finding the store would reject (for example an old SDK or target API level). Show each
  blocker with its fix first.
- `unknown`: the build has no facts to check (old or unreadable upload), or the lookup failed.

Each finding has `level` (`blocker`, `warning`, `info`), `title` and `fix`. Get them with `build_info` or
`npx appforshare info <id|slug>`. The result is about store submission: a `blocked` test build still installs for
testers. The check is guidance only, never a promise of store approval; do not tell the person their app will pass
review.

When a tester cannot install, use `build_install_issues` (optionally with the tester's UDID) rather than the
readiness check; it covers signing, the provisioning profile, Developer Mode and the minimum OS.

## 4. Channels, extra links and retire

- **Channels** (Pro and Team): a channel such as `beta` or `live` has one stable link `/c/<code>` and QR that opens
  the newest build put into it. `promote_build` (or `npx appforshare promote <id> --channel live`) moves it. Using an
  older build rolls the link back; installed apps do not change. On Team a gated channel (Live by default) refuses a
  build until its release checklist is ticked and no release blocker is open: read `release_checklist` first. Never
  pass `--force` on the CLI unless the person, an Admin, asks for it. `set_channel_address` picks a custom address,
  `set_testflight_link` sends iPhones on the channel link to TestFlight while Android gets the APK.
- **Extra share links** (Pro up to 3 per build, Team up to 20): one link per client or group, each with its own
  label, optional password, start time, stop date and install cap. `add_build_link`, `list_build_links`,
  `remove_build_link` (cannot be undone), or CLI `link add|list|edit|rm`.
- **Link controls** (Pro and Team): `set_link_controls` or CLI `link <id>` pauses or resumes a build's link, sets a
  start time, a stop date or an install limit.
- **Retire** (Pro and Team): `retire_build` or `npx appforshare retire <id> --reason "Crashes on login"` for a broken
  test build. Its links take no installs, testers are sent to the newest build of the same app, channels skip it.
  Not a delete; `undo: true` (CLI `--undo`) brings it back. Prefer it over `delete_build` for a bad build testers
  already have.

## 5. Confirm rules

Every MCP tool that changes something needs the Developer role and `confirm: true`. Set `confirm: true` only after
the person agreed to that exact change in this conversation. Do not set it on a guess, and do not chain several
changes on one yes. A Viewer can only read.

Always ask first, naming who is affected, for anything that sends mail or changes who can install:

- Sends mail: `email_build_link`, `add_testers` (invites unless `notify: false`), `share_build_with_testers`, and
  CLI `email`, `distribute`, `testers add`, `groups add-members`, `upload --email/--groups/--testers`.
- Changes who can install or what a link opens: `promote_build`, `set_link_controls`, `add_build_link`,
  `remove_build_link`, `retire_build`, `set_channel_address`, `set_testflight_link`, `remove_testers`,
  `delete_build`, and their CLI commands (`promote`, `link`, `retire`, `channel-address`, `testflight`,
  `testers remove`, `delete --yes`).
- Other changes: `tick_release_step` (only tick what the person says was really done), `resolve_feedback`,
  `task_from_feedback`, `send_feedback_to_tracker`, `test_plan` with `generate: true` (uses 1 AI action).

The CLI has no confirm step of its own (only `delete` needs `--yes`), so apply the same rule before running any of
those commands. Reading tools (`list_builds`, `latest_build`, `build_info`, `build_installs`, `list_feedback`,
`release_status`, `list_reviews` and the other list tools) need no confirmation.

## 6. What AppForShare does not do from an assistant

It cannot submit a build for App Store review, edit store listings, reply to reviews, upload to TestFlight or
Google Play, or start GitHub builds. `release_status` and `list_reviews` only read. Say so and point to the
dashboard instead of looking for a way around it.

Full tool list with plans and roles: [reference/tools.md](reference/tools.md).
