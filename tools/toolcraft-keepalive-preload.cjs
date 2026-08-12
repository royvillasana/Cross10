// Local workaround for a @pixel-point/toolcraft@0.0.18 framework issue.
//
// The Vite dev/preview server inherits Node's 5s default keep-alive idle close
// and advertises `Keep-Alive: timeout=5`, closing idle sockets at ~6007ms. The
// signed browser proof session (e2e/browser-proof-session.ts) polls
// /.toolcraft/server-identity.json before every action, so a poll landing in the
// close window reuses a socket the server is tearing down and fails ECONNRESET.
// That is the intermittent browser-suite flakiness diagnosed on 2026-08-11.
//
// The upstream fix is one line in the framework's own vite.config.ts, which is
// under the signed integrity manifest and cannot be edited here. This shim
// raises the timeout in-process instead, so no signed file changes.
//
// Load it by exporting NODE_OPTIONS before any command that starts the server:
//
//   NODE_OPTIONS="--require ./tools/toolcraft-keepalive-preload.cjs" npm run verify:delivery
//
// Playwright merges process.env into its `webServer` environment, so the setting
// reaches the Vite process it spawns. Remove this file once upstream ships the fix.

const http = require("node:http");

const KEEP_ALIVE_TIMEOUT_MS = 120_000;
const HEADERS_TIMEOUT_MS = 125_000;

const originalListen = http.Server.prototype.listen;

http.Server.prototype.listen = function toolcraftPatchedListen(...args) {
  // headersTimeout must stay above keepAliveTimeout or Node reintroduces the race.
  this.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
  this.headersTimeout = HEADERS_TIMEOUT_MS;

  return originalListen.apply(this, args);
};
