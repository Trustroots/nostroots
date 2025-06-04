import { createAction } from "@reduxjs/toolkit";

export const startup = createAction("app/startup");

export const rehydrated = createAction("app/rehydrated");
