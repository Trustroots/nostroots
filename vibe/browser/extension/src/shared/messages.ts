import { MESSAGE_SOURCE_CONTENT, MESSAGE_SOURCE_PAGE } from "./constants";
import type { Nip07Method } from "./constants";

export type ProviderRequest = {
  source: typeof MESSAGE_SOURCE_PAGE;
  id: string;
  method: Nip07Method;
  params: unknown;
};

export type ContentRequest = {
  source: typeof MESSAGE_SOURCE_CONTENT;
  id: string;
  method: Nip07Method;
  params: unknown;
  origin: string;
};

export type BridgeResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

export function success(id: string, result: unknown): BridgeResponse {
  return { id, ok: true, result };
}

export function failure(id: string, error: unknown): BridgeResponse {
  return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
}
