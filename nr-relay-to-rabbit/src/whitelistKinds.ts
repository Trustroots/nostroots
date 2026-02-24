import { StrfryLine } from "./parseLines.ts";

// TODO - Build this from constants in `nr-common`
export const ACCEPT_KINDS = [0, 5, 10390, 10395, 10398, 30397, 30398, 30399];

export function whitelistKinds(strfryLine: StrfryLine) {
  const { kind } = strfryLine.event;

  if (ACCEPT_KINDS.includes(kind)) {
    // TODO - Use our event schemas to validate these events here

    return true;
  }

  return false;
}
