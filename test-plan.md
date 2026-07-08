# Bento CLI — Complete Test Plan

> Goal: Run every command with every meaningful option combination. Each entry includes the exact command, expected output shape, and expected error behavior so an automated agent can evaluate pass/fail.

---

## Prerequisites

```bash
# Set env vars for test credentials (replace with real or test values)
export BENTO_TEST_EMAIL="test@example.com"
export BENTO_TEST_TAG="test-tag"
export BENTO_TEST_FIELD="company_name"
```

---

## 0. Global Flags & Edge Cases

### 0.1 Version
```bash
bun run bin/bento --version
```
- **Expected**: Prints version string (e.g. `1.0.0`), exit code 0
- **Validate**: Output matches semver pattern `\d+\.\d+\.\d+`

### 0.2 Help
```bash
bun run bin/bento --help
```
- **Expected**: Lists all top-level commands (`auth`, `profile`, `subscribers`, `tags`, `fields`, `events`, `broadcasts`, `sequences`, `stats`, `emails`, `workflows`, `templates`, `forms`, `experimental`, `dashboard`), exit code 0

### 0.3 --json and --quiet are mutually exclusive
```bash
bun run bin/bento tags list --json --quiet
```
- **Expected**: Error message about mutually exclusive flags, exit code ≠ 0

### 0.4 Unknown command
```bash
bun run bin/bento nonexistent
```
- **Expected**: Error or help output, exit code ≠ 0

---

## 1. Auth

### 1.1 `auth login` — non-interactive with flags
```bash
bun run bin/bento auth login \
  --publishable-key "$BENTO_PUB_KEY" \
  --secret-key "$BENTO_SECRET_KEY" \
  --site-uuid "$BENTO_SITE_UUID"
```
- **Expected (normal)**: Success message containing profile name and site UUID, exit code 0
- **Expected (--json)**: `{ "success": true, "data": { "profile": "default", "siteUuid": "..." } }`

### 1.2 `auth login` — non-interactive missing flags
```bash
bun run bin/bento auth login --publishable-key "pk_only"
```
- **Expected**: Error about missing credentials, exit code 1

### 1.3 `auth login` — invalid credentials
```bash
bun run bin/bento auth login \
  --publishable-key "invalid" \
  --secret-key "invalid" \
  --site-uuid "invalid"
```
- **Expected**: Error about invalid/failed credential validation, exit code 1

### 1.4 `auth login` — with named profile
```bash
bun run bin/bento auth login -p staging \
  --publishable-key "$BENTO_PUB_KEY" \
  --secret-key "$BENTO_SECRET_KEY" \
  --site-uuid "$BENTO_SITE_UUID"
```
- **Expected**: Success message mentioning profile "staging", exit code 0

### 1.5 `auth status` — authenticated
```bash
bun run bin/bento auth status
```
- **Expected (normal)**: Displays Profile, Site UUID, masked keys (`****...`), timestamps
- **Expected (--json)**: `{ "success": true, "data": { "authenticated": true, "profile": "...", "siteUuid": "...", "publishableKey": "****...", "secretKey": "****...", "createdAt": "...", "updatedAt": "..." } }`

### 1.6 `auth status --json`
```bash
bun run bin/bento auth status --json
```
- **Expected**: JSON envelope with `authenticated: true`, masked keys, exit code 0

### 1.7 `auth status --quiet`
```bash
bun run bin/bento auth status --quiet
```
- **Expected**: No output, exit code 0

### 1.8 `auth status` — not authenticated
```bash
# (run after auth logout)
bun run bin/bento auth status
```
- **Expected**: Message indicating not authenticated or no active profile

### 1.9 `auth logout`
```bash
bun run bin/bento auth logout
```
- **Expected (normal)**: Success message about clearing credentials, exit code 0
- **Expected (--json)**: `{ "success": true }`

### 1.10 `auth logout` — already logged out
```bash
bun run bin/bento auth logout
```
- **Expected**: Warning or success (idempotent), exit code 0

---

## 2. Profile

### 2.1 `profile add`
```bash
bun run bin/bento profile add testprofile \
  --publishable-key "$BENTO_PUB_KEY" \
  --secret-key "$BENTO_SECRET_KEY" \
  --site-uuid "$BENTO_SITE_UUID"
```
- **Expected**: Success message with profile name "testprofile", exit code 0

### 2.2 `profile add` — duplicate name
```bash
bun run bin/bento profile add testprofile \
  --publishable-key "$BENTO_PUB_KEY" \
  --secret-key "$BENTO_SECRET_KEY" \
  --site-uuid "$BENTO_SITE_UUID"
```
- **Expected**: Error about profile already existing, exit code 1

### 2.3 `profile list`
```bash
bun run bin/bento profile list
```
- **Expected (normal)**: Table with columns: Current (✓), NAME, SITE UUID, CREATED
- **Expected (--json)**: Array of profile objects with `current` boolean

### 2.4 `profile list --json`
```bash
bun run bin/bento profile list --json
```
- **Expected**: `{ "success": true, "data": [ { "name": "...", "current": true/false, "siteUuid": "...", "created": "..." } ] }`

### 2.5 `profile list --quiet`
```bash
bun run bin/bento profile list --quiet
```
- **Expected**: No output, exit code 0

### 2.6 `profile use`
```bash
bun run bin/bento profile use testprofile
```
- **Expected**: Success message switching to "testprofile", exit code 0

### 2.7 `profile use` — nonexistent
```bash
bun run bin/bento profile use doesnotexist
```
- **Expected**: Error about profile not found, exit code 1

### 2.8 `profile remove` — with confirmation flag
```bash
bun run bin/bento profile remove testprofile --yes
```
- **Expected**: Success message about removing profile, exit code 0

### 2.9 `profile remove` — nonexistent
```bash
bun run bin/bento profile remove doesnotexist --yes
```
- **Expected**: Error about profile not found, exit code 1

### 2.10 `profile remove` — non-interactive without --yes
```bash
echo "" | bun run bin/bento profile remove default
```
- **Expected**: Error about requiring --yes in non-interactive mode, exit code 1

---

## 3. Subscribers

### 3.1 `subscribers search --email`
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL"
```
- **Expected (normal)**: Table with columns: EMAIL, NAME, STATUS, TAGS, FIELDS
- **Expected (--json)**: `{ "success": true, "data": [ { "email": "...", "uuid": "...", "name": "...", "status": "active"|"unsubscribed", "tags": [...], "fields": {...} } ] }`

### 3.2 `subscribers search --email --json`
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL" --json
```
- **Expected**: JSON envelope with subscriber data array, exit code 0

