// Library entrypoint for other workspace packages (apps/api's audit route).
// Kept separate from index.ts, which is the CLI entrypoint and has its own
// process.argv/process.exit side effects that a consuming service should
// never import.

export * from "./audit.js";
