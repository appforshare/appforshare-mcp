# AppForShare MCP tools

The MCP server itself is part of Pro and Team, so every tool needs at least Pro. "Team" means the tool needs Team.
"Confirm" means the Developer role and `confirm: true`, set only after the person agreed. `build` takes a build id
or the slug of its install link.

`upload_build` and `check_local_build` are only in the local npm server `appforshare-mcp`. Every other tool is on the
hosted server `https://appforshare.io/api/mcp` and passed through by the npm server. A read only API token sees only the
read tools; an upload token adds `create_upload_link` and `upload_from_url`.

## Read

| Tool | What it returns | Plan |
|---|---|---|
| `whoami` | Account, plan and role of the connection | Pro |
| `find_app_steps` | Where to click in the dashboard for a task, exact button names, and whether this plan and role allow it | Pro |
| `check_local_build` | Checks a local .ipa, .apk or .aab (`path`) without uploading it: store readiness, install problems, security scan counts (findings with a Pro or Team token). npm server only | Pro |
| `check_upload` | State of a `ticket` from `create_upload_link` or `upload_from_url`: waiting, uploading, processing, ready (install link and readiness) or failed | Pro |
| `list_webhooks` | Webhooks with events and failures; with `webhook`, its last 30 deliveries. Never a URL or secret (Owner or Admin) | Pro |
| `list_projects` | Projects (one per app and platform) with ids | Pro |
| `list_builds` | Recent builds: install link, version, size, installs, readiness status, channels. Filters `platform`, `app`, `project`, `channel`, `limit` | Pro |
| `latest_build` | Newest build matching the same filters, with release notes and readiness findings | Pro |
| `get_security_scan` | Security scan of one build: masked hardcoded secrets, Android and iOS findings, known vulnerable library versions, each with a level, a MASVS category and a fix | Pro |
| `get_install_badge` | README or docs download button for a build (id or slug) or a channel (address): Markdown and HTML, dark and light, link with `?ref=badge`; a channel badge shows its newest version | Pro |
| `build_info` | One build with every readiness finding and its fix; Expo apps also get Expo facts (SDK, runtime version, update channel, development client) and the Expo checks | Pro |
| `build_install_issues` | Why a tester's phone may refuse a build; optional `udid` | Pro |
| `build_installs` | Who installed a build: device, OS, model, country, tester | Pro |
| `list_build_links` | Extra share links of a build with installs, password yes or no, stop date, cap, state | Pro |
| `list_feedback` | Tester feedback with its source (page, app, testflight); optional `build`, `status` (open, resolved, all), `blockers`, `source` (TestFlight feedback is Team) | Pro |
| `test_plan` | The build's AI test plan with ticks (with `generate: true` it writes one, see below) | Pro |
| `export_test_plan` | Test plan as Firebase App Testing YAML (`format: firebase`) or a Maestro flow (`maestro`) | Pro |
| `release_status` | App Store and Google Play versions, review state, TestFlight builds, Play tracks; needs a store connection | Pro |
| `list_reviews` | Store reviews; replies are posted by a person in the dashboard | Pro |
| `release_checklist` | Release checklist ticks, open blockers, whether the gated channel takes the build | Team |
| `recent_activity` | Workspace activity with who did it; optional `project`, `kind` | Team |
| `list_testers` | Testers with projects and groups; optional `project`, `group` | Team |
| `release_defaults` | Saved release defaults per shared store app: What's New per language, phased release, Play track and percent | Pro |
| `github_build_run` | Recent AppForShare runs on the workspace's GitHub Actions; with `run`, one run and the AI explanation of a failure if there is one | Pro |
| `release_overview` | One version of an app: builds per platform, checklist and approvals, open blockers, store state, Android vitals (crash and ANR rate, Team), timeline. Give `version` and `app` | Team (Pro without the checklist) |
| `list_tester_groups` | Groups with member counts and projects | Team |
| `list_access_codes` | Per tester access codes of a build or extra link: label, devices used, state (the codes are never shown again) | Team |
| `rollout_plan` | Scheduled Google Play rollout plans of a shared app: steps, next step time, status and why | Team |
| `store_upload_status` | Whether a build can be sent to TestFlight or a Google Play track and why not, the target store app, and every send so far with its status and the store answer. Each send shows its options (What to Test, TestFlight groups and beta review, Play release name, in-app update priority, not sent for review) and what happened to each. Sending is done in the dashboard or with `appforshare store-upload` / `upload --store-upload` | Pro |
| `channel_followers` | People who follow a channel by email ("Email me new builds"): confirmed and pending counts, the plan cap and masked addresses, newest first. Name the app by `app` (bundle id) or `project`. Removing a follower is done in the dashboard or the CLI | Pro |
| `get_store_pages` | Store pages (privacy policy, support, account deletion) of the shared App Store and Google Play apps: addresses, status, unpublished changes, what is still missing, facts read from the newest build. Optional `app`, `store`. Editing and publishing happen in the dashboard or the CLI. Not legal advice | Pro (one app), Team (every app) |
| `cleanup_preview` | Which builds of a `project` an automatic clean up would move to the 7 day restore list now, the storage it would free, and which old builds it keeps on purpose (newest per platform, a channel's current build, client deliveries, store sends in the last 90 days, builds marked keep). Uses the saved rule, or `keep` (newest N per platform, 5 to 200) and `olderDays` (30, 60, 90 or 180). Nothing is deleted; a person runs a clean up with `appforshare cleanup` | Pro |
| `intune_status` | Whether a build can be sent to the workspace's Microsoft Intune as a line of business app (enterprise or ad hoc .ipa, or an APK) and why not, the connection status (never the secret), and every send so far with its status and result. Assignment to groups stays in Intune. Sending is done by an Admin in the dashboard or with `appforshare store-upload <id> --to intune --yes` | Team |
| `android_store_status` | AppForShare Android store listings: status and what is missing, the package name claim (verified, pending, failed with the reason, or disputed), source repository, tag and variant, releases, GitHub Actions store builds (accepted, or not accepted with the reason) with the workflow block to add, and the public page. Optional `project` or `app` (package name); without them every store app in short. Setup, claims and releases happen in the project's Store tab; also `appforshare store status` | Pro (MCP access) |
| `builder_backend_status` | Managed backend of a builder `app` in plain words: sign in, tables, who may do what, changes not live yet, live address and publishable key, usage against the caps, add-ons, backups and the last AI backend step with its changes. Never the spec JSON, secret key or webhook secret. npm server only | Every plan with an account |
| `export_builder_backend` | Saves the backend code ZIP (`what: code`), all live data as a JSON or CSV ZIP (`what: data`, `format`; holds app users' personal data) or one backup (`what: backup`, `backup`) on this computer and returns the path; never put into the chat, never replaces a file. npm server only | Every plan with an account (data: a live backend) |

## Change (Developer role, confirm: true)

| Tool | What it changes | Plan |
|---|---|---|
| `upload_build` | Uploads a local .ipa, .apk or .aab (`path`, optional `notes`, `channel`). No confirm field: the person's request to upload is the consent | Pro |
| `promote_build` | Makes a build the newest in a `channel`; an older build rolls the link back | Pro |
| `set_channel_address` | Gives a channel its own address (`slug`), old one redirects 30 days; name the app by `app` or `project` | Pro |
| `set_testflight_link` | TestFlight public link on a channel (`url`, or `null` to remove) | Pro |
| `set_link_controls` | `paused`, `startAt`, `stopAt`, `maxInstalls` on a build's link (`null` removes) | Pro |
| `add_build_link` | Extra share link with `label`, optional `password`, `startAt`, `expiresAt`, `maxInstalls` (Pro 3 per build, Team 20) | Pro |
| `remove_build_link` | Turns off one extra link by `link` slug; cannot be undone | Pro |
| `retire_build` | Retires a broken test build, optional `reason`; `undo: true` brings it back | Pro |
| `email_build_link` | Mails the install link to up to 5 `emails`; not for private projects | Pro |
| `delete_build` | Deletes a build; restorable from the dashboard for 7 days | Pro |
| `restore_build` | Restores a build deleted in the last 7 days (without `build`, lists them) | Pro |
| `resign_build` | Re-signs an iOS build with a new ad hoc, development or enterprise profile (`profiles` names, or the best one); a new build, the original stays. Without `confirm` only the check | Pro |
| `create_upload_link` | A one time browser link (30 minutes, no sign in) where the person drops a build into this workspace; then `check_upload`. No confirm field: the person asked for it | Pro |
| `upload_from_url` | Uploads a build from a public https `url` (release asset, signed CI artifact); private and local addresses are refused. No confirm field | Pro |
| `reply_to_feedback` | Replies to a feedback report; the tester gets one email and can answer once on the install page (confirm) | Team |
| `resolve_feedback` | Marks a feedback report resolved, or `reopen: true` | Pro |
| `send_feedback_to_tracker` | Makes a Linear or Jira issue from a feedback report (`tracker`) | Pro |
| `test_plan` with `generate: true` | Writes a new AI test plan; uses 1 AI action | Pro |
| `github_build_run` with `explain: true` | Writes the AI explanation of a failed run; uses 1 AI action, never changes code | Pro |
| `set_release_defaults` | Saves `whatsNew`, `phased`, `playTrack`, `playPercent` for one shared store app; only saved in AppForShare, never sent to a store | Pro |
| `tick_release_step` | Ticks (or `done: false` unticks) one checklist step by `key` | Team |
| `task_from_feedback` | Adds a task to the project board from a feedback report | Team |
| `request_builder_backend_change` | Makes or changes the backend draft of a builder `app` from a plain words `request`; costs builder credits (backendSpec or backendEdit, given back if it fails); then `builder_backend_status`. npm server only | Every plan with an account |
| `apply_builder_backend` | Makes the waiting backend changes live. Changes that remove data come back in `needsConfirm` and nothing changes; after the person agrees, call again with `confirmDataLoss: true` (a backup is taken first). npm server only | Pro |
| `add_testers` | Adds testers by `emails`, optional `project`, `groups`; invites unless `notify: false` | Team |
| `remove_testers` | Removes testers, or with `project` only their direct access there | Team |
| `share_build_with_testers` | Gives `groups` and `testers` the build's project and mails them the link | Team |
| `create_access_code` | One off access code with `label` and device count (1 to 50); returned once. Owner or Admin role | Team |
| `revoke_access_code` | Turns off one access code by id; cannot be undone. Owner or Admin role | Team |

Not available: submitting for review, editing store listings, replying to reviews, uploading to TestFlight or
Google Play, starting GitHub builds, approving releases, and setting or changing
scheduled rollouts (a person does those in the dashboard).
