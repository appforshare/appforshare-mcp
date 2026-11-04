# AppForShare CLI (`npx appforshare`)

Needs an API token (Pro and Team) in `APPFORSHARE_TOKEN` or `--token`. Add `--json` to read results. Run
`npx appforshare --help` for the full list of the installed version. The CLI has no confirm step except
`delete --yes`: ask the person before any command that mails people or changes who can install (see SKILL.md,
section 5).

## Upload

```sh
npx appforshare upload app.ipa --notes "What to test" --json
npx appforshare upload build/app/outputs/flutter-apk          # newest .ipa, .apk or .aab in the folder
npx appforshare init                                          # writes appforshare.config.json
npx appforshare upload                                        # newest iOS and Android builds from the config
```

| Option | Meaning |
|---|---|
| `--notes <text>`, `--notes-file <path>`, `--comment <text>` | Release notes shown to testers |
| `--ios-notes`, `--android-notes` | Notes per platform (folder or config uploads) |
| `--password <text>` | Password on the install link (4 to 128 characters) |
| `--channel <name>` | Put the build into this channel when ready (created on first use) |
| `--start <time>` | Link opens for installs at this time, for example `2026-12-01T09:00Z` |
| `--email <emails>` | Mail the link to up to 5 addresses when ready (Pro) |
| `--groups <names>`, `--testers <emails>`, `--testers-file <path>` | Share with tester groups and testers (Team) |
| `--fail-on blocked\|review` | Exit code 2 on that readiness result; the build stays uploaded |
| `--no-wait` | Do not wait for processing |

`--json` output has `url`, `slug`, `version`, `readiness` (`ready`, `review`, `blocked`, `unknown`), `findings`
and `channel`. In GitHub Actions the step outputs `url`, `slug`, `readiness` and `channel_url` are set too.

## Read

```sh
npx appforshare whoami
npx appforshare builds [--platform ios|android] [--app <bundle id>] [--project <id>] [--channel <name>] [--limit <n>]
npx appforshare latest --channel beta --platform android
npx appforshare info <id|slug>                 # readiness findings with fixes, install issues
npx appforshare installs <id|slug>
npx appforshare checklist <id|slug>            # Team
npx appforshare feedback [id|slug] [--status open|resolved|all]
npx appforshare link list <id|slug>
npx appforshare activity [--project <id>] [--kind <k>]    # Team
npx appforshare testers [--project <id>] [--group <name>] # Team
npx appforshare groups                                    # Team
npx appforshare test-plan <id|slug> [--format firebase|maestro] [--out <file>]
```

## Change (ask first)

```sh
npx appforshare promote <id|slug> --channel live
npx appforshare channel-address acme-beta --channel beta --app com.example.app
npx appforshare testflight https://testflight.apple.com/join/CODE --channel beta --app com.example.app   # or off
npx appforshare link <id|slug> --pause | --resume | --start <time|off> | --stop <YYYY-MM-DD|off> | --max-installs <n|off>
npx appforshare link add <id|slug> --label "Client A" [--password <text>] [--start <time>] [--stop 2026-12-31] [--max-installs 50]
npx appforshare link edit <link> [--label <name>] [--password <text>|off] [--start <time>|off] [--stop <date>|off] [--max-installs <n>|off]
npx appforshare link rm <link>
npx appforshare retire <id|slug> [--reason "Crashes on login"]   # --undo brings it back
npx appforshare email <id|slug> --to a@example.com,b@example.com
npx appforshare delete <id|slug> --yes
npx appforshare send-feedback <feedback id> --to linear|jira
npx appforshare feedback-task <feedback id>                      # Team
npx appforshare testers add <emails> [--project <id>] [--groups <names>] [--no-notify]   # Team
npx appforshare testers remove <emails> [--project <id>]         # Team
npx appforshare distribute <id|slug> --groups <names> --testers <emails>                 # Team
```

`promote --force` passes the Team release checklist gate and is for Admins only; use it only when the person asks.
