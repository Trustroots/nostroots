import { ACCEPTED_KINDS } from "@trustroots/nr-common";
import { StrfryLine } from "./parseLines.ts";

function isKindInAcceptedKindsList(kind: number) {
  const result = ACCEPTED_KINDS.some((acceptedKind) => acceptedKind === kind);
  return result;
}

export function whitelistKinds(strfryLine: StrfryLine) {
  const { kind } = strfryLine.event;

  if (isKindInAcceptedKindsList(kind)) {
    // TODO - Use our event schemas to validate these events here

    return true;
  }

  return false;
}
