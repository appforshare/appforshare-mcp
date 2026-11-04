# AppForShare MCP tools

The MCP server itself is part of Pro and Team, so every tool needs at least Pro. "Team" means the tool needs Team.
"Confirm" means the Developer role and `confirm: true`, set only after the person agreed. `build` takes a build id
or the slug of its install link.

`upload_build` is only in the local npm server `appforshare-mcp`. Every other tool is on the hosted server
`https://appforshare.io/api/mcp` and passed through by the npm server.

## Read

| Tool | What it returns | Plan |
|---|---|---|
| `whoami` | Account, plan and role of the connection | Pro |
| `list_projects` | Projects (one per app and platform) with ids | Pro |
| `list_builds` | Recent builds: install link, version, size, installs, readiness status, channels. Filters `platform`, `app`, `project`, `channel`, `limit` | Pro |
| `latest_build` | Newest build matching the same filters, with release notes and readiness findings | Pro |
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
| `store_upload_status` | Whether a build can be sent to TestFlight or a Google Play track and why not, the target store app, and every send so far with its status and the store answer. Sending is done in the dashboard or with `appforshare store-upload` | Pro |

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
| `resolve_feedback` | Marks a feedback report resolved, or `reopen: true` | Pro |
| `send_feedback_to_tracker` | Makes a Linear or Jira issue from a feedback report (`tracker`) | Pro |
| `test_plan` with `generate: true` | Writes a new AI test plan; uses 1 AI action | Pro |
| `github_build_run` with `explain: true` | Writes the AI explanation of a failed run; uses 1 AI action, never changes code | Pro |
| `set_release_defaults` | Saves `whatsNew`, `phased`, `playTrack`, `playPercent` for one shared store app; only saved in AppForShare, never sent to a store | Pro |
| `tick_release_step` | Ticks (or `done: false` unticks) one checklist step by `key` | Team |
| `task_from_feedback` | Adds a task to the project board from a feedback report | Team |
| `add_testers` | Adds testers by `emails`, optional `project`, `groups`; invites unless `notify: false` | Team |
| `remove_testers` | Removes testers, or with `project` only their direct access there | Team |
| `share_build_with_testers` | Gives `groups` and `testers` the build's project and mails them the link | Team |
| `create_access_code` | One off access code with `label` and device count (1 to 50); returned once. Owner or Admin role | Team |
| `revoke_access_code` | Turns off one access code by id; cannot be undone. Owner or Admin role | Team |

Not available: submitting for review, editing store listings, replying to reviews, uploading to TestFlight or
Google Play, starting GitHub builds, approving releases, and setting or changing
scheduled rollouts (a person does those in the dashboard).
