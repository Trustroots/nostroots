import { expect } from "jsr:@std/expect@1.0.13";
import type { StatusReport } from "./telegram.ts";

for (
  const name of [
    "TELEGRAM_BOT",
    "TELEGRAM_CHAT",
    "RELAY_URL",
    "AMQP_URL",
    "RELAY_TO_RABBIT_URL",
    "RELAY_WS_URL",
  ]
) {
  Deno.env.set(name, `test-${name}`);
}

const { updateState } = await import("./state.ts");
const { formatStatusMessage } = await import("./telegram.ts");

const allOk: StatusReport = {
  services: [{ name: "strfry-relay", status: "ok" }],
  pings: [{ name: "nr-server", status: "ok", durationMs: 1500 }],
};

Deno.test("updateState reports a change only when a status flips", () => {
  const withRelay = (status: "ok" | "error", ping: "ok" | "error") => ({
    services: [{ name: "strfry-relay", status }],
    pings: [{ name: "nr-server", status: ping }],
  });

  expect(updateState(allOk)).toBe(true);
  expect(updateState(allOk)).toBe(false);
  expect(updateState(withRelay("ok", "error"))).toBe(true);
  expect(updateState(withRelay("ok", "error"))).toBe(false);
  expect(updateState(withRelay("error", "error"))).toBe(true);
  expect(updateState(withRelay("ok", "ok"))).toBe(true);
  expect(updateState(withRelay("ok", "ok"))).toBe(false);
});

Deno.test("formatStatusMessage lists services and pings with their state", () => {
  const message = formatStatusMessage({
    services: [
      { name: "strfry-relay", status: "ok" },
      { name: "rabbitmq", status: "error", error: "connection refused" },
    ],
    pings: [
      { name: "nr-server", status: "ok", durationMs: 1500 },
      { name: "nr-notification-daemon", status: "ok", durationMs: 250 },
      { name: "nr-bridge", status: "error", error: "no ack" },
    ],
  });
  const lines = message.split("\n");

  expect(lines[0]).toMatch(/^📡 <b>Nostroots Status<\/b> — .+ UTC$/);
  expect(lines.slice(1)).toEqual([
    "── 3/5 operational ──",
    "",
    "🟢 strfry-relay",
    "🔴 rabbitmq — connection refused",
    "🟢 nr-server ping — 1.5s",
    "🟢 nr-notification-daemon ping — 250ms",
    "🔴 nr-bridge ping — no ack",
  ]);
});
