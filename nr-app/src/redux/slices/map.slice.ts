import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../store";

export const SLICE_NAME = "map";

interface MapState {
  visiblePlusCodes: string[];
}

const initialState: MapState = {
  visiblePlusCodes: [],
};

const mapSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    setVisiblePlusCodes: (state, action: PayloadAction<string[]>) => {
      state.visiblePlusCodes = action.payload;
    },
  },
});

export default mapSlice.reducer;

export const { setVisiblePlusCodes } = mapSlice.actions;

export const mapSelectors = mapSlice.getSelectors(
  (state: RootState) => state[SLICE_NAME],
);
