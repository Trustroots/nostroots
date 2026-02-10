/**
 * Strfry write-policy plugin: allow kind 0 from anyone; other kinds only from
 * pubkeys that have set nip05 to *@trustroots.org in a kind 0 (allowlist built
 * from kind 0 events and persisted to ALLOWLIST_PATH).
 */
import { TextLineStream } from "jsr:@std/streams";

const ALLOWLIST_PATH = Deno.env.get("ALLOWLIST_PATH") ?? "./allowlist.json";
const NIP05_SUFFIX = (Deno.env.get("TRUSTROOTS_NIP05_DOMAIN") ?? "trustroots.org")
  .toLowerCase()
  .replace(/^@+/, "");
const NIP05_SUFFIX_AT = `@${NIP05_SUFFIX}`;

const REJECT_MSG = "Only Trustroots NIP-05 verified users can post";

type StrfryInput = {
  type: string;
  event: { id: string; pubkey: string; kind: number; content: string };
};

function loadAllowlist(): Set<string> {
  try {
    const data = Deno.readTextFileSync(ALLOWLIST_PATH);
    const parsed = JSON.parse(data) as { pubkeys?: string[] };
    return new Set(parsed.pubkeys ?? []);
  } catch {
    return new Set();
  }
}

function saveAllowlist(pubkeys: Set<string>): void {
  const dir = ALLOWLIST_PATH.replace(/\/[^/]+$/, "");
  try {
    Deno.mkdirSync(dir, { recursive: true });
  } catch {
    // dir exists or path has no dir
  }
  Deno.writeTextFileSync(
    ALLOWLIST_PATH,
    JSON.stringify({ pubkeys: [...pubkeys].sort() }) + "\n"
  );
}

function hasTrustrootsNip05(content: string): boolean {
  let profile: { nip05?: string };
  try {
    profile = JSON.parse(content) as { nip05?: string };
  } catch {
    return false;
  }
  const nip05 = typeof profile.nip05 === "string" ? profile.nip05.trim() : "";
  if (!nip05) return false;
  return nip05.toLowerCase().endsWith(NIP05_SUFFIX_AT);
}

const encoder = new TextEncoder();

function respond(id: string, action: "accept" | "reject", msg?: string): void {
  const out: { id: string; action: "accept" | "reject"; msg?: string } = {
    id,
    action,
  };
  if (action === "reject" && msg !== undefined) out.msg = msg;
  const line = JSON.stringify(out) + "\n";
  Deno.stdout.writeSync(encoder.encode(line));
}

let allowlist = loadAllowlist();

const stdin = Deno.stdin.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TextLineStream());

for await (const line of stdin) {
  if (line.trim() === "") continue;
  let input: StrfryInput;
  try {
    input = JSON.parse(line) as StrfryInput;
  } catch {
    continue;
  }
  if (input.type !== "new" || !input.event?.id) {
    continue;
  }
  const { id, pubkey, kind, content } = input.event;

  if (kind === 0) {
    respond(id, "accept");
    if (hasTrustrootsNip05(content) && !allowlist.has(pubkey)) {
      allowlist.add(pubkey);
      saveAllowlist(allowlist);
    }
    continue;
  }

  if (allowlist.has(pubkey)) {
    respond(id, "accept");
  } else {
    respond(id, "reject", REJECT_MSG);
  }
}
