import { ProfileEvent } from "@/typesTEMPORARY";
import {
  createEntityAdapter,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";

export const SLICE_NAME = "profiles" as const;

function getId(profileEvent: ProfileEvent) {
  return profileEvent.pubkey;
}

const profilesAdapter = createEntityAdapter<ProfileEvent, string>({
  selectId: (profileEvent: ProfileEvent) => profileEvent.pubkey,
});
const localSelectors = profilesAdapter.getSelectors();

export interface ProfilesState {
  profiles: [];
}

const profileSlice = createSlice({
  name: SLICE_NAME,
  initialState: profilesAdapter.getInitialState(),
  reducers: {
    setAllProfiles: (state, action: PayloadAction<ProfileEvent[]>) =>
      profilesAdapter.setAll(state, action.payload),
    addProfile: (state, action: PayloadAction<ProfileEvent>) => {
      const profileEvent = action.payload;
      const id = getId(profileEvent);

      const isExistingProfileEvent = state.ids.includes(id);

      if (!isExistingProfileEvent) {
        return profilesAdapter.setOne(state, profileEvent);
      }

      const existingProfileEvent = localSelectors.selectById(state, id);

      if (profileEvent.created_at > existingProfileEvent.created_at) {
        return profilesAdapter.setOne(state, profileEvent);
      }

      return state;
    },
  },
});

export default profileSlice.reducer;
