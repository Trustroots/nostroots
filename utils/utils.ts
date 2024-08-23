/** NIP-01 Nostr event. */
export interface NostrEvent {
  /** 32-bytes lowercase hex-encoded sha256 of the serialized event data. */
  id: string;
  /** 32-bytes lowercase hex-encoded public key of the event creator */
  pubkey: string;
  /** Unix timestamp in seconds. */
  created_at: number;
  /** Integer between 0 and 65535. */
  kind: number;
  /** Matrix of arbitrary strings. */
  tags: string[][];
  /** Arbitrary string. */
  content: string;
  /** 64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data, which is the same as the `id` field. */
  sig: string;
}

export const filterForTag = (key: string) => (tags: string[]) =>
  tags[0] === key;

type GetTagFirstValueFromEventParams = {
  /** The event to extract the tag value from */
  event: NostrEvent;
  /** The name (key) of the tag to get the value of */
  tag: string;
};
/**
 * @returns - The string value of the tag, or undefined if the tag does not exist
 */
export const getTagFirstValueFromEvent = ({
  event,
  tag,
}: GetTagFirstValueFromEventParams) => {
  const tagArray = event.tags.find(filterForTag(tag));
  if (typeof tagArray === "undefined") {
    return;
  }
  // The value is the second element in the array
  return tagArray[1];
};
