# Bento CLI

Command-line interface for [Bento](https://bentonow.com) email marketing. Manage subscribers, tags, events, and broadcasts directly from your terminal.

[![npm version](https://img.shields.io/npm/v/@bentonow/bento-cli.svg)](https://www.npmjs.com/package/@bentonow/bento-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
# Install globally with npm
npm install -g @bentonow/bento-cli

# Or with Bun
bun install -g @bentonow/bento-cli
```

## Quick Start

```bash
# 1. Authenticate with your Bento credentials
bento auth login

# 2. Verify your connection
bento stats site

# 3. Start managing your subscribers
bento subscribers search --tag active
bento tags list
```

## Authentication

The CLI uses your Bento API credentials. Get them from [Settings > API](https://app.bentonow.com/settings/api) in your Bento dashboard.

```bash
# Interactive login (prompts for credentials)
bento auth login

# Non-interactive login (for CI/scripts)
bento auth login \
  --publishable-key "your-publishable-key" \
  --secret-key "your-secret-key" \
  --site-uuid "your-site-uuid"

# Check authentication status
bento auth status

# Log out (removes stored credentials)
bento auth logout
```

### Multiple Profiles

Manage multiple Bento accounts (e.g., production, staging):

```bash
# Add a named profile
bento profile add production
bento profile add staging

# Switch between profiles
bento profile use staging

# List all profiles
bento profile list

# Remove a profile
bento profile remove staging
```

Credentials are stored securely at:
- **macOS**: `~/Library/Application Support/bento/config.json`
- **Linux**: `~/.config/bento/config.json`
- **Windows**: `%APPDATA%/bento/config.json`

## Commands

### Subscribers

```bash
# Search subscribers
bento subscribers search --email user@example.com
bento subscribers search --tag vip
bento subscribers search --field plan=pro
bento subscribers search --tag active --page 2 --per-page 50

# Import subscribers from CSV (email column required)
bento subscribers import contacts.csv
bento subscribers import contacts.csv --dry-run        # Preview first
bento subscribers import contacts.csv --limit 100      # Import first 100

# Add/remove tags from subscribers
bento subscribers tag --email user@example.com --add vip
bento subscribers tag --email user@example.com --remove trial
bento subscribers tag --file users.csv --add customer,active --confirm

# Unsubscribe (stop email delivery)
bento subscribers unsubscribe --email user@example.com
bento subscribers unsubscribe --file unsubscribes.csv --confirm

# Re-subscribe (restore email delivery)
bento subscribers subscribe --email user@example.com
```

### Tags

```bash
# List all tags
bento tags list

# Create a new tag
bento tags create "new-feature-announcement"

# Delete a tag (via web interface - API limitation)
bento tags delete "old-tag"
```

### Custom Fields

```bash
# List all custom fields
bento fields list

# Create a new field
bento fields create company_size
```

### Events

Track custom events to trigger automations:

```bash
# Track a simple event
bento events track --email user@example.com --event signed_up

# Track with details
bento events track \
  --email user@example.com \
  --event purchase \
  --details '{"product": "Pro Plan", "amount": 99}'
```

### Broadcasts

```bash
# List all broadcasts
bento broadcasts list

# Create a broadcast draft
bento broadcasts create \
  --name "January Newsletter" \
  --subject "What's new this month" \
  --content "<h1>Hello!</h1><p>Here's our update...</p>" \
  --type html \
  --include-tags "newsletter,active"
```

### Statistics

```bash
# View site-wide stats
bento stats site
```

## Output Modes

| Flag | Description |
|------|-------------|
| *(none)* | Human-readable tables with colors |
| `--json` | Machine-readable JSON for scripting |
| `--quiet` | Minimal output (errors only) |

```bash
# Default: pretty tables
bento subscribers search --tag vip

# JSON for scripting
bento subscribers search --tag vip --json | jq '.data[].email'

# Quiet for automation (exit code only)
bento tags create "test-tag" --quiet && echo "Created!"
```

### JSON Response Format

All `--json` output follows a consistent schema:

```json
{
  "success": true,
  "error": null,
  "data": { ... },
  "meta": {
    "count": 10,
    "total": 100
  }
}
```

## Safety Features

Bulk operations include safety flags to prevent mistakes:

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview what would happen without making changes |
| `--limit <n>` | Only process the first N items |
| `--sample <n>` | Show N sample items in the preview |
| `--confirm` | Skip interactive confirmation (for scripts) |

```bash
# Preview an import without executing
bento subscribers import big-list.csv --dry-run

# Import only the first 10 rows to test
bento subscribers import big-list.csv --limit 10

# Tag subscribers non-interactively (CI/scripts)
bento subscribers tag --file users.csv --add customer --confirm
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BENTO_CONFIG_PATH` | Override config file location |
| `BENTO_API_BASE_URL` | Override API endpoint (for testing) |
| `BENTO_AUTO_CONFIRM` | Set to `true` to skip all confirmations |
| `DEBUG` | Set to `bento` for verbose SDK logging |

## CSV Format

### For Subscriber Imports

CSV files must have an `email` column (case-insensitive). The CLI recognizes these special columns:

| Column | Description |
|--------|-------------|
| `email` | **Required**. Subscriber email address |
| `name` | Optional. Subscriber display name |
| `tags` | Optional. Tags to add (comma or semicolon separated) |
| `remove_tags` | Optional. Tags to remove (comma or semicolon separated) |
| *(other)* | Any other columns become custom fields |

**Basic import with custom fields:**
```csv
email,first_name,last_name,plan
alice@example.com,Alice,Smith,pro
bob@example.com,Bob,Jones,starter
```

**Import with inline tag assignment:**
```csv
email,name,tags,remove_tags,company
jesse@example.com,Jesse Hanley,"customer,mql",lead,Acme Inc
alice@example.com,Alice Smith,"newsletter,active",,Widgets Co
```

### For Email Lists (tag/unsubscribe operations)

A simple CSV with an `email` column:

```csv
email
alice@example.com
bob@example.com
```

Or a plain text file with one email per line (no header needed):

```
alice@example.com
bob@example.com
```

**Note:** Email lists are automatically deduplicated and normalized to lowercase.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments or usage |
| 6 | CSV parsing error |

## Examples

### CI/CD: Sync subscribers from your database

```bash
#!/bin/bash
# Export active users and sync to Bento

psql -c "COPY (SELECT email, name FROM users WHERE active) TO STDOUT CSV HEADER" \
  > /tmp/active-users.csv

bento subscribers import /tmp/active-users.csv --confirm --json
```

### Scripting: Tag users based on activity

```bash
#!/bin/bash
# Tag users who haven't been active

bento subscribers search --tag inactive --json \
  | jq -r '.data[].email' \
  | while read email; do
      bento subscribers tag --email "$email" --add "needs-reengagement" --confirm
    done
```

### Automation: Track events from webhooks

```bash
# In your webhook handler
curl -X POST https://your-server.com/webhook -d '{"email": "user@example.com", "event": "purchase"}'

# Handler script
bento events track \
  --email "$WEBHOOK_EMAIL" \
  --event "$WEBHOOK_EVENT" \
  --details "$WEBHOOK_DETAILS"
```

## Development

```bash
# Clone the repository
git clone https://github.com/bentonow/bento-cli.git
cd bento-cli

# Install dependencies
bun install

# Run CLI locally
bun run dev

# Run tests
bun test

# Lint and format
bun lint
bun format
```

## Claude Code Skill

This repository includes a [Claude Code](https://claude.ai/code) skill that provides guidance for using the Bento CLI. The skill teaches Claude about all available commands, safety patterns, and best practices.

### Installing the Skill

To install the bento-cli skill for Claude Code:

```bash
# Navigate to your Claude Code skills directory
cd ~/.claude/skills

# Clone the skill (or symlink from your local clone)
git clone https://github.com/bentonow/bento-cli.git bento-cli-repo
ln -s bento-cli-repo/skill bento-cli

# Or copy directly
cp -r /path/to/bento-cli/skill ~/.claude/skills/bento-cli
```

Alternatively, if you're working within the bento-cli repository, the skill is automatically available at `skill/SKILL.md`.

### What the Skill Provides

- **Command reference**: All CLI commands with options and examples
- **Safety-first philosophy**: Guidance on `--dry-run`, `--limit`, and `--confirm` flags
- **Anti-patterns**: Common mistakes to avoid with bulk operations
- **Workflows**: CI/CD integration, scripting patterns, safe import validation

## Requirements

- **Runtime**: [Bun](https://bun.sh) >= 1.0.0 or Node.js >= 18
- **Bento Account**: [Sign up](https://bentonow.com) if you don't have one

## Support

- **Documentation**: [docs.bentonow.com](https://docs.bentonow.com)
- **Issues**: [GitHub Issues](https://github.com/bentonow/bento-cli/issues)
- **Community**: [Discord](https://discord.gg/bento)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with love by the [Bento](https://bentonow.com) team.
