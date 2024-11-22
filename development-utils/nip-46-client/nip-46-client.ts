import {
  NRelay1,
  NSecSigner,
} from "https://jsr.io/@nostrify/nostrify/0.36.1/mod.ts";
import type {
  NostrEvent,
  NostrFilter,
} from "https://jsr.io/@nostrify/nostrify/0.36.1/mod.ts";
import { generateSecretKey, getPublicKey } from "jsr:@nostr/tools/pure";

import { qrcode } from "jsr:@libs/qrcode";
import { decodeHex, encodeHex } from "jsr:@std/encoding/hex";

function getFirstTagValueFromEvent(
  nostrEvent: NostrEvent,
  tagName: string
): string | undefined {
  const firstMatchingTagPair = nostrEvent.tags.find(([key]) => key === tagName);

  if (typeof firstMatchingTagPair === "undefined") {
    return;
  }

  const [, firstValue] = firstMatchingTagPair;

  return firstValue;
}

const RELAY: string = "wss://relay.trustroots.org";
const RESPONSE_EVENT_KIND = 24133;

const PUBLIC_KEY =
  "9856ff923427571d6f4f965e0002cf21a3fed71443de402bd74f149d1256bdbf";
const SECRET_KEY =
  "caaec2bc7b547595797e838660295f4b69c5e20f4d34bb69e4512e672123ee93";

function generateClientKeyPair() {
  const sk = generateSecretKey(); // `sk` is a Uint8Array
  const pk = getPublicKey(sk); // `pk` is a hex string
  return {
    publicKey: pk,
    secretKey: encodeHex(sk),
  };
}

function generateSecret() {
  const secret = crypto.randomUUID();
  return secret;
}

function getRelay() {
  return RELAY;
}

function generateResponse({
  relay,
  publicKey,
  secret,
}: {
  relay: string;
  publicKey: string;
  secret: string;
}) {
  const connectURI = `nostrconnect://${publicKey}?relay=${relay}&secret=${secret}`;
  const qrCode = qrcode(connectURI, { output: "svg" });

  const html = `
<html>
    <body>
    <h1>My External Hospex Site</h1>
    <p>
      Enter the below nostrconnect:// URI into the Connect tab on the Nostroots app.
      Click "Send Connect Response" and see the server logs of this site to see whether the user is getting verified.
      In the real world, we'd set a session cookie upon successful verification.
      You can scan the QR code and copy it that way to make your life easier.
    </p>
    <p> ${connectURI} </p>
    <div style="width: 200px; height:200px;">
      ${qrCode}
    </div>
    </body>
</html>
  `;

  return new Response(html, { headers: { "content-type": "text/html" } });
}

async function subscribe({
  secret,
  publicKey,
  secretKey,
}: {
  secret: string;
  publicKey: string;
  secretKey: string;
}) {
  const relay = new NRelay1(RELAY);
  const secretKeyAsArray = decodeHex(secretKey);
  const signer = new NSecSigner(secretKeyAsArray);
  const filter: NostrFilter = {
    kinds: [RESPONSE_EVENT_KIND],
    "#p": [publicKey],
  };
  console.log(`Subscribing to events with secret=${secret}, #p=${publicKey}`);
  for await (const msg of relay.req([filter])) {
    if (msg[0] === "EVENT") {
      const event = msg[2];
      console.log("Got event:");
      console.log(event);
      const claimedClientPubkey = getFirstTagValueFromEvent(event, "p");
      if (claimedClientPubkey !== publicKey) {
        console.error("wrong client pubkey specified");
      }

      console.log("Decrypting…");
      const decryptedContenString = await signer.nip04.decrypt(
        event.pubkey,
        event.content
      );
      const content = JSON.parse(decryptedContenString);

      console.log("Decrypted content:");
      console.log(content);

      if (content?.result !== secret) {
        console.error("wrong secret");
        return;
      }

      console.log("==== USER VERIFIED ====");
    }
  }
}

Deno.serve((_req) => {
  const secret = generateSecret();
  const { secretKey, publicKey } = generateClientKeyPair();
  const relay = getRelay();
  subscribe({
    secret,
    publicKey,
    secretKey,
  });
  const response = generateResponse({ relay, publicKey, secret });
  return response;
});
