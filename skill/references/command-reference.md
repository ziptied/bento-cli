# Bento CLI Command Reference

Complete reference for all Bento CLI commands with options and examples.

## Global Options

These options work with most commands:

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format for scripting |
| `--quiet` | Minimal output (errors only) |
| `--help` | Show help for any command |

## auth

Authentication management commands.

### auth login

Authenticate with Bento API credentials.

```bash
# Interactive (prompts for credentials)
bento auth login

# Non-interactive (all flags required)
bento auth login \
  --publishable-key <key> \
  --secret-key <key> \
  --site-uuid <uuid>

# With custom profile name
bento auth login --profile production \
  --publishable-key <key> \
  --secret-key <key> \
  --site-uuid <uuid>
```

**Options**:
| Option | Description |
|--------|-------------|
| `--publishable-key <key>` | Bento publishable API key |
| `--secret-key <key>` | Bento secret API key |
| `--site-uuid <uuid>` | Bento site UUID |
| `--profile <name>` | Profile name (default: "default") |

### auth status

Show current authentication status.

```bash
bento auth status
bento auth status --json
```

### auth logout

Clear current authentication and remove profile.

```bash
bento auth logout
bento auth logout --json
```

---

## profile

Manage multiple Bento account profiles.

### profile add

Add a new named profile (prompts for credentials).

```bash
bento profile add production
bento profile add staging
```

### profile use

Switch to a different profile.

```bash
bento profile use staging
bento profile use production
```

### profile list

List all configured profiles.

```bash
bento profile list
bento profile list --json
```

### profile remove

Remove a profile.

```bash
bento profile remove staging
```

---

## subscribers

Subscriber management commands.

### subscribers search

Search for subscribers with various filters.

```bash
# By email
bento subscribers search --email user@example.com

# By tag
bento subscribers search --tag vip
bento subscribers search --tag active

# By custom field
bento subscribers search --field plan=pro
bento subscribers search --field company=Acme

# Pagination
bento subscribers search --tag vip --page 2 --per-page 50
```

**Options**:
| Option | Description |
|--------|-------------|
| `--email <email>` | Filter by email address |
| `--tag <tag>` | Filter by tag name |
| `--field <key=value>` | Filter by custom field |
| `--page <n>` | Page number (default: 1) |
| `--per-page <n>` | Results per page (default: 25) |

### subscribers import

Import subscribers from a CSV file.

```bash
# Basic import (interactive confirmation)
bento subscribers import contacts.csv

# Preview without making changes
bento subscribers import contacts.csv --dry-run

# Import first N rows only
bento subscribers import contacts.csv --limit 100

# Non-interactive (for scripts)
bento subscribers import contacts.csv --confirm

# Full workflow
bento subscribers import contacts.csv --dry-run           # 1. Preview
bento subscribers import contacts.csv --limit 10 --confirm # 2. Test batch
bento subscribers import contacts.csv --confirm           # 3. Full import
```

**Options**:
| Option | Description |
|--------|-------------|
| `--dry-run` | Preview without executing |
| `--limit <n>` | Process only first N rows |
| `--sample <n>` | Show N sample rows in preview |
| `--confirm` | Skip interactive confirmation |

**CSV Format**:
- Must have `email` column (case-insensitive)
- Special columns: `name`, `tags`, `remove_tags`
- `tags`/`remove_tags` support comma or semicolon separators
- Other columns become custom fields
- First row is header

```csv
email,name,tags,remove_tags,plan
alice@example.com,Alice Smith,"customer,active",,pro
bob@example.com,Bob Jones,newsletter,trial,starter
```

### subscribers tag

Add or remove tags from subscribers.

```bash
# Single subscriber
bento subscribers tag --email user@example.com --add vip
bento subscribers tag --email user@example.com --remove trial
bento subscribers tag --email user@example.com --add vip,premium --remove trial

# Bulk from CSV
bento subscribers tag --file users.csv --add customer --confirm
bento subscribers tag --file users.csv --add customer,active --dry-run
```

**Options**:
| Option | Description |
|--------|-------------|
| `--email <email>` | Target single subscriber |
| `--file <path>` | CSV file with emails |
| `--add <tags>` | Comma-separated tags to add |
| `--remove <tags>` | Comma-separated tags to remove |
| `--dry-run` | Preview without executing |
| `--confirm` | Skip interactive confirmation |

### subscribers unsubscribe

Unsubscribe subscribers (stop email delivery).

```bash
# Single subscriber
bento subscribers unsubscribe --email user@example.com

# Bulk from CSV
bento subscribers unsubscribe --file unsubscribes.csv --dry-run
bento subscribers unsubscribe --file unsubscribes.csv --confirm
```

**Options**:
| Option | Description |
|--------|-------------|
| `--email <email>` | Target single subscriber |
| `--file <path>` | CSV file with emails |
| `--dry-run` | Preview without executing |
| `--confirm` | Skip interactive confirmation |

### subscribers subscribe

Re-subscribe a previously unsubscribed subscriber.

```bash
bento subscribers subscribe --email user@example.com
```

---

## tags

Tag management commands.

### tags list

List all tags in the account.

```bash
bento tags list
bento tags list --json
```

### tags create

Create a new tag.

```bash
bento tags create "new-feature-announcement"
bento tags create newsletter
bento tags create "customer-tier-gold"
```

### tags delete

Delete a tag.

```bash
bento tags delete "old-tag" --confirm
```

**Note**: Tag deletion may have API limitations. Check the output for details.

---

## fields

Custom field management commands.

### fields list

List all custom fields.

```bash
bento fields list
bento fields list --json
```

### fields create

Create a new custom field.

```bash
bento fields create company_size
bento fields create plan_type
```

---

## events

Event tracking commands.

### events track

Track a custom event for a subscriber.

```bash
# Simple event
bento events track --email user@example.com --event signed_up

# Event with details (JSON)
bento events track \
  --email user@example.com \
  --event purchase \
  --details '{"product": "Pro Plan", "amount": 99}'

# Event with complex details
bento events track \
  --email user@example.com \
  --event order_completed \
  --details '{"order_id": "12345", "items": ["SKU001", "SKU002"], "total": 149.99}'
```

**Options**:
| Option | Description |
|--------|-------------|
| `--email <email>` | Subscriber email (required) |
| `--event <name>` | Event name (required) |
| `--details <json>` | Event details as JSON string |

---

## broadcasts

Broadcast management commands.

### broadcasts list

List all broadcasts.

```bash
bento broadcasts list
bento broadcasts list --json
```

### broadcasts create

Create a new broadcast draft.

```bash
bento broadcasts create \
  --name "January Newsletter" \
  --subject "What's new this month" \
  --content "<h1>Hello!</h1><p>Here's our update...</p>" \
  --type html \
  --include-tags "newsletter,active"
```

**Options**:
| Option | Description |
|--------|-------------|
| `--name <name>` | Broadcast name |
| `--subject <subject>` | Email subject line |
| `--content <html>` | Email content |
| `--type <type>` | Content type (html/text) |
| `--include-tags <tags>` | Comma-separated tags to include |
| `--exclude-tags <tags>` | Comma-separated tags to exclude |

---

## stats

Statistics commands.

### stats site

View site-wide statistics.

```bash
bento stats site
bento stats site --json
```
