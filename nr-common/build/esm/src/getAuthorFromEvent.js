import { MAP_NOTE_REPOST_KIND } from "../constants.js";
import { eventSchema } from "./event.schema.js";
import { getFirstTagValueFromEvent } from "./utils.js";
export function getAuthorFromEvent(event) {
    const result = eventSchema.safeParse(event);
    if (!result.success) {
        return;
    }
    const parsedEvent = result.data;
    switch (parsedEvent.kind) {
        case MAP_NOTE_REPOST_KIND: {
            const originalAuthorPublicKey = getFirstTagValueFromEvent(event, "p");
            return originalAuthorPublicKey;
        }
        default:
            // TODO - Handle delegated signing and so on here
            return event.pubkey;
    }
}