### 3.3 `subscribers search --email --quiet`
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL" --quiet
```
- **Expected**: No output, exit code 0

### 3.4 `subscribers search --uuid`
```bash
bun run bin/bento subscribers search --uuid "some-uuid"
```
- **Expected**: Same table/JSON shape as email search

### 3.5 `subscribers search` — no email or uuid
```bash
bun run bin/bento subscribers search
```
- **Expected**: Error about requiring --email or --uuid, exit code 2

### 3.6 `subscribers search` — with tag filter
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL" --tag "$BENTO_TEST_TAG"
```
- **Expected**: Subscriber shown only if they have the tag; otherwise "No subscribers found"

### 3.7 `subscribers search` — with field filter
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL" --field "company=Acme"
```
- **Expected**: Subscriber shown only if field matches

### 3.8 `subscribers search` — invalid field format
```bash
bun run bin/bento subscribers search --email "$BENTO_TEST_EMAIL" --field "badformat"
```
- **Expected**: Error about field format (must be `key=value`), exit code 2

### 3.9 `subscribers search` — not found
```bash
bun run bin/bento subscribers search --email "nonexistent@example.com"
```
- **Expected**: "No subscribers found" message, exit code 0

### 3.10 `subscribers import` — dry run
```bash
# Create test CSV first
echo 'email,name
import1@test.com,Test User 1
import2@test.com,Test User 2' > /tmp/bento-test-import.csv

bun run bin/bento subscribers import /tmp/bento-test-import.csv --dry-run
```
- **Expected**: Preview of records to import, "Dry run — no changes made" message, exit code 0
- **Validate**: No actual API calls made

### 3.11 `subscribers import --json --dry-run`
```bash
bun run bin/bento subscribers import /tmp/bento-test-import.csv --dry-run --json
```
- **Expected**: `{ "success": true, "data": { ... }, "meta": { "dryRun": true } }`

### 3.12 `subscribers import` — with limit
```bash
bun run bin/bento subscribers import /tmp/bento-test-import.csv --dry-run --limit 1
```
- **Expected**: Preview showing only 1 record

### 3.13 `subscribers import` — with sample
```bash
bun run bin/bento subscribers import /tmp/bento-test-import.csv --dry-run --sample 1
```
- **Expected**: Preview showing 1 sample record

### 3.14 `subscribers import` — file not found
```bash
bun run bin/bento subscribers import /tmp/nonexistent.csv --dry-run
```
- **Expected**: File not found error, exit code 5

### 3.15 `subscribers import` — invalid CSV (no email column)
```bash
echo 'name,age
Test,25' > /tmp/bento-bad-import.csv

bun run bin/bento subscribers import /tmp/bento-bad-import.csv --dry-run
```
- **Expected**: Validation error about missing email column, exit code 6

### 3.16 `subscribers import` — with confirm (actual execution)
```bash
bun run bin/bento subscribers import /tmp/bento-test-import.csv --confirm
```
- **Expected (normal)**: Success message with imported count
- **Expected (--json)**: `{ "success": true, "data": { "imported": 2 } }`

### 3.17 `subscribers tag --add` — single email, dry run
```bash
bun run bin/bento subscribers tag --email "$BENTO_TEST_EMAIL" --add "test-tag-1" --dry-run
```
- **Expected**: Preview of tag addition, no changes made, exit code 0

### 3.18 `subscribers tag --add --remove` — combined
```bash
bun run bin/bento subscribers tag --email "$BENTO_TEST_EMAIL" --add "new-tag" --remove "old-tag" --dry-run
```
- **Expected**: Preview showing both add and remove actions

### 3.19 `subscribers tag` — no tags specified
```bash
bun run bin/bento subscribers tag --email "$BENTO_TEST_EMAIL"
```
- **Expected**: Error about requiring --add or --remove, exit code 2

### 3.20 `subscribers tag` — no email/file specified
```bash
bun run bin/bento subscribers tag --add "some-tag"
```
- **Expected**: Error about requiring --email or --file, exit code 2

### 3.21 `subscribers tag` — from file
```bash
echo 'tag-user1@test.com
tag-user2@test.com' > /tmp/bento-tag-emails.txt

