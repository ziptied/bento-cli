---
name: bento-cli
description: >
  Complete reference for the Bento CLI (bentonow.com). Use when running
  bento commands, managing subscribers, tags, events, broadcasts, sequences,
  templates, forms, workflows, transactional emails, or automating email
  marketing workflows. Covers all commands, safety flags, output modes,
  CSV formats, and CI/CD integration.
---

# Bento CLI

A command-line interface for [Bento](https://bentonow.com) email marketing. Manage subscribers, tags, events, broadcasts, sequences, templates, and more from the terminal.

## Installation & Usage

```bash
# Recommended: Run with npx (always uses latest version)
npx @bentonow/bento-cli --help

# Or install globally
npm install -g @bentonow/bento-cli
bento --help
```

## Philosophy: Safety-First Automation

Email operations affect real people. The Bento CLI is designed with **safety-first automation** in mind.

**Before running any command, ask**:
- Is this a bulk operation? Use `--dry-run` first
- Will this modify subscriber data? Use `--limit` for testing
- Is this running in CI/automation? Use `--confirm` to skip interactive prompts
- Do I need the output for scripting? Use `--json`

## Command Reference

### Authentication

```bash
bento auth login                              # Interactive login
bento auth login --profile staging \          # Non-interactive with named profile
  --publishable-key "pk_..." \
  --secret-key "sk_..." \
  --site-uuid "site_..."
bento auth status                             # Check auth status
bento auth logout                             # Clear credentials
```

**Credentials**: Get from [Settings > Teams](https://app.bentonow.com/account/teams).

### Profile Management

Manage multiple Bento accounts (production, staging, etc.):

```bash
bento profile add production                  # Add named profile (interactive)
bento profile add staging \                   # Add non-interactively
  --publishable-key "pk_..." \
  --secret-key "sk_..." \
  --site-uuid "site_..."
bento profile use staging                     # Switch active profile
bento profile list                            # List all profiles
bento profile remove staging                  # Remove a profile
bento profile remove staging --yes            # Skip confirmation
```

### Subscribers

**Search** (requires `--email` or `--uuid`):
```bash
bento subscribers search --email user@example.com
bento subscribers search --uuid abc-123
bento subscribers search --email user@example.com --tag vip
bento subscribers search --email user@example.com --field plan=pro
```

**Import from CSV** (requires `email` column, bulk operation):
```bash
bento subscribers import contacts.csv --dry-run       # Preview
bento subscribers import contacts.csv --limit 10      # Test batch
bento subscribers import contacts.csv --confirm       # Full import
```

**Upsert** (create or update a subscriber):
```bash
bento subscribers upsert --email user@example.com \
  --fields '{"first_name": "Jane", "plan": "pro"}' \
  --tags "customer,active" \
  --remove-tags "trial"
```

**Tag management** (bulk operation):
```bash
bento subscribers tag --email user@example.com --add vip
bento subscribers tag --email user@example.com --remove trial
bento subscribers tag --file users.csv --add customer,active --confirm
```

**Field management**:
```bash
# Set a field (does NOT trigger automations)
bento subscribers field set --email user@example.com --key plan --value pro

# Update multiple fields (TRIGGERS automations)
bento subscribers field update --email user@example.com \
  --fields '{"plan": "pro", "company": "Acme"}'

# Remove a field
bento subscribers field remove --email user@example.com --key trial_started
```

**Change email**:
```bash
bento subscribers change-email --old old@example.com --new new@example.com
```

**Subscription management** (bulk operations):
```bash
bento subscribers unsubscribe --email user@example.com
bento subscribers unsubscribe --file list.csv --confirm
bento subscribers unsubscribe --email user@example.com --trigger-automations
bento subscribers subscribe --email user@example.com     # Re-subscribe
bento subscribers subscribe --file resubscribes.csv --confirm
```

### Tags

```bash
bento tags list                               # List all tags
bento tags list news                          # Search by name
bento tags create "new-feature"               # Create tag
bento tags delete "old-tag"                   # Delete tag
bento tags delete "old-tag" --confirm         # Skip confirmation
```

### Custom Fields

```bash
bento fields list                             # List all fields
bento fields list company                     # Search by key or name
bento fields create company_size              # Create field
```

### Events

```bash
# Track a single event
bento events track --email user@example.com --event signed_up

# Track with details
bento events track --email user@example.com \
  --event purchase \
  --details '{"product": "Pro Plan", "amount": 99}'

# Import events from JSON file (up to 1000)
bento events import events.json

# Track a purchase (TRIGGERS automations)
bento events purchase \
  --email user@example.com \
  --amount 9900 \
  --currency USD \
  --key "order_123" \
  --cart '{"items": [{"name": "Widget", "price": 9900, "quantity": 1}]}'
```

**Events import JSON format**:
```json
[
  {"email": "user@example.com", "type": "signed_up"},
  {"email": "user@example.com", "type": "purchase", "details": {"amount": 99}}
]
```

### Broadcasts

```bash
bento broadcasts list                         # List all
bento broadcasts list --page 1 --per-page 10  # Paginate

bento broadcasts create \
  --name "January Newsletter" \
  --subject "What's new this month" \
  --content "<h1>Hello!</h1><p>Here's our update...</p>" \
  --type html \
  --from-name "Team" \
  --from-email "team@example.com" \
  --include-tags "newsletter,active" \
  --exclude-tags "unsubscribed" \
  --batch-size 500
```

Content types: `plain`, `html`, `markdown` (default: `html`).

### Sequences

```bash
bento sequences list                          # List all sequences

# Create an email in a sequence
bento sequences create-email \
  --sequence-id sequence_abc123 \
  --subject "Welcome to Bento" \
  --html "<h1>Hi there</h1>" \
  --delay-interval days \
  --delay-count 7

# Create from an HTML file
bento sequences create-email \
  --sequence-id sequence_abc123 \
  --subject "Day 2 follow-up" \
  --html-file ./emails/day-2.html

# Update an existing sequence email
bento sequences update-email \
  --template-id 12345 \
  --subject "Updated Welcome" \
  --html "<h1>Updated body</h1>"
```

Options for `create-email`: `--inbox-snippet`, `--delay-interval` (minutes/hours/days/months), `--delay-count`, `--editor-choice`, `--cc`, `--bcc`, `--to` (all support Liquid).

### Transactional Emails

```bash
# Send a single email
bento emails send \
  --to user@example.com \
  --from team@example.com \
  --subject "Your receipt" \
  --html-body "<p>Thanks for your purchase!</p>" \
  --personalizations '{"name": "Jane"}'

# Send a batch (up to 100)
bento emails send-batch --file emails.json
```

### Templates

```bash
bento templates get 12345                     # Get template by ID
bento templates update 12345 \
  --subject "New subject" \
  --html "<h1>Updated</h1>"
```

### Workflows

```bash
bento workflows list                          # List all workflows
```

### Forms

```bash
bento forms responses form_abc123             # Get form responses
```

### Statistics

```bash
bento stats site                              # Site-wide statistics
bento stats segment segment_123               # Segment statistics
bento stats report report_456                 # Report statistics
```

### Dashboard

```bash
bento dashboard                               # Open in browser
bento dashboard --profile staging             # Open for specific profile
```

### Skills

```bash
bento skills list                             # List bundled skills
bento skills install                          # Install to all detected agents
bento skills install --agent claude-code      # Install to specific agent
bento skills install --skill bento --force    # Install specific skill, overwrite
```

Supported agents: `claude-code`, `cursor`, `windsurf`, `codex`, `copilot`, `gemini`, `roo`.

### Experimental

These features may change without notice.

```bash
bento experimental validate-email user@example.com \
  --ip "1.2.3.4" --name "Jane" --user-agent "Mozilla/5.0"
bento experimental guess-gender "Jesse"
bento experimental geolocate "8.8.8.8"
bento experimental blacklist --domain example.com
bento experimental blacklist --ip "1.2.3.4"
bento experimental moderate "some text to check"
```

## Safety Flags

Available on bulk operations (`subscribers import`, `tag`, `subscribe`, `unsubscribe`):

| Flag | Purpose |
|---|---|
| `--dry-run` | Preview what would happen without making changes |
| `--limit <n>` | Only process first N items |
| `--sample <n>` | Show N sample items in preview |
| `--confirm` | Skip interactive confirmation (required for scripts) |

## Output Modes

| Flag | Output Type |
|---|---|
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

**For imports** — requires `email` column:

| Column | Description |
|---|---|
| `email` | Required. Subscriber email |
| `name` | Optional. Display name |
| `tags` | Optional. Tags to add (comma/semicolon separated) |
| `remove_tags` | Optional. Tags to remove |
| *(other)* | Custom fields |

```csv
email,name,tags,first_name,plan
alice@example.com,Alice Smith,"customer,active",Alice,pro
bob@example.com,Bob Jones,newsletter,Bob,starter
```

**For tag/subscribe/unsubscribe** — simple email list:
```
email
alice@example.com
bob@example.com
```

Or one email per line (no header).

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments or usage |
| 6 | CSV parsing error |

## Environment Variables

| Variable | Purpose |
|---|---|
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
bento subscribers search --email user@example.com | grep email

# GOOD: Structured JSON output
bento subscribers search --email user@example.com --json | jq '.data[].email'
```

**Confusing field set vs field update**:
```bash
# field set — does NOT trigger automations (silent write)
bento subscribers field set --email user@example.com --key plan --value pro

# field update — TRIGGERS automations (use when you want workflows to fire)
bento subscribers field update --email user@example.com --fields '{"plan": "pro"}'
```

## Common Workflows

### CI/CD: Sync subscribers from database
```bash
#!/bin/bash
psql -c "COPY (SELECT email, name FROM users WHERE active) TO STDOUT CSV HEADER" \
  > /tmp/active-users.csv

npx @bentonow/bento-cli subscribers import /tmp/active-users.csv --confirm --json
```

### GitHub Actions
```yaml
- name: Sync subscribers to Bento
  run: |
    npx @bentonow/bento-cli auth login \
      --publishable-key "${{ secrets.BENTO_PUB_KEY }}" \
      --secret-key "${{ secrets.BENTO_SECRET_KEY }}" \
      --site-uuid "${{ secrets.BENTO_SITE_UUID }}"
    npx @bentonow/bento-cli subscribers import users.csv --confirm --json
```

### Safe import validation
```bash
bento subscribers import contacts.csv --dry-run       # 1. Validate format
bento subscribers import contacts.csv --limit 5       # 2. Test small batch
bento subscribers import contacts.csv --confirm       # 3. Full import
```

## Remember

The Bento CLI gives you direct access to operations that affect real subscribers. Use `--dry-run` and `--limit` liberally. When in doubt, preview first.

For automation, always use `--json` output and `--confirm`. Never parse human-readable table output in scripts.
