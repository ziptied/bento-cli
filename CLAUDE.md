# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bento CLI is a Bun-based command-line tool for interacting with the Bento email marketing platform. It provides:
- **Command-Oriented Interface (COI)**: Deterministic, scriptable commands backed by `@bentonow/bento-node-sdk`
- **Conversational Interface**: LLM-assisted workflows via MCP (Model Context Protocol)

**Package**: `@bentonow/bento-cli`
**Runtime**: Bun >= 1.x
**Entry**: `bin/bento`

## Build & Test Commands

```bash
# Run tests
bun test

# Run a single test file
bun test src/tests/subscribers.test.ts

# Run CLI locally
bun run bin/bento
```

## Architecture

```
src/
├── cli.ts                # Entry point
├── commands/             # Command definitions (auth, subscribers, tags, etc.)
├── core/
│   ├── config.ts         # Profile management, auth storage
│   ├── sdk.ts            # Bento Node SDK wrapper
│   ├── mcp.ts            # MCP bridge for conversational features
│   ├── safety.ts         # Dry-run, confirmation, limits
│   └── output.ts         # Table/JSON formatters
├── ask/
│   ├── planner.ts        # Intent classification for `bento ask`
│   └── executor.ts       # MCP tool execution
└── tests/
```

**Key Design Principles**:
- Deterministic by default; conversational only when explicitly requested (`bento ask`)
- All bulk-affecting commands support `--dry-run`, `--limit`, `--sample`, `--confirm`
- CLI works standalone without MCP; MCP is optional
- Output formats: human-readable tables (default), `--json` for scripting, `--quiet` for minimal output

## Config Location

Profiles stored via `env-paths`:
- macOS: `~/Library/Application Support/bento/config.json`
- Linux: `~/.config/bento/config.json`

## Dependencies

- `@bentonow/bento-node-sdk` - Core API operations
- `@bentonow/bento-mcp` - Optional, for conversational `ask` command
