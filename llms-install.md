# Installing the AppForShare MCP server

AppForShare shares iOS and Android test builds. This server lets an AI assistant upload builds, find install links,
manage testers and read the store readiness check.

## What you need

1. An AppForShare API token. The user creates it at https://appforshare.io/dashboard/settings (API tokens). Tokens
   start with `afs_` and need a Pro or Team plan. Ask the user for it; never invent one.
2. Node.js 18 or newer (for the local server).

## Option A: local server (can upload files from this computer)

Add this to the MCP settings:

```json
{
  "mcpServers": {
    "appforshare": {
      "command": "npx",
      "args": ["-y", "appforshare-mcp"],
      "env": { "APPFORSHARE_TOKEN": "afs_the_users_token" }
    }
  }
}
```

## Option B: hosted server (no Node needed, no local file uploads)

```json
{
  "mcpServers": {
    "appforshare": {
      "url": "https://appforshare.io/api/mcp",
      "headers": { "Authorization": "Bearer afs_the_users_token" }
    }
  }
}
```

## Check it works

Call the `whoami` tool. It answers with the account, plan and role of the token. If it says the token is not valid,
ask the user to create a new one.
