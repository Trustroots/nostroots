import { OPEN_LOCATION_CODE_TAG_NAME } from "@/common/constants";
import { createLabelTags, getCurrentTimestamp } from "@/common/utils";
import { SerializableError } from "@/utils/error.utils";
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

export function publishNotePromiseAction(note: string, plusCode: string) {
  const plusCodeTags = createLabelTags(OPEN_LOCATION_CODE_TAG_NAME, plusCode);
  const eventTemplate = {
    kind: 30397,
    content: note,
    tags: [["d", nanoid()], ...plusCodeTags],
    created_at: getCurrentTimestamp(),
  };

  const action = publishEventPromiseAction.request({ eventTemplate });

  return action;
}
