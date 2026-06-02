import { hexToBytes } from "@noble/hashes/utils";
import { accountFromSeedWords } from "nip06";
import { Relay, finalizeEvent, nip04 } from "nostr-tools";

// should be the account that's registered with the app
const SEED_WORDS =
  "romance slim fame pipe puzzle priority actress must impulse tape super bike";

const account = accountFromSeedWords({ mnemonic: SEED_WORDS });

export async function sendConnectResponse(connectURI: string) {
  const url = new URL(connectURI);
  const secret = url.searchParams.get("secret");
  const relayUrl = url.searchParams.get("relay");
  const clientPubkey = url.host;
  if (!secret || !relayUrl || !clientPubkey) {
    console.error(`invalid nostrconnect:// URI: ${connectURI}`);
    return;
  }

  const content = JSON.stringify({ result: secret });
  const encryptedContent = await nip04.encrypt(
    account.privateKey.hex,
    clientPubkey,
    content,
  );
  const event = finalizeEvent(
    {
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", clientPubkey]],
      content: encryptedContent,
    },
    hexToBytes(account.privateKey.hex),
  );

  const relay = await Relay.connect(relayUrl);
  await relay.publish(event);
}
