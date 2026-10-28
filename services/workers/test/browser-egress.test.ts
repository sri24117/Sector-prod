import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createSocket, type Socket } from "node:dgram";
import type { AddressInfo } from "node:net";
import { startGuardedProxy, type GuardedProxy } from "../src/report/proxy.js";
import { browserArgs, launchBrowser } from "../src/report/collect.js";

// Phase 0 security review (docs/reviews/2026-10-phase0-security-review.md), findings H2 and M1.
// ADR-0007 says the guarded proxy is the browser's ONLY route out during a full
// report. These tests fail until that is true (M1) and the renderer sandbox is on (H2).
// The page script below stands in for JavaScript on the site being reported on.

let udp: Socket; let udpPort: number; const received: string[] = [];
let proxy: GuardedProxy;
beforeAll(async () => {
  udp = createSocket("udp4");
  udp.on("message", (_m, from) => received.push(`${from.address}:${from.port}`));
  await new Promise<void>((r) => udp.bind(0, "127.0.0.1", r));
  udpPort = (udp.address() as AddressInfo).port;
  proxy = await startGuardedProxy({ allowPrivate: false });
});
afterAll(async () => { udp.close(); await proxy.close(); });

describe("full-report browser egress", () => {
  it("page JavaScript cannot reach a private address around the guarded proxy (WebRTC/STUN)", async () => {
    const browser = await launchBrowser(proxy);
    try {
      const page = await browser.newPage();
      await page.setContent("<!doctype html><title>reported site</title>");
      await page.evaluate(async (port) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: `stun:127.0.0.1:${port}` }] });
        pc.createDataChannel("x");
        await pc.setLocalDescription(await pc.createOffer());
        await new Promise((r) => setTimeout(r, 3_000));
        pc.close();
      }, udpPort);
    } finally {
      await browser.close();
    }
    // Any datagram here went from the page to 127.0.0.1 without passing the proxy.
    expect(received).toEqual([]);
  }, 30_000);

  it("Chromium keeps its renderer sandbox while it runs untrusted site JavaScript", () => {
    expect(browserArgs(proxy)).not.toContain("--no-sandbox");
  });
});