bun run bin/bento subscribers tag --file /tmp/bento-tag-emails.txt --add "bulk-tag" --dry-run
```
- **Expected**: Preview showing 2 subscribers with tag to add

### 3.22 `subscribers tag --json --confirm` (actual execution)
```bash
bun run bin/bento subscribers tag --email "$BENTO_TEST_EMAIL" --add "cli-test-tag" --confirm --json
```
- **Expected**: `{ "success": true, "data": { "updated": 1, "added": ["cli-test-tag"], "removed": [] } }`

### 3.23 `subscribers subscribe` — dry run
```bash
bun run bin/bento subscribers subscribe --email "$BENTO_TEST_EMAIL" --dry-run
```
- **Expected**: Preview of re-subscribe action, exit code 0

### 3.24 `subscribers subscribe` — no email/file
```bash
bun run bin/bento subscribers subscribe
```
- **Expected**: Error about requiring --email or --file, exit code 2

### 3.25 `subscribers subscribe --json --confirm`
```bash
bun run bin/bento subscribers subscribe --email "$BENTO_TEST_EMAIL" --confirm --json
```
- **Expected**: `{ "success": true, "data": { "updated": 1, "action": "subscribe" } }`

### 3.26 `subscribers unsubscribe` — dry run
```bash
bun run bin/bento subscribers unsubscribe --email "$BENTO_TEST_EMAIL" --dry-run
```
- **Expected**: Preview of unsubscribe action, exit code 0

### 3.27 `subscribers unsubscribe` — no email/file
```bash
bun run bin/bento subscribers unsubscribe
```
- **Expected**: Error about requiring --email or --file, exit code 2

### 3.28 `subscribers unsubscribe --json --confirm`
```bash
bun run bin/bento subscribers unsubscribe --email "$BENTO_TEST_EMAIL" --confirm --json
```
- **Expected**: `{ "success": true, "data": { "updated": 1, "action": "unsubscribe" } }`

### 3.29 `subscribers subscribe` — from file with limit
```bash
bun run bin/bento subscribers subscribe --file /tmp/bento-tag-emails.txt --limit 1 --dry-run
```
- **Expected**: Preview showing only 1 subscriber (limited)

### 3.30 `subscribers unsubscribe` — from file with limit
```bash
bun run bin/bento subscribers unsubscribe --file /tmp/bento-tag-emails.txt --limit 1 --dry-run
```
- **Expected**: Preview showing only 1 subscriber (limited)

### 3.31 `subscribers unsubscribe --trigger-automations`
```bash
bun run bin/bento subscribers unsubscribe --email "$BENTO_TEST_EMAIL" --trigger-automations --confirm --json
```
- **Expected**: `{ "success": true, "data": { "updated": 1, "action": "unsubscribe" } }`
- **Note**: Uses `removeSubscriber()` which triggers automations, unlike the default `unsubscribe()`

### 3.32 `subscribers field set`
```bash
bun run bin/bento subscribers field set --email "$BENTO_TEST_EMAIL" --key "company_name" --value "Acme Corp"
```
- **Expected (normal)**: Success message confirming field set
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 3.33 `subscribers field set --json`
```bash
bun run bin/bento subscribers field set --email "$BENTO_TEST_EMAIL" --key "company_name" --value "Acme Corp" --json
```
- **Expected**: JSON envelope with subscriber data, exit code 0

### 3.34 `subscribers field set` — missing required options
```bash
bun run bin/bento subscribers field set --email "$BENTO_TEST_EMAIL"
```
- **Expected**: Error about required --key and --value, exit code 1

### 3.35 `subscribers field remove`
```bash
bun run bin/bento subscribers field remove --email "$BENTO_TEST_EMAIL" --key "company_name"
```
- **Expected (normal)**: Success message confirming field removal
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 3.36 `subscribers field remove --json`
```bash
bun run bin/bento subscribers field remove --email "$BENTO_TEST_EMAIL" --key "company_name" --json
```
- **Expected**: JSON envelope with subscriber data, exit code 0

### 3.37 `subscribers field update` — triggers automations
```bash
bun run bin/bento subscribers field update --email "$BENTO_TEST_EMAIL" --fields '{"company_name": "Acme Corp", "role": "Engineer"}'
```
- **Expected (normal)**: Success message noting automations triggered
- **Expected (--json)**: `{ "success": true, "data": { "email": "...", "fields": { ... } }, "meta": { "count": 1 } }`

### 3.38 `subscribers field update` — invalid JSON
```bash
bun run bin/bento subscribers field update --email "$BENTO_TEST_EMAIL" --fields "not json"
```
- **Expected**: Error about invalid JSON, exit code 1

### 3.39 `subscribers field update --json`
```bash
bun run bin/bento subscribers field update --email "$BENTO_TEST_EMAIL" --fields '{"name": "Test"}' --json
```
- **Expected**: JSON envelope with success, exit code 0

### 3.40 `subscribers change-email`
```bash
bun run bin/bento subscribers change-email --old "old@example.com" --new "new@example.com"
```
- **Expected (normal)**: Success message confirming email change
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 3.41 `subscribers change-email --json`
```bash
bun run bin/bento subscribers change-email --old "old@example.com" --new "new@example.com" --json
```
- **Expected**: JSON envelope with subscriber data, exit code 0

### 3.42 `subscribers change-email` — missing required options
```bash
bun run bin/bento subscribers change-email --old "old@example.com"
```
- **Expected**: Error about required --new, exit code 1

### 3.43 `subscribers upsert` — basic
```bash
bun run bin/bento subscribers upsert --email "$BENTO_TEST_EMAIL"
```
- **Expected (normal)**: Success message confirming upsert
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 3.44 `subscribers upsert` — with fields and tags
```bash
bun run bin/bento subscribers upsert --email "$BENTO_TEST_EMAIL" \
  --fields '{"name": "Test User", "company": "Acme"}' \
  --tags "vip,active" \
  --remove-tags "churned"
```
- **Expected (normal)**: Success message
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 3.45 `subscribers upsert --json`
```bash
bun run bin/bento subscribers upsert --email "$BENTO_TEST_EMAIL" --json
```
- **Expected**: JSON envelope with subscriber data, exit code 0

### 3.46 `subscribers upsert` — invalid fields JSON
```bash
bun run bin/bento subscribers upsert --email "$BENTO_TEST_EMAIL" --fields "not json"
```
- **Expected**: Error about invalid JSON, exit code 1

### 3.47 `subscribers upsert` — missing email
```bash
bun run bin/bento subscribers upsert
```
- **Expected**: Error about required --email, exit code 1

---

## 4. Tags

### 4.1 `tags list`
```bash
bun run bin/bento tags list
```
- **Expected (normal)**: Table with columns: NAME, ID, CREATED
- **Expected**: If no tags, info message about creating tags

### 4.2 `tags list --json`
```bash
bun run bin/bento tags list --json
```
- **Expected**: `{ "success": true, "data": [ { "name": "...", "id": "...", "createdAt": "..." } ], "meta": { "count": N } }`

### 4.3 `tags list --quiet`
```bash
bun run bin/bento tags list --quiet
```
- **Expected**: No output, exit code 0

### 4.4 `tags list` — with search filter
```bash
bun run bin/bento tags list "test"
```
- **Expected**: Only tags containing "test" (case-insensitive), metadata shows `total` count of all tags

### 4.5 `tags list` — search with no matches
```bash
bun run bin/bento tags list "zzz_nonexistent_zzz"
```
- **Expected**: Empty result or "no tags found" message

### 4.6 `tags create`
```bash
bun run bin/bento tags create "cli-integration-test"
```
- **Expected (normal)**: Success message with tag name
- **Expected (--json)**: `{ "success": true, "data": { "name": "cli-integration-test" } }`

### 4.7 `tags create --json`
```bash
bun run bin/bento tags create "cli-json-test" --json
```
- **Expected**: JSON envelope with success and tag data

### 4.8 `tags create` — empty name
```bash
bun run bin/bento tags create ""
```
- **Expected**: Error about empty tag name, exit code 1

---

## 5. Fields

### 5.1 `fields list`
```bash
bun run bin/bento fields list
```
- **Expected (normal)**: Table with columns: KEY, NAME, ID, CREATED
- **Expected**: If no fields, info message about creating fields

### 5.2 `fields list --json`
```bash
bun run bin/bento fields list --json
```
- **Expected**: `{ "success": true, "data": [ { "key": "...", "name": "...", "id": "...", "createdAt": "..." } ], "meta": { "count": N } }`

### 5.3 `fields list --quiet`
```bash
bun run bin/bento fields list --quiet
```
- **Expected**: No output, exit code 0

### 5.4 `fields list` — with search filter
```bash
bun run bin/bento fields list "company"
```
- **Expected**: Only fields matching "company" in key or name

### 5.5 `fields create` — valid key
```bash
bun run bin/bento fields create "test_field_cli"
```
- **Expected (normal)**: Success message with field key
- **Expected (--json)**: `{ "success": true, "data": { "key": "test_field_cli" } }`

### 5.6 `fields create --json`
```bash
bun run bin/bento fields create "test_field_json" --json
```
- **Expected**: JSON envelope with success

### 5.7 `fields create` — empty key
```bash
bun run bin/bento fields create ""
```
- **Expected**: Error about empty key, exit code 1

### 5.8 `fields create` — invalid key format (starts with number)
```bash
bun run bin/bento fields create "123invalid"
```
- **Expected**: Error about invalid key format (must start with letter, alphanumeric + underscore only), exit code 1

### 5.9 `fields create` — invalid key with special chars
```bash
bun run bin/bento fields create "has-dashes"
```
- **Expected**: Error about invalid key format, exit code 1

### 5.10 `fields create` — invalid key with spaces
```bash
bun run bin/bento fields create "has spaces"
```
- **Expected**: Error about invalid key format, exit code 1

---

## 6. Events

### 6.1 `events track` — basic
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL" --event "cli_test_event"
```
- **Expected (normal)**: Success message with event name and email
- **Expected (--json)**: `{ "success": true, "data": { "email": "...", "event": "cli_test_event" } }`

