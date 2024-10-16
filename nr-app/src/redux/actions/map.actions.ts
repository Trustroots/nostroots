import { createAction } from "@reduxjs/toolkit";

export const setVisiblePlusCodes = createAction<string[]>(
  "map/setVisiblePlusCodes",
);
