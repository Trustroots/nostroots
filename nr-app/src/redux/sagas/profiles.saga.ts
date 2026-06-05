import { SimplePool } from "nostr-tools/pool";
import {
  all,
  call,
  delay,
  put,
  race,
  select,
  takeEvery,
} from "redux-saga/effects";
import {
  profilesActions,
  selectProfileByPubkey,
} from "../slices/profiles.slice";
import { relaySelectors } from "../slices/relays.slice";

const PROFILE_CACHE_SECONDS = 5 * 60;
const FETCH_TIMEOUT_MS = 5000;

function* fetchProfileWorker(
  action: ReturnType<typeof profilesActions.fetchProfile>,
) {
  const pubkey = action.payload;

  // Check if we have a recent cached profile
  const existing: ReturnType<typeof selectProfileByPubkey> = yield select(
    (state) => selectProfileByPubkey(state, pubkey),
  );
  if (
    existing &&
    existing.fetchedAt > Date.now() / 1000 - PROFILE_CACHE_SECONDS
  ) {
    // Profile is fresh, remove from fetching list and skip
    yield put(profilesActions.fetchProfileFailed(pubkey));
    return;
  }

  try {
    const relayUrls: string[] = yield select(relaySelectors.getActiveRelayUrls);

    const { result } = yield race({
      result: call(fetchKind0FromRelays, pubkey, relayUrls),
      timeout: delay(FETCH_TIMEOUT_MS),
    });

    if (!result) {
      yield put(profilesActions.fetchProfileFailed(pubkey));
      return;
    }

    const content = JSON.parse(result.content);
    yield put(
      profilesActions.setProfile({
        pubkey,
        name: content.display_name || content.name,
        picture: content.picture,
        about: content.about,
        nip05: content.nip05,
        fetchedAt: Math.floor(Date.now() / 1000),
      }),
    );
  } catch (error) {
    if (__DEV__) {
      console.log("Failed to fetch profile for pubkey #PRF001", pubkey, error);
    }
    yield put(profilesActions.fetchProfileFailed(pubkey));
  }
}

async function fetchKind0FromRelays(pubkey: string, relayUrls: string[]) {
  const pool = new SimplePool();
  try {
    const event = await pool.get(relayUrls, {
      kinds: [0],
      authors: [pubkey],
    });
    return event;
  } finally {
    pool.close(relayUrls);
  }
}

export function* profilesSaga() {
  yield all([takeEvery(profilesActions.fetchProfile.type, fetchProfileWorker)]);
}
