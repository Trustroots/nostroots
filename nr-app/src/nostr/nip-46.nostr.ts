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
  console.log(
    `Parsed nostrconnect string: secret=${secret}, relayUrl=${relayUrl}, clientPubkey=${clientPubkey}`,
  );

  const content = JSON.stringify({ result: secret });
  console.log("Encrypting event…");
  const encryptedContent = await nip04.encrypt(
    account.privateKey.hex,
    clientPubkey,
    content,
  );
  console.log("Finalizing event…");
  const event = finalizeEvent(
    {
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", clientPubkey]],
      content: encryptedContent,
    },
    hexToBytes(account.privateKey.hex),
  );

  console.log("Connecting to relay…");
  const relay = await Relay.connect(relayUrl);
  console.log("Publishing event…");
  await relay.publish(event);
  console.log("Done with nip-46 connect response");
}
