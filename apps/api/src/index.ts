import "./env.js";
import { buildApp } from "./app.js";

const app = await buildApp({ logger: true });
const port = Number(process.env.PORT ?? 4000);
// Loopback only outside production, so a dev API isn't reachable from the LAN. The production
// container must bind all interfaces for Caddy to reach it; HOST overrides either way.
const host = process.env.HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
