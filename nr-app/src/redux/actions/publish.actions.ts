import { SerializableError } from "@/utils/error.utils";
import {
  getCurrentTimestamp,
  getPlusCodeAndPlusCodePrefixTags,
} from "@trustroots/nr-common";
import { nanoid } from "@reduxjs/toolkit";
import { EventTemplate } from "nostr-tools";
import { createPromiseAction } from "redux-saga-promise-actions";

export const publishEventPromiseAction = createPromiseAction(
  "publish/event/request",
  "publish/event/success",
  "publish/event/failure",
)<
  { eventTemplate: EventTemplate },
  { [relayUrl: string]: string },
  SerializableError
>();

export const publishNoteActionCreator = createPromiseAction(
  "publish/note/request",
  "publish/note/success",
  "publish/note/failure",
)<
  { eventTemplate: EventTemplate },
  { [relayUrl: string]: string },
  { message: string }
>();

export function publishNotePromiseAction(
  note: string,
  plusCode: string,
  expirationTimestampSeconds?: number,
) {
  const plusCodeAndPlusCodePrefixTags =
    getPlusCodeAndPlusCodePrefixTags(plusCode);
  const tags = [["d", nanoid()], ...plusCodeAndPlusCodePrefixTags];
  const tagsWithExpiration =
    typeof expirationTimestampSeconds === "undefined"
      ? tags
      : tags.concat([
          ["expiration", Math.round(expirationTimestampSeconds).toString()],
        ]);
  const eventTemplate = {
    kind: 30397,
    content: note,
    tags: tagsWithExpiration,
    created_at: getCurrentTimestamp(),
  };

  const action = publishEventPromiseAction.request({ eventTemplate });

  return action;
}
