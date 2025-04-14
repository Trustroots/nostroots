import { MAP_NOTE_KIND, MAP_NOTE_REPOST_KIND, NOTIFICATION_SUBSCRIPTION_KIND, TRUSTROOTS_PROFILE_KIND, } from "../constants.js";
import { kind10390EventSchema } from "./10390.schema.js";
import { kind10395EventSchema } from "./10395.schema.js";
import { kind30397EventSchema } from "./30397.schema.js";
import { kind30398EventSchema } from "./30398.schema.js";
import { baseEventSchema } from "./base.schema.js";
export function isValidEvent(event) {
    try {
        switch (event.kind) {
            case TRUSTROOTS_PROFILE_KIND:
                kind10390EventSchema.parse(event);
                return true;
            case NOTIFICATION_SUBSCRIPTION_KIND:
                kind10395EventSchema.parse(event);
                return true;
            case MAP_NOTE_KIND:
                kind30397EventSchema.parse(event);
                return true;
            case MAP_NOTE_REPOST_KIND:
                kind30398EventSchema.parse(event);
                return true;
            default:
                baseEventSchema.parse(event);
                return true;
        }
    }
    catch (_error) {
        return false;
    }
}
