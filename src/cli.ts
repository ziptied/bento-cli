import { Command } from "commander";

const program = new Command();

program
  .name("bento")
  .description("Bento CLI - Command-oriented and conversational interface for Bento email marketing")
  .version("0.1.0");

// Commands will be registered here as they are implemented:
// - auth (login, logout, status)
// - profile (add, list, use, remove)
// - subscribers (search, import, tag, suppress)
// - tags (list, create, delete)
// - fields (list, create)
// - events (track)
// - broadcasts (list, create)
// - stats (site)
// - mcp (status, start, stop)
// - ask

program.parse();
