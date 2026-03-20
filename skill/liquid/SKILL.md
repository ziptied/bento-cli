---
name: bento-liquid
description: >
  Liquid template reference for Bento email marketing (bentonow.com).
  Use when writing or editing email templates, broadcasts, sequences,
  or flows in Bento. Covers visitor variables, conditional content,
  links, buttons, images, greetings, abandoned cart emails, coupon
  generation, external data, and time/money formatting.
---

# Bento Liquid Templates

Bento uses Liquid as its email templating language. `{{ }}` outputs values, `{% %}` runs logic. Templates render server-side at send time — each recipient gets personalized content.

## Complete Email Example

```liquid
{% greeting %}

Welcome to {{ visitor.fields.company_name | default: "our community" }}!

{% if visitor.tags contains 'customer' %}
  As a valued customer, here's 20% off your next order:
  {% shopify_coupon THANKYOU :: 20 :: percentage %}
{% elsif visitor.tags contains 'trial' %}
  Ready to upgrade? Here's 10% off:
  {% shopify_coupon UPGRADE :: 10 :: percentage %}
{% else %}
  Start your free trial today.
{% endif %}

{% if visitor.fields.last_purchase %}
  Since you bought {{ visitor.fields.last_purchase }}, you might also like:
{% endif %}

{% btn https://shop.example.com :: Browse the store :: #8B5CF6 %}

{{ visitor.first_name | default: "Friend" }}, we're glad you're here.

{% link {{ visitor.unsubscribe_url }} :: Unsubscribe %}
```

## Visitor Variables

Every subscriber (called a "visitor" in Liquid) exposes these fields:

| Variable | Output |
|---|---|
| `{{ visitor.email }}` | Subscriber email |
| `{{ visitor.first_name }}` | First name |
| `{{ visitor.last_name }}` | Last name |
| `{{ visitor.city }}` | City |
| `{{ visitor.country }}` | Country |
| `{{ visitor.eu }}` | `true` / `false` |
| `{{ visitor.ip }}` | IP address |
| `{{ visitor.gender }}` | Gender |
| `{{ visitor.age }}` | Numeric age |
| `{{ visitor.age_range }}` | Age range |
| `{{ visitor.group }}` | A/B test group (e.g. `control`) |
| `{{ visitor.tags }}` | All subscriber tags |
| `{{ visitor.confirmation_url }}` | Bento confirmation URL |
| `{{ visitor.unsubscribe_url }}` | Unsubscribe URL |
| `{{ visitor.navigation_url }}` | Navigation URL |
| `{{ visitor.checkout_url }}` | Abandoned cart URL (flows only) |

**Custom fields** use `visitor.fields`:
```liquid
{{ visitor.fields.plan_name }}
{{ visitor.fields.company_name }}
{{ visitor.fields.order_count }}
```

## Personalization with Fallbacks

Always provide fallbacks — subscribers may have incomplete data.

```liquid
{{ visitor.first_name | default: "there" }}
{{ visitor.first_name | default: visitor.last_name | default: "Friend" }}
```

## Conditionals

### if / elsif / else

Check tags, fields, city, or any visitor attribute. Content inside can include any Liquid tag.

```liquid
{% if visitor.tags contains 'customer' %}
  Thank you for being a customer!
{% elsif visitor.tags contains 'trial' %}
  Your trial is active — ready to upgrade?
{% else %}
  Welcome! Start your free trial today.
{% endif %}
```

### unless

Inverse of `if` — runs the block when the condition is false.

```liquid
{% unless visitor.tags contains 'unsubscribed' %}
  Here's what you missed this week.
{% endunless %}
```

### for Loops

Iterate over lists. Useful for tags, custom list fields, or building dynamic content.

```liquid
{% for tag in visitor.tags %}
  <span>{{ tag }}</span>
{% endfor %}
```

With a limit:
```liquid
{% for tag in visitor.tags limit: 3 %}
  {{ tag }}{% unless forloop.last %}, {% endunless %}
{% endfor %}
```

### Comparison Operators

```liquid
{% if visitor.fields.order_count > 10 %}
  You've ordered {{ visitor.fields.order_count }} times!
{% endif %}

{% if visitor.city == 'Sydney' %}
  Free shipping to Sydney this week!
{% endif %}

{% if visitor.tags contains 'vip' %}
  Exclusive VIP offer inside.
{% endif %}
```

## Content Tags

Bento-specific tags. Arguments are separated by `::`.

### Links

```liquid
{% link https://example.com :: Click Here! %}
```

> Do NOT wrap in `<a href>` tags. Bento generates the anchor HTML. Using `<a href="...">` inside a link tag breaks it.

### Buttons

Styled CTA button. Optional hex color as third argument.

```liquid
{% btn https://example.com :: Get Started :: #8B5CF6 %}
{% btn https://example.com :: Learn More %}
```

### Images

Arguments after `::`: CSS classes, ID, alt text, width (px), height (px) — comma-separated.

```liquid
{% img https://example.com/photo.png :: hero-image, , Product photo, 600, 400 %}
```

### Audio

Embeds a player with automatic fallback link for unsupported email clients.

```liquid
{% audio https://example.com/podcast.mp3 :: audio %}
```

### Greeting

```liquid
{% greeting %}
```
Output: `Hi Jesse,`

### Formatted Name

```liquid
{% formatted_name %}
```
Output: `John Doe`

### Gravatar

Renders the subscriber's Gravatar with a fallback avatar.

```liquid
{% gravatar %}
```

## Filters

### String

