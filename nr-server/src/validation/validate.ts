import { WAIT_FOR_KIND_ZERO_TIMEOUT_SECONDS } from "../common/constants.ts";
import { nostrify, nostrTools, nrCommon } from "../../deps.ts";
const {
  MAP_NOTE_KIND,
  TRUSTROOTS_PROFILE_KIND,
  getFirstLabelValueFromEvent,
  TRUSTROOTS_USERNAME_LABEL_NAMESPACE,
  getNip5PubKey,
  HITCHMAPS_AUTHOR_PUBLIC_KEY,
  TRUSTROOTS_USERNAME_MIN_LENGTH,
} = nrCommon;
import { log } from "../log.ts";
import { Profile } from "../types.ts";

async function getKindZeroEvent(relayPool: nostrify.NPool, pubKey: string) {
  {
    const filter = [
      {
        authors: [pubKey],
        kinds: [0],
      },
    ];

    const controller = new AbortController();
    const signal = controller.signal;
    globalThis.setTimeout(
      () => controller.abort(),
      WAIT_FOR_KIND_ZERO_TIMEOUT_SECONDS * 1000
    );

    const kindZeroEvents = await relayPool.query(filter, { signal });
    if (kindZeroEvents.length > 0) return kindZeroEvents[0];
    return;
  }
}

async function getTrustrootsProfileEvent(
  relayPool: nostrify.NPool,
  pubKey: string
) {
  const filter = [
    {
      authors: [pubKey],
      kinds: [TRUSTROOTS_PROFILE_KIND],
    },
  ];

  const controller = new AbortController();
  const signal = controller.signal;
  globalThis.setTimeout(
    () => controller.abort(),
    WAIT_FOR_KIND_ZERO_TIMEOUT_SECONDS * 1000
  );

  const profileEvents = await relayPool.query(filter, { signal });
  if (profileEvents.length > 0) return profileEvents[0];
  return;
}

function getProfileFromEvent(event: nostrTools.Event): Profile | undefined {
  log.debug("#GHg51j kindZeroEvent", event);
  try {
    const profile = JSON.parse(event.content);

    const { trustrootsUsername } = profile;

    if (
      typeof trustrootsUsername !== "string" ||
      trustrootsUsername.length < TRUSTROOTS_USERNAME_MIN_LENGTH
    ) {
      return;
    }

    return profile;
  } catch {
    return;
  }
}

async function getTrustrootsUsernameFromProfile(
  relayPool: nostrify.NPool,
  pubkey: string
) {
  const [trustrootsProfileEvent, kindZeroEvent] = await Promise.all([
    getTrustrootsProfileEvent(relayPool, pubkey),
    getKindZeroEvent(relayPool, pubkey),
  ]);

  if (typeof trustrootsProfileEvent !== "undefined") {
    const trustrootsUsername = getFirstLabelValueFromEvent(
      trustrootsProfileEvent,
      TRUSTROOTS_USERNAME_LABEL_NAMESPACE
    );

    return trustrootsUsername;
  }

  if (typeof kindZeroEvent !== "undefined") {
    const profile = getProfileFromEvent(kindZeroEvent);
    if (typeof profile === "undefined") {
      return;
    }
    const { trustrootsUsername } = profile;
    return trustrootsUsername;
  }
}

/**
 * Does this event meet our requirements for automated validation?
 *
 * Check things like, is the event signed by the pubkey which is linked to the
 * correct trustroots profile.
 */
export async function validateEvent(
  relayPool: nostrify.NPool,
  event: nostrify.NostrEvent
) {
  if (event.kind !== MAP_NOTE_KIND) {
    return false;
  }

  // Automatically validate all hitchmap notes without checking for kind zero
  if (event.pubkey === HITCHMAPS_AUTHOR_PUBLIC_KEY) {
    return true;
  }

  const trustrootsUsername = await getTrustrootsUsernameFromProfile(
    relayPool,
    event.pubkey
  );

  if (
    typeof trustrootsUsername === "undefined" ||
    trustrootsUsername.length === 0
  ) {
    log.debug(
      "#Kmf59M Skipping event with no trustrootsUsername from profile",
      { event }
    );
    return false;
  }

  log.debug(`#yUtER5 Checking username ${trustrootsUsername}`);

  const nip5PubKey = await getNip5PubKey(trustrootsUsername);

  if (typeof nip5PubKey !== "string") {
    log.debug("#b0gWmE Failed to get string nip5 pubkey", { event });
    return false;
  }

  if (event.pubkey !== nip5PubKey) {
    log.debug("#dtKr5H Event failed nip5 validation", { event });
    return false;
  }

  log.debug("#lpglLu Event passed validation", event);
  return true;
}
