import { ACCEPTED_KINDS } from "@trustroots/nr-common";
import { StrfryLine } from "./parseLines.ts";

export function whitelistKinds(strfryLine: StrfryLine) {
  const { kind } = strfryLine.event;

  if (ACCEPTED_KINDS.includes(kind)) {
    // TODO - Use our event schemas to validate these events here

    return true;
  }

  return false;
}