| Filter | Example | Output |
|---|---|---|
| `default` | `{{ name | default: "Friend" }}` | Fallback for nil/empty |
| `append` | `{{ "hello" | append: " world" }}` | `hello world` |
| `prepend` | `{{ "world" | prepend: "hello " }}` | `hello world` |
| `capitalize` | `{{ "hello" | capitalize }}` | `Hello` |
| `upcase` | `{{ "hello" | upcase }}` | `HELLO` |
| `downcase` | `{{ "HELLO" | downcase }}` | `hello` |
| `remove` | `{{ "hello world" | remove: "world" }}` | `hello ` |
| `replace` | `{{ "hello" | replace: "hello", "hi" }}` | `hi` |
| `truncate` | `{{ "long text here" | truncate: 8 }}` | `long ...` |
| `newline_to_br` | `{{ text | newline_to_br }}` | `\n` to `<br>` |
| `pluralize` | `{{ 3 | pluralize: "item", "items" }}` | `items` |

### Math

| Filter | Example | Output |
|---|---|---|
| `plus` | `{{ 10 | plus: 3 }}` | `13` |
| `minus` | `{{ 10 | minus: 3 }}` | `7` |
| `divided_by` | `{{ 10 | divided_by: 3 }}` | `3` (floors for integers) |
| `round` | `{{ 3.14 | round }}` | `3` |

### Bento Filters

| Filter | Example | Output |
|---|---|---|
| `money` | `{{ 900 | money }}` | `$900.00 USD` (subscriber's currency) |
| `md5` | `{{ visitor.email | md5 }}` | MD5 hash |
| `sha1` | `{{ visitor.email | sha1 }}` | SHA1 hash |
| `lottery` | `{{ "A\|B\|C" | split: "\|" | lottery }}` | Random pick |

### Time Filters

Apply to any date field. Useful for batched sends where timestamps would go stale.

| Filter | Example | Output |
|---|---|---|
| `days_until` | `{{ visitor.fields.renewal | days_until }}` | `14` |
| `days_since` | `{{ visitor.fields.signup | days_since }}` | `87` |
| `weeks_until` | `{{ visitor.fields.renewal | weeks_until }}` | `2` |
| `months_since` | `{{ visitor.fields.signup | months_since }}` | `3` |
| `end_of_year` | `{{ visitor.fields.date | end_of_year }}` | End of year timestamp |
| `in_time_zone` | `{{ visitor.fields.date | in_time_zone: "America/Chicago" }}` | Timezone-adjusted |
| `to_i` | `{{ visitor.fields.date | to_i }}` | Unix timestamp |
| `time_ago_in_words` | `{{ visitor.fields.signup | time_ago_in_words }}` | `about 2 months` |

## Context-Specific Tags

These only work in their specific context. They produce no output elsewhere.

### Broadcast-Only

| Variable | Output |
|---|---|
| `{{ broadcast.subject }}` | Subject line |
| `{{ broadcast.name }}` | Broadcast name |
| `{{ broadcast.created_at }}` | Creation timestamp (pipe through time filters to reformat) |

### Sequence-Only

**Cancel the sequence** — gives subscribers an alternative to unsubscribing:
```liquid
{% sequence_cancel No more emails like this! %}
```

**Skip to next email** — optionally redirect to a URL (must match sender domain):
```liquid
{% sequence_fast_forward Get the next email now. %}
{% sequence_fast_forward Skip ahead :: https://example.com/next %}
```

### Flow-Only (Ecommerce)

**Render last cart** — for abandoned cart emails:
```liquid
{% render_cart %}
```

**Render products** — like render_cart but extends beyond the most recent cart:
```liquid
{% render_products %}
```

**Checkout URL** — personalized link back to their cart:
```liquid
{% btn {{ visitor.checkout_url }} :: Complete your purchase :: #22C55E %}
```

## Coupon Generation

### Shopify Coupons

Arguments: coupon name `::` discount amount `::` type (`fixed_amount` or `percentage`). Returns the code string.

```liquid
Use code {% shopify_coupon WELCOME :: 10 :: percentage %} for 10% off!
```

### Stripe Coupons

Arguments: name `::` discount % `::` validity in months. Returns the code string.

```liquid
Use code {% stripe_coupon SAVE20 :: 20 :: 3 %} — valid for 3 months!
```

**Stripe billing portal** — generates a user-specific portal URL:
```liquid
{% link {% stripe_billing_portal https://example.com %} :: Manage your subscription %}
```

## External Data

Pull public data into templates. Requests must be GET.

```liquid
{% fetch https://example.com/feed.json :: fetch_json %}
{% for item in data %}
  {{ item.title }}
{% endfor %}
```

| Type | Use Case |
|---|---|
| `fetch_json` | JSON API responses |
| `rss` | RSS/Atom feeds |
| `youtube` | YouTube channel data |
| `fetch_html` | HTML scraping (supports parent/child selectors) |

## Environment Checks

| Variable | Output |
|---|---|
| `{{ env.development? }}` | `true` / `false` |
| `{{ env.production? }}` | `true` / `false` |
| `{{ env.staging? }}` | `true` / `false` |

## Gmail Promo Annotations

Add promotional badges in Gmail. Subject to Gmail's rendering discretion.

```liquid
{% promo 20% Off :: Use code SAVE20 %}
```

## Common Mistakes

**HTML inside link/button tags:**
```liquid
❌ {% link <a href="https://example.com">Click</a> %}
✅ {% link https://example.com :: Click %}
```

**Missing fallbacks on optional fields:**
```liquid
❌ Hello {{ visitor.first_name }},
✅ Hello {{ visitor.first_name | default: "there" }},
```

**Using context-specific tags in the wrong place:**
```liquid
❌ {% render_cart %}     ← silent no-op in a broadcast
✅ {% render_cart %}     ← works inside a flow
```

**Forgetting the `::` delimiter:**
```liquid
❌ {% btn https://example.com Click here %}
✅ {% btn https://example.com :: Click here %}
```
