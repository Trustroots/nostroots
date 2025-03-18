import { SerializableError } from "@/utils/error.utils";
import {
  getCurrentTimestamp,
  getPlusCodeAndPlusCodePrefixTags,
} from "@trustroots/nr-common";
import { nanoid } from "@reduxjs/toolkit";
import { Event, EventTemplate, VerifiedEvent } from "nostr-tools";
import { createPromiseAction } from "redux-saga-promise-actions";

export const publishEventPromiseAction = createPromiseAction(
  "publish/event/request",
  "publish/event/success",
  "publish/event/failure",
)<
  { event: VerifiedEvent },
  { id: string; relayResponses: { [relayUrl: string]: string } },
  SerializableError
>();

export const publishEventTemplatePromiseAction = createPromiseAction(
  "publish/eventTemplate/request",
  "publish/eventTemplate/success",
  "publish/eventTemplate/failure",
)<{ eventTemplate: EventTemplate }, { event: Event }, SerializableError>();

export const publishNoteActionCreator = createPromiseAction(
  "publish/note/request",
  "publish/note/success",
  "publish/note/failure",
)<{ event: Event }, { [relayUrl: string]: string }, { message: string }>();

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

  const action = publishEventTemplatePromiseAction.request({ eventTemplate });

  return action;
}
