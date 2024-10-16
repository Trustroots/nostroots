import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { setVisiblePlusCodes as REAL_setVisiblePlusCodes } from "../actions/map.actions";

export const SLICE_NAME = "map";

interface MapState {
  mapSubscriptionIsUpdating: boolean;
  visiblePlusCodes: string[];
}

const initialState: MapState = {
  mapSubscriptionIsUpdating: false,
  visiblePlusCodes: [],
};

const mapSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    setMapSubscriptionIsUpdating: (state, action: PayloadAction<boolean>) => {
      if (state.mapSubscriptionIsUpdating !== action.payload) {
        state.mapSubscriptionIsUpdating = action.payload;
      }
    },
    setVisiblePlusCodes: (state, action: PayloadAction<string[]>) => {
      state.visiblePlusCodes = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(REAL_setVisiblePlusCodes, (state, action) => {
      state.visiblePlusCodes = action.payload;
    });
  },
});

export default mapSlice.reducer;

export const { setMapSubscriptionIsUpdating, setVisiblePlusCodes } =
  mapSlice.actions;

export const mapSelectors = mapSlice.getSelectors(
  (state: RootState) => state[SLICE_NAME],
);
