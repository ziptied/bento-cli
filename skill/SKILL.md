---
name: bento-cli
description: >
  Guide for using Bento CLI to manage email marketing operations.
  Use when running bento commands, managing subscribers, tags, events,
  or automating email marketing workflows. Triggers on: bento CLI usage,
  subscriber management, email list operations, CSV imports.
---

# Bento CLI

A command-line interface for [Bento](https://bentonow.com) email marketing. Manage subscribers, tags, events, and broadcasts directly from the terminal.

## Philosophy: Safety-First Automation

Email operations affect real people. A bulk operation mistake can unsubscribe thousands or spam your entire list. The Bento CLI is designed with **safety-first automation** in mind.

**Before running any command, ask**:
- Is this a bulk operation? If yes, use `--dry-run` first
- Will this modify subscriber data? If yes, consider `--limit` for testing
- Is this running in CI/automation? If yes, use `--confirm` to skip interactive prompts
- Do I need the output for scripting? If yes, use `--json`

**Core principles**:
1. **Preview before execute**: Always `--dry-run` bulk operations first
2. **Progressive rollout**: Use `--limit` to test on small batches
3. **Explicit confirmation**: Bulk operations require `--confirm` in scripts
4. **Scriptable output**: Use `--json` for machine-readable, consistent output

## Command Reference

### Authentication

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

**Credentials**: Get from [Settings > API](https://app.bentonow.com/settings/api) in Bento dashboard.

### Profile Management

Manage multiple Bento accounts (production, staging, etc.):

```bash
bento profile add production    # Add named profile
bento profile add staging
bento profile use staging       # Switch active profile
bento profile list              # List all profiles
bento profile remove staging    # Remove a profile
```

### Subscribers

**Search subscribers**:
```bash
bento subscribers search --email user@example.com
bento subscribers search --tag vip
bento subscribers search --field plan=pro
bento subscribers search --tag active --page 2 --per-page 50
```

**Import from CSV** (requires `email` column):
```bash
bento subscribers import contacts.csv                    # Interactive
bento subscribers import contacts.csv --dry-run          # Preview only
bento subscribers import contacts.csv --limit 100        # First 100 rows
bento subscribers import contacts.csv --confirm          # Non-interactive
```

**Manage tags on subscribers**:
```bash
bento subscribers tag --email user@example.com --add vip
bento subscribers tag --email user@example.com --remove trial
bento subscribers tag --file users.csv --add customer,active --confirm
```

**Subscription management**:
```bash
bento subscribers unsubscribe --email user@example.com
bento subscribers unsubscribe --file unsubscribes.csv --confirm
bento subscribers subscribe --email user@example.com     # Re-subscribe
```

### Tags

```bash
bento tags list                           # List all tags
bento tags create "new-feature-announcement"  # Create tag
bento tags delete "old-tag"               # Delete (API limitation applies)
```

### Custom Fields

```bash
bento fields list                         # List all fields
bento fields create company_size          # Create field
```

### Events

Track custom events to trigger automations:

```bash
bento events track --email user@example.com --event signed_up

bento events track \
  --email user@example.com \
  --event purchase \
  --details '{"product": "Pro Plan", "amount": 99}'
```

### Broadcasts

```bash
bento broadcasts list                     # List all broadcasts

bento broadcasts create \
  --name "January Newsletter" \
  --subject "What's new this month" \
  --content "<h1>Hello!</h1><p>Here's our update...</p>" \
  --type html \
  --include-tags "newsletter,active"
```

### Statistics

```bash
bento stats site                          # View site-wide stats
```

## Safety Flags

| Flag | Purpose |
|------|---------|
| `--dry-run` | Preview what would happen without making changes |
| `--limit <n>` | Only process first N items |
| `--sample <n>` | Show N sample items in preview |
| `--confirm` | Skip interactive confirmation (required for scripts) |

## Output Modes

| Flag | Output Type |
|------|-------------|
| *(none)* | Human-readable tables with colors |
| `--json` | Machine-readable JSON for scripting |
| `--quiet` | Minimal output (errors only) |

**JSON response format**:
```json
{
  "success": true,
  "error": null,
  "data": { ... },
  "meta": { "count": 10, "total": 100 }
}
```

## CSV Format

**For imports** (additional columns map to subscriber fields):
```csv
email,first_name,last_name,plan
alice@example.com,Alice,Smith,pro
bob@example.com,Bob,Jones,starter
```

**For tag operations** (simple email list):
```csv
email
alice@example.com
bob@example.com
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments or usage |
| 6 | CSV parsing error |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BENTO_CONFIG_PATH` | Override config file location |
| `BENTO_API_BASE_URL` | Override API endpoint (testing) |
| `BENTO_AUTO_CONFIRM` | Set `true` to skip all confirmations |
| `DEBUG` | Set `bento` for verbose SDK logging |

## Anti-Patterns to Avoid

**Running bulk operations without preview**:
```bash
# BAD: Direct import without testing
bento subscribers import huge-list.csv --confirm

# GOOD: Preview first, then limit test, then full import
bento subscribers import huge-list.csv --dry-run
bento subscribers import huge-list.csv --limit 10 --confirm
bento subscribers import huge-list.csv --confirm
```

**Forgetting --confirm in scripts**:
```bash
# BAD: Will hang waiting for input in CI
bento subscribers tag --file users.csv --add vip

# GOOD: Explicit confirmation for automation
bento subscribers tag --file users.csv --add vip --confirm
```

**Not using --json for scripting**:
```bash
# BAD: Parsing human-readable tables
bento subscribers search --tag vip | grep email

# GOOD: Structured JSON output
bento subscribers search --tag vip --json | jq '.data[].email'
```

**Running destructive operations without understanding scope**:
```bash
# BAD: Unsubscribe operation on unclear file
bento subscribers unsubscribe --file list.csv --confirm

# GOOD: Preview the file contents first
head -20 list.csv
wc -l list.csv
bento subscribers unsubscribe --file list.csv --dry-run
```

## Common Workflows

### CI/CD: Sync subscribers from database
```bash
psql -c "COPY (SELECT email, name FROM users WHERE active) TO STDOUT CSV HEADER" \
  > /tmp/active-users.csv

bento subscribers import /tmp/active-users.csv --confirm --json
```

### Scripting: Batch tag operations
```bash
bento subscribers search --tag inactive --json \
  | jq -r '.data[].email' \
  | while read email; do
      bento subscribers tag --email "$email" --add "needs-reengagement" --confirm
    done
```

### Testing: Safe import validation
```bash
# 1. Validate CSV format
bento subscribers import contacts.csv --dry-run

# 2. Test with small batch
bento subscribers import contacts.csv --limit 5 --confirm

# 3. Full import
bento subscribers import contacts.csv --confirm
```

## Running Tests

```bash
bun test                                   # Run all tests
bun test src/tests/commands/tags.test.ts   # Run specific test file
```

## Remember

The Bento CLI gives you direct access to operations that affect real subscribers. The safety flags exist because mistakes are costly. Use `--dry-run` and `--limit` liberally. When in doubt, preview first.

For complex automation, prefer `--json` output and proper error handling over parsing human-readable tables.