### 6.2 `events track --json`
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL" --event "cli_test_json" --json
```
- **Expected**: JSON envelope with success, email, event name

### 6.3 `events track` — with valid JSON details
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL" --event "purchase" --details '{"product": "widget", "amount": 29.99}'
```
- **Expected (normal)**: Success message + info about details
- **Expected (--json)**: `{ "success": true, "data": { "email": "...", "event": "purchase", "details": { "product": "widget", "amount": 29.99 } } }`

### 6.4 `events track` — invalid JSON details
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL" --event "test" --details "not json"
```
- **Expected**: Error about invalid JSON, exit code 1

### 6.5 `events track` — missing email
```bash
bun run bin/bento events track --event "test"
```
- **Expected**: Error about required --email, exit code 1

### 6.6 `events track` — missing event name
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL"
```
- **Expected**: Error about required --event, exit code 1

### 6.7 `events track --quiet`
```bash
bun run bin/bento events track --email "$BENTO_TEST_EMAIL" --event "quiet_test" --quiet
```
- **Expected**: No output, exit code 0

### 6.8 `events import` — from JSON file
```bash
# Create test events file
cat > /tmp/bento-test-events.json << 'EOF'
[
  {"email": "user1@test.com", "type": "page_viewed", "details": {"page": "/pricing"}},
  {"email": "user2@test.com", "type": "button_clicked", "details": {"button": "signup"}}
]
EOF

bun run bin/bento events import /tmp/bento-test-events.json
```
- **Expected (normal)**: Success message with imported count
- **Expected (--json)**: `{ "success": true, "data": { "imported": 2 }, "meta": { "count": 2 } }`

### 6.9 `events import --json`
```bash
bun run bin/bento events import /tmp/bento-test-events.json --json
```
- **Expected**: JSON envelope with imported count, exit code 0

### 6.10 `events import` — file not found
```bash
bun run bin/bento events import /tmp/nonexistent-events.json
```
- **Expected**: Error about failed to read or parse file, exit code 1

### 6.11 `events import` — invalid JSON file
```bash
echo "not json" > /tmp/bento-bad-events.json
bun run bin/bento events import /tmp/bento-bad-events.json
```
- **Expected**: Error about failed to read or parse file, exit code 1

### 6.12 `events import` — empty array
```bash
echo "[]" > /tmp/bento-empty-events.json
bun run bin/bento events import /tmp/bento-empty-events.json
```
- **Expected**: Error about non-empty array required, exit code 1

### 6.13 `events purchase` — basic
```bash
bun run bin/bento events purchase \
  --email "$BENTO_TEST_EMAIL" \
  --amount 2999 \
  --currency USD \
  --key "order_12345"
```
- **Expected (normal)**: Success message with amount, currency, and email
- **Expected (--json)**: `{ "success": true, "data": { "email": "...", "amount": 2999, "currency": "USD", "key": "order_12345" }, "meta": { "count": 1 } }`

### 6.14 `events purchase --json`
```bash
bun run bin/bento events purchase \
  --email "$BENTO_TEST_EMAIL" \
  --amount 2999 \
  --currency USD \
  --key "order_12345" \
  --json
```
- **Expected**: JSON envelope with purchase data, exit code 0

### 6.15 `events purchase` — with cart
```bash
bun run bin/bento events purchase \
  --email "$BENTO_TEST_EMAIL" \
  --amount 5998 \
  --currency USD \
  --key "order_12346" \
  --cart '{"items": [{"product_name": "Widget", "quantity": 2, "product_price": 2999}]}'
```
- **Expected**: Success message, exit code 0

### 6.16 `events purchase` — invalid cart JSON
```bash
bun run bin/bento events purchase \
  --email "$BENTO_TEST_EMAIL" \
  --amount 2999 \
  --currency USD \
  --key "order_bad" \
  --cart "not json"
```
- **Expected**: Error about invalid JSON in --cart, exit code 1

### 6.17 `events purchase` — invalid amount
```bash
bun run bin/bento events purchase \
  --email "$BENTO_TEST_EMAIL" \
  --amount "abc" \
  --currency USD \
  --key "order_nan"
```
- **Expected**: Error about --amount must be a number, exit code 1

### 6.18 `events purchase` — missing required options
```bash
bun run bin/bento events purchase --email "$BENTO_TEST_EMAIL"
```
- **Expected**: Error about required --amount, --currency, --key, exit code 1

---

## 7. Broadcasts

### 7.1 `broadcasts list`
```bash
bun run bin/bento broadcasts list
```
- **Expected (normal)**: Table with columns: NAME, SUBJECT, SENT, OPENS, CLICKS, CREATED
- **Expected**: If no broadcasts, "No broadcasts found" message

