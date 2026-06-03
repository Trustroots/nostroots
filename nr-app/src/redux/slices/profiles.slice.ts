import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface NostrProfile {
  pubkey: string;
  name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  fetchedAt: number;
}

interface ProfilesState {
  byPubkey: Record<string, NostrProfile>;
  fetchingPubkeys: string[];
}

const initialState: ProfilesState = {
  byPubkey: {},
  fetchingPubkeys: [],
};

export const profilesSlice = createSlice({
  name: "profiles",
  initialState,
  reducers: {
    fetchProfile(state, action: PayloadAction<string>) {
      if (!state.fetchingPubkeys.includes(action.payload)) {
        state.fetchingPubkeys.push(action.payload);
      }
    },
    setProfile(state, action: PayloadAction<NostrProfile>) {
      state.byPubkey[action.payload.pubkey] = action.payload;
      state.fetchingPubkeys = state.fetchingPubkeys.filter(
        (pk) => pk !== action.payload.pubkey,
      );
    },
    fetchProfileFailed(state, action: PayloadAction<string>) {
      state.fetchingPubkeys = state.fetchingPubkeys.filter(
        (pk) => pk !== action.payload,
      );
    },
  },
});

export const profilesActions = profilesSlice.actions;
export const profilesReducer = profilesSlice.reducer;

export const selectProfileByPubkey = (
  state: { profiles: ProfilesState },
  pubkey: string,
) => state.profiles.byPubkey[pubkey];
