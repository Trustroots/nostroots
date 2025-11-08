import * as Location from "expo-location";

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    // console.error("Permission to access location was denied");
    return null;
  }

  const location = await Location.getCurrentPositionAsync({});
  return location;
}