### 7.2 `broadcasts list --json`
```bash
bun run bin/bento broadcasts list --json
```
- **Expected**: `{ "success": true, "data": [ { "name": "...", "subject": "...", "recipients": N, "opens": N, "clicks": N, "created": "..." } ], "meta": { "count": N } }`

### 7.3 `broadcasts list --quiet`
```bash
bun run bin/bento broadcasts list --quiet
```
- **Expected**: No output, exit code 0

### 7.4 `broadcasts list` — paginated
```bash
bun run bin/bento broadcasts list --page 1 --per-page 5
```
- **Expected**: Table with at most 5 rows
- **Expected (--json)**: meta contains `page`, `pageSize`, `hasMore`, `total`

### 7.5 `broadcasts list` — per-page only
```bash
bun run bin/bento broadcasts list --per-page 2
```
- **Expected**: First page with 2 results

### 7.6 `broadcasts create` — minimal required
```bash
bun run bin/bento broadcasts create --name "CLI Test Broadcast" --subject "Test Subject"
```
- **Expected (normal)**: Success message with broadcast name
- **Expected (--json)**: `{ "success": true, "data": { ... } }`

### 7.7 `broadcasts create --json`
```bash
bun run bin/bento broadcasts create --name "CLI JSON Broadcast" --subject "JSON Subject" --json
```
- **Expected**: JSON envelope with success and broadcast object

### 7.8 `broadcasts create` — full options
```bash
bun run bin/bento broadcasts create \
  --name "Full Test Broadcast" \
  --subject "Full Subject" \
  --content "<h1>Hello</h1>" \
  --type html \
  --from-name "Test Sender" \
  --from-email "sender@test.com" \
  --include-tags "vip,active" \
  --exclude-tags "unsubscribed" \
  --batch-size 500
```
- **Expected**: Success message, exit code 0

### 7.9 `broadcasts create` — missing name
```bash
bun run bin/bento broadcasts create --subject "No Name"
```
- **Expected**: Error about required --name, exit code 1

### 7.10 `broadcasts create` — missing subject
```bash
bun run bin/bento broadcasts create --name "No Subject"
```
- **Expected**: Error about required --subject, exit code 1

### 7.11 `broadcasts create` — invalid type
```bash
bun run bin/bento broadcasts create --name "Bad Type" --subject "Test" --type "invalid"
```
- **Expected**: Error about invalid type (must be plain/html/markdown), exit code 1

### 7.12 `broadcasts create` — markdown type
```bash
bun run bin/bento broadcasts create --name "MD Broadcast" --subject "MD Test" --content "# Hello" --type markdown
```
- **Expected**: Success, exit code 0

### 7.13 `broadcasts create` — plain type
```bash
bun run bin/bento broadcasts create --name "Plain Broadcast" --subject "Plain Test" --content "Hello plain" --type plain
```
- **Expected**: Success, exit code 0

---

## 8. Sequences

### 8.1 `sequences list`
```bash
bun run bin/bento sequences list
```
- **Expected (normal)**: Table with columns: ID, NAME, EMAILS, CREATED
- **Expected**: If no sequences, "No sequences found" message

### 8.2 `sequences list --json`
```bash
bun run bin/bento sequences list --json
```
- **Expected**: `{ "success": true, "data": [ { "id": "...", "name": "...", "emails": N, "created": "..." } ], "meta": { "count": N } }`

### 8.3 `sequences list --quiet`
```bash
bun run bin/bento sequences list --quiet
```
- **Expected**: No output, exit code 0

### 8.4 `sequences email create` — minimal
```bash
bun run bin/bento sequences email create "<sequence-id>" \
  --subject "Welcome Email" \
  --html "<h1>Welcome!</h1>"
```
- **Expected (normal)**: Success message with subject line and email ID
- **Expected (--json)**: `{ "success": true, "data": { "subject": "Welcome Email", "id": "..." } }`
- **Note**: Replace `<sequence-id>` with a real ID from `sequences list`

### 8.5 `sequences email create --json`
```bash
bun run bin/bento sequences email create "<sequence-id>" \
  --subject "JSON Email" \
  --html "<p>Test</p>" \
  --json
```
- **Expected**: JSON envelope with success and email template object

### 8.6 `sequences email create` — full options
```bash
bun run bin/bento sequences email create "<sequence-id>" \
  --subject "Full Email" \
  --html "<p>Full test</p>" \
  --delay-interval days \
  --delay-count 3 \
  --snippet "Preview text here" \
  --cc "cc@test.com" \
  --bcc "bcc@test.com"
```
- **Expected**: Success, exit code 0

### 8.7 `sequences email create` — missing subject
```bash
bun run bin/bento sequences email create "<sequence-id>" --html "<p>No subject</p>"
```
- **Expected**: Error about required --subject, exit code 1

### 8.8 `sequences email create` — missing html
```bash
bun run bin/bento sequences email create "<sequence-id>" --subject "No HTML"
```
- **Expected**: Error about required --html, exit code 1

### 8.9 `sequences email create` — invalid delay interval
```bash
bun run bin/bento sequences email create "<sequence-id>" \
  --subject "Bad Delay" \
  --html "<p>Test</p>" \
  --delay-interval "weeks"
```
- **Expected**: Error about invalid delay interval (must be minutes/hours/days/months), exit code 2

### 8.10 `sequences email create` — delay count without interval
```bash
bun run bin/bento sequences email create "<sequence-id>" \
  --subject "Count Only" \
  --html "<p>Test</p>" \
  --delay-count 5
```
- **Expected**: Error about requiring --delay-interval with --delay-count, exit code 2

---

## 9. Stats

### 9.1 `stats site`
```bash
bun run bin/bento stats site
```
- **Expected (normal)**: Formatted display with:
  - Subscriber Metrics: Total Subscribers, Active Subscribers, Unsubscribed
  - Broadcast Metrics: Total Broadcasts, Avg. Open Rate, Avg. Click Rate
  - Numbers formatted with thousand separators, percentages with 1 decimal

### 9.2 `stats site --json`
```bash
bun run bin/bento stats site --json
```
- **Expected**: `{ "success": true, "data": { "total_subscribers": N, "active_subscribers": N, "unsubscribed_count": N, "broadcast_count": N, "average_open_rate": N, "average_click_rate": N } }`

### 9.3 `stats site --quiet`
```bash
bun run bin/bento stats site --quiet
```
- **Expected**: No output, exit code 0

