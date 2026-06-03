import Constants from "expo-constants";

import { BUILD_TIME } from "@/generated/build-time";

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatBuildTime(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  const hour = padTwoDigits(date.getHours());
  const minute = padTwoDigits(date.getMinutes());

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function getBuildTimeText(): string {
  const buildTime =
    (typeof BUILD_TIME === "string" && BUILD_TIME.length > 0
      ? BUILD_TIME
      : null) ??
    (typeof Constants.expoConfig?.extra?.buildTime === "string"
      ? Constants.expoConfig.extra.buildTime
      : null);
  return formatBuildTime(buildTime);
}
