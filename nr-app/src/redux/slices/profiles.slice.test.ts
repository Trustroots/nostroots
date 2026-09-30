import {
  profilesActions,
  profilesReducer,
  selectProfileByPubkey,
} from "./profiles.slice";

const pubkey = "1".repeat(64);
const profile = { pubkey, name: "Alice", fetchedAt: 1_000 };

describe("profiles.slice", () => {
  it("tracks each pubkey being fetched once", () => {
    let state = profilesReducer(
      undefined,
      profilesActions.fetchProfile(pubkey),
    );
    state = profilesReducer(state, profilesActions.fetchProfile(pubkey));

    expect(state.fetchingPubkeys).toEqual([pubkey]);
  });

  it("stores a fetched profile and stops tracking the fetch", () => {
    let state = profilesReducer(
      undefined,
      profilesActions.fetchProfile(pubkey),
    );
    state = profilesReducer(state, profilesActions.setProfile(profile));

    expect(state.fetchingPubkeys).toEqual([]);
    expect(selectProfileByPubkey({ profiles: state }, pubkey)).toEqual(profile);
  });

  it("stops tracking a failed fetch without storing a profile", () => {
    let state = profilesReducer(
      undefined,
      profilesActions.fetchProfile(pubkey),
    );
    state = profilesReducer(state, profilesActions.fetchProfileFailed(pubkey));

    expect(state.fetchingPubkeys).toEqual([]);
    expect(selectProfileByPubkey({ profiles: state }, pubkey)).toBeUndefined();
  });
});