### 9.4 `stats segment`
```bash
bun run bin/bento stats segment "<segment-id>"
```
- **Expected (normal)**: Key-value display of segment statistics
- **Expected (--json)**: `{ "success": true, "data": { "segment_id": "...", "subscriber_count": N, ... }, "meta": { "count": 1 } }`
- **Note**: Replace `<segment-id>` with a real segment ID

### 9.5 `stats segment --json`
```bash
bun run bin/bento stats segment "<segment-id>" --json
```
- **Expected**: JSON envelope with segment stats, exit code 0

### 9.6 `stats segment --quiet`
```bash
bun run bin/bento stats segment "<segment-id>" --quiet
```
- **Expected**: No output, exit code 0

### 9.7 `stats segment` — missing argument
```bash
bun run bin/bento stats segment
```
- **Expected**: Error about missing segment-id argument, exit code 1

### 9.8 `stats report`
```bash
bun run bin/bento stats report "<report-id>"
```
- **Expected (normal)**: Key-value display of report statistics (total_sent, opens, clicks, etc.)
- **Expected (--json)**: `{ "success": true, "data": { "report_id": "...", "total_sent": N, "total_opens": N, ... }, "meta": { "count": 1 } }`
- **Note**: Replace `<report-id>` with a real report ID

### 9.9 `stats report --json`
```bash
bun run bin/bento stats report "<report-id>" --json
```
- **Expected**: JSON envelope with report stats, exit code 0

### 9.10 `stats report --quiet`
```bash
bun run bin/bento stats report "<report-id>" --quiet
```
- **Expected**: No output, exit code 0

### 9.11 `stats report` — missing argument
```bash
bun run bin/bento stats report
```
- **Expected**: Error about missing report-id argument, exit code 1

---

## 10. Dashboard

### 10.1 `dashboard` — authenticated
```bash
bun run bin/bento dashboard
```
- **Expected**: Opens browser to Bento dashboard URL with site UUID, success message, exit code 0
- **Note**: Browser open may need to be mocked in automated testing

### 10.2 `dashboard --json`
```bash
bun run bin/bento dashboard --json
```
- **Expected**: `{ "success": true, "data": { "url": "https://app.bentonow.com/...", "profile": "...", "siteUuid": "..." } }`

### 10.3 `dashboard -p <profile>`
```bash
bun run bin/bento dashboard -p staging
```
- **Expected**: Opens dashboard for the "staging" profile's site UUID

### 10.4 `dashboard -p <nonexistent>`
```bash
bun run bin/bento dashboard -p doesnotexist
```
- **Expected**: Error about profile not found, exit code 1

### 10.5 `dashboard` — not authenticated
```bash
# (after auth logout)
bun run bin/bento dashboard
```
- **Expected**: Falls back to login page URL or shows auth required message

---

## 11. Emails (Transactional)

### 11.1 `emails send` — basic
```bash
bun run bin/bento emails send \
  --to "recipient@example.com" \
  --from "sender@example.com" \
  --subject "Test Transactional" \
  --html-body "<h1>Hello</h1><p>This is a test.</p>"
```
- **Expected (normal)**: Success message confirming email sent
- **Expected (--json)**: `{ "success": true, "data": { "queued": 1 }, "meta": { "count": 1 } }`

### 11.2 `emails send --json`
```bash
bun run bin/bento emails send \
  --to "recipient@example.com" \
  --from "sender@example.com" \
  --subject "JSON Test" \
  --html-body "<p>Test</p>" \
  --json
```
- **Expected**: JSON envelope with queued count, exit code 0

### 11.3 `emails send` — with personalizations
```bash
bun run bin/bento emails send \
  --to "recipient@example.com" \
  --from "sender@example.com" \
  --subject "Personalized Email" \
  --html-body "<p>Hello {{ name }}!</p>" \
  --personalizations '{"name": "John", "discount": 20}'
```
- **Expected**: Success message, exit code 0

### 11.4 `emails send` — invalid personalizations JSON
```bash
bun run bin/bento emails send \
  --to "recipient@example.com" \
  --from "sender@example.com" \
  --subject "Test" \
  --html-body "<p>Test</p>" \
  --personalizations "not json"
```
- **Expected**: Error about invalid JSON in --personalizations, exit code 1

### 11.5 `emails send` — missing required options
```bash
bun run bin/bento emails send --to "recipient@example.com"
```
- **Expected**: Error about required --from, --subject, --html-body, exit code 1

### 11.6 `emails send-batch` — from JSON file
```bash
cat > /tmp/bento-test-emails.json << 'EOF'
[
  {"to": "user1@test.com", "from": "sender@test.com", "subject": "Hello 1", "html_body": "<p>Hi 1</p>"},
  {"to": "user2@test.com", "from": "sender@test.com", "subject": "Hello 2", "html_body": "<p>Hi 2</p>"}
]
EOF

bun run bin/bento emails send-batch --file /tmp/bento-test-emails.json
```
- **Expected (normal)**: Success message with queued count
- **Expected (--json)**: `{ "success": true, "data": { "queued": 2 }, "meta": { "count": 2 } }`

### 11.7 `emails send-batch --json`
```bash
bun run bin/bento emails send-batch --file /tmp/bento-test-emails.json --json
```
- **Expected**: JSON envelope with queued count, exit code 0

### 11.8 `emails send-batch` — file not found
```bash
bun run bin/bento emails send-batch --file /tmp/nonexistent-emails.json
```
- **Expected**: Error about failed to read or parse file, exit code 1

### 11.9 `emails send-batch` — empty array
```bash
echo "[]" > /tmp/bento-empty-emails.json
bun run bin/bento emails send-batch --file /tmp/bento-empty-emails.json
```
- **Expected**: Error about non-empty array required, exit code 1

### 11.10 `emails send-batch` — exceeds 100 limit
```bash
# Create a file with 101 email objects
python3 -c "import json; print(json.dumps([{'to':f'u{i}@t.com','from':'s@t.com','subject':'S','html_body':'<p>B</p>'} for i in range(101)]))" > /tmp/bento-too-many-emails.json
bun run bin/bento emails send-batch --file /tmp/bento-too-many-emails.json
```
- **Expected**: Error about batch limit of 100, exit code 1

---

## 12. Workflows

### 12.1 `workflows list`
```bash
bun run bin/bento workflows list
```
- **Expected (normal)**: Table with columns: ID, Name, Created, Templates
- **Expected**: If no workflows, "No workflows found" message

### 12.2 `workflows list --json`
```bash
bun run bin/bento workflows list --json
```
- **Expected**: `{ "success": true, "data": [ { "id": "...", "type": "...", "attributes": { "name": "...", "created_at": "...", "email_templates": [...] } } ], "meta": { "count": N } }`

### 12.3 `workflows list --quiet`
```bash
bun run bin/bento workflows list --quiet
```
- **Expected**: No output, exit code 0

---

## 13. Templates

### 13.1 `templates get`
```bash
bun run bin/bento templates get "<template-id>"
```
- **Expected (normal)**: Key-value display of email template properties
- **Expected (--json)**: `{ "success": true, "data": { "id": "...", ... }, "meta": { "count": 1 } }`
- **Note**: Replace `<template-id>` with a real template ID

### 13.2 `templates get --json`
```bash
bun run bin/bento templates get "<template-id>" --json
```
- **Expected**: JSON envelope with template data, exit code 0

### 13.3 `templates get` — not found
```bash
bun run bin/bento templates get "nonexistent-id"
```
- **Expected**: Error about template not found, exit code 1

### 13.4 `templates get` — missing argument
```bash
bun run bin/bento templates get
```
- **Expected**: Error about missing id argument, exit code 1

### 13.5 `templates update` — subject only
```bash
bun run bin/bento templates update "<template-id>" --subject "New Subject Line"
```
- **Expected (normal)**: Success message confirming update
- **Expected (--json)**: `{ "success": true, "data": { ... }, "meta": { "count": 1 } }`

### 13.6 `templates update` — html only
```bash
bun run bin/bento templates update "<template-id>" --html "<h1>Updated Content</h1>"
```
- **Expected**: Success message, exit code 0

### 13.7 `templates update` — both subject and html
```bash
bun run bin/bento templates update "<template-id>" --subject "Updated" --html "<p>New body</p>"
```
- **Expected**: Success message, exit code 0

### 13.8 `templates update --json`
```bash
bun run bin/bento templates update "<template-id>" --subject "JSON Update" --json
```
- **Expected**: JSON envelope with updated template data, exit code 0

### 13.9 `templates update` — no options
```bash
bun run bin/bento templates update "<template-id>"
```
- **Expected**: Error about providing at least --subject or --html, exit code 1

### 13.10 `templates update` — missing argument
```bash
bun run bin/bento templates update
```
- **Expected**: Error about missing id argument, exit code 1

---

## 14. Forms

### 14.1 `forms responses`
```bash
bun run bin/bento forms responses "<form-id>"
```
- **Expected (normal)**: Table with columns: ID, UUID, Type, Date, IP
- **Expected**: If no responses, "No responses found for this form" message
- **Note**: Replace `<form-id>` with a real form identifier

### 14.2 `forms responses --json`
```bash
bun run bin/bento forms responses "<form-id>" --json
```
- **Expected**: `{ "success": true, "data": [ { "id": "...", "type": "...", "attributes": { "uuid": "...", "data": { ... } } } ], "meta": { "count": N } }`

### 14.3 `forms responses --quiet`
```bash
bun run bin/bento forms responses "<form-id>" --quiet
```
- **Expected**: No output, exit code 0

### 14.4 `forms responses` — missing argument
```bash
bun run bin/bento forms responses
```
- **Expected**: Error about missing form-id argument, exit code 1

---

## 15. Experimental

### 15.1 `experimental validate-email`
```bash
bun run bin/bento experimental validate-email "user@example.com"
```
- **Expected (normal)**: Success/warning message about email validity
- **Expected (--json)**: `{ "success": true, "data": { "email": "user@example.com", "valid": true|false }, "meta": { "count": 1 } }`

### 15.2 `experimental validate-email --json`
```bash
bun run bin/bento experimental validate-email "user@example.com" --json
```
- **Expected**: JSON envelope with email and valid boolean, exit code 0

### 15.3 `experimental validate-email` — with optional flags
```bash
bun run bin/bento experimental validate-email "user@example.com" \
  --ip "1.2.3.4" \
  --name "John Doe" \
  --user-agent "Mozilla/5.0"
```
- **Expected**: Success/warning message, exit code 0

### 15.4 `experimental validate-email` — missing argument
```bash
bun run bin/bento experimental validate-email
```
- **Expected**: Error about missing email argument, exit code 1

### 15.5 `experimental guess-gender`
```bash
bun run bin/bento experimental guess-gender "Alice"
```
- **Expected (normal)**: Key-value display: Name, Gender, Confidence (percentage)
- **Expected (--json)**: `{ "success": true, "data": { "confidence": N|null, "gender": "female"|"male"|null }, "meta": { "count": 1 } }`

### 15.6 `experimental guess-gender --json`
```bash
bun run bin/bento experimental guess-gender "Bob" --json
```
- **Expected**: JSON envelope with gender and confidence, exit code 0

### 15.7 `experimental guess-gender` — missing argument
```bash
bun run bin/bento experimental guess-gender
```
- **Expected**: Error about missing name argument, exit code 1

### 15.8 `experimental geolocate`
```bash
bun run bin/bento experimental geolocate "8.8.8.8"
```
- **Expected (normal)**: Key-value display of location data (city, country, lat/lng, etc.)
- **Expected (--json)**: `{ "success": true, "data": { "city_name": "...", "country_name": "...", "latitude": N, "longitude": N, ... }, "meta": { "count": 1 } }`

### 15.9 `experimental geolocate --json`
```bash
bun run bin/bento experimental geolocate "8.8.8.8" --json
```
- **Expected**: JSON envelope with location data, exit code 0

### 15.10 `experimental geolocate` — missing argument
```bash
bun run bin/bento experimental geolocate
```
- **Expected**: Error about missing ip argument, exit code 1

### 15.11 `experimental blacklist` — by domain
```bash
bun run bin/bento experimental blacklist --domain "example.com"
```
- **Expected (normal)**: Key-value display: Query, Description, Results
- **Expected (--json)**: `{ "success": true, "data": { "description": "...", "query": "example.com", "results": { ... } }, "meta": { "count": 1 } }`

### 15.12 `experimental blacklist` — by IP
```bash
bun run bin/bento experimental blacklist --ip "1.2.3.4"
```
- **Expected**: Same shape as domain check, exit code 0

### 15.13 `experimental blacklist --json`
```bash
bun run bin/bento experimental blacklist --domain "example.com" --json
```
- **Expected**: JSON envelope with blacklist results, exit code 0

### 15.14 `experimental blacklist` — no domain or IP
```bash
bun run bin/bento experimental blacklist
```
- **Expected**: Error about providing --domain or --ip, exit code 1

### 15.15 `experimental moderate`
```bash
bun run bin/bento experimental moderate "This is a normal marketing email about our product."
```
- **Expected (normal)**: Success message "Content passed moderation" with category breakdown
- **Expected (--json)**: `{ "success": true, "data": { "flagged": false, "categories": { "hate": false, ... }, "category_scores": { "hate": N, ... } }, "meta": { "count": 1 } }`

### 15.16 `experimental moderate --json`
```bash
bun run bin/bento experimental moderate "Hello world" --json
```
- **Expected**: JSON envelope with moderation result, exit code 0

### 15.17 `experimental moderate` — missing argument
```bash
bun run bin/bento experimental moderate
```
- **Expected**: Error about missing content argument, exit code 1

---

## 16. Unauthenticated Error Handling

All data commands should fail gracefully when not authenticated.

### 16.1 `tags list` — no auth
```bash
bun run bin/bento auth logout && bun run bin/bento tags list
```
- **Expected**: Authentication error, exit code 3

### 16.2 `subscribers search` — no auth
```bash
bun run bin/bento subscribers search --email "test@test.com"
```
- **Expected**: Authentication error, exit code 3

### 16.3 `fields list` — no auth
```bash
bun run bin/bento fields list
```
- **Expected**: Authentication error, exit code 3

### 16.4 `broadcasts list` — no auth
```bash
bun run bin/bento broadcasts list
```
- **Expected**: Authentication error, exit code 3

### 16.5 `stats site` — no auth
```bash
bun run bin/bento stats site
```
- **Expected**: Authentication error, exit code 3

### 16.6 `events track` — no auth
```bash
bun run bin/bento events track --email "test@test.com" --event "test"
```
- **Expected**: Authentication error, exit code 3

### 16.7 `sequences list` — no auth
```bash
bun run bin/bento sequences list
```
- **Expected**: Authentication error, exit code 3

### 16.8 `emails send` — no auth
```bash
bun run bin/bento emails send --to "t@t.com" --from "s@t.com" --subject "T" --html-body "<p>T</p>"
```
- **Expected**: Authentication error, exit code 3

### 16.9 `workflows list` — no auth
```bash
bun run bin/bento workflows list
```
- **Expected**: Authentication error, exit code 3

### 16.10 `templates get` — no auth
```bash
bun run bin/bento templates get "some-id"
```
- **Expected**: Authentication error, exit code 3

### 16.11 `forms responses` — no auth
```bash
bun run bin/bento forms responses "some-form-id"
```
- **Expected**: Authentication error, exit code 3

### 16.12 `experimental validate-email` — no auth
```bash
bun run bin/bento experimental validate-email "test@test.com"
```
- **Expected**: Authentication error, exit code 3

### 16.13 `subscribers upsert` — no auth
```bash
bun run bin/bento subscribers upsert --email "test@test.com"
```
- **Expected**: Authentication error, exit code 3

### 16.14 `events purchase` — no auth
```bash
bun run bin/bento events purchase --email "t@t.com" --amount 100 --currency USD --key "k1"
```
- **Expected**: Authentication error, exit code 3

---

## Exit Code Reference

| Code | Meaning | How to validate |
|------|---------|-----------------|
| 0 | Success | `$?` equals 0 |
| 1 | General error | Validation failures, auth errors |
| 2 | CLI argument error | Missing/invalid options |
| 3 | Auth required | No active profile or invalid credentials |
| 4 | API error | Rate limit, timeout, not found |
| 5 | File I/O error | File not found, read permission |
| 6 | Data validation error | Bad CSV format, invalid data |

---

## JSON Envelope Shape (all --json responses)

```json
{
  "success": true | false,
  "error": null | "error message string",
  "data": "<command-specific data>",
  "meta": {
    "count": 0,
    "total": 0,
    "page": 1,
    "pageSize": 25,
    "hasMore": false,
    "code": 0,
    "hint": "optional hint string"
  }
}
```

---

## Evaluation Criteria

For each command, the automated agent should check:

1. **Exit code**: Matches expected value (0 for success, specific code for errors)
2. **Output format**: Normal mode shows human-readable text; `--json` returns valid parseable JSON matching the envelope shape; `--quiet` produces no stdout
3. **Data shape**: JSON responses contain the expected keys and value types
4. **Error messages**: Errors are descriptive, mention the problem, and never show raw stack traces
5. **Idempotency**: Commands that should be idempotent (logout, list) don't fail on repeat runs
6. **Safety flags**: `--dry-run` never modifies data; `--limit` caps operation count; `--confirm` skips prompts

---

## Suggested Test Execution Order

Run in this order to manage state (auth, profiles, test data):

1. **0.x** — Global flags (version, help, mutual exclusion)
2. **1.1–1.4** — Auth login (establish credentials)
3. **1.5–1.7** — Auth status (verify login worked)
4. **2.1–2.6** — Profile CRUD (add, list, use)
5. **4.1–4.8** — Tags (list, create, search)
6. **5.1–5.10** — Fields (list, create, validation)
7. **3.1–3.9** — Subscribers search
8. **3.10–3.16** — Subscribers import (dry-run first, then actual)
9. **3.17–3.22** — Subscribers tag
10. **3.23–3.31** — Subscribers subscribe/unsubscribe (use dry-run to avoid side effects)
11. **3.32–3.39** — Subscribers field management (set, remove, update)
12. **3.40–3.42** — Subscribers change-email
13. **3.43–3.47** — Subscribers upsert
14. **6.1–6.7** — Events track
15. **6.8–6.12** — Events import
16. **6.13–6.18** — Events purchase
17. **7.1–7.13** — Broadcasts (list, create)
18. **8.1–8.10** — Sequences (list, email create)
19. **9.1–9.3** — Stats site
20. **9.4–9.11** — Stats segment and report
21. **10.1–10.5** — Dashboard
22. **11.1–11.10** — Emails (transactional send, batch)
23. **12.1–12.3** — Workflows (list)
24. **13.1–13.10** — Templates (get, update)
25. **14.1–14.4** — Forms (responses)
26. **15.1–15.17** — Experimental (validate-email, guess-gender, geolocate, blacklist, moderate)
27. **2.7–2.10** — Profile cleanup (remove, error cases)
28. **1.9–1.10** — Auth logout
29. **16.x** — Unauthenticated error handling (must run last)
