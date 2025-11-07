# Map Ref Service

This document explains how to control the map from Redux actions and sagas.

## Overview

The `mapRefService` allows you to control map animations from anywhere in the app, including Redux sagas, without storing the ref directly in Redux state (which would violate Redux's serialization requirements).

## Architecture

1. **Map Ref Service** (`src/utils/mapRef.ts`): A singleton service that holds the map ref
2. **Redux Actions** (`src/redux/slices/map.slice.ts`): Actions to trigger map animations
3. **Redux Sagas** (`src/redux/sagas/map.saga.ts`): Sagas that handle the actions and call the service
4. **Map Component** (`src/components/MapMarkers.tsx`): Registers the ref when the map is ready

## Usage

### Method 1: Using Redux Actions (Recommended)

The recommended way is to dispatch Redux actions from anywhere in your app:

```typescript
import { useAppDispatch } from '@/redux/hooks';
import { mapActions } from '@/redux/slices/map.slice';

function MyComponent() {
  const dispatch = useAppDispatch();

  const handleNavigateToLocation = () => {
    // Animate to a specific coordinate
    dispatch(mapActions.animateToCoordinate({
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.0922,  // optional, defaults to 0.0922
      longitudeDelta: 0.0421, // optional, defaults to 0.0421
      duration: 1000,         // optional, animation duration in ms
    }));
  };

  const handleNavigateToRegion = () => {
    // Animate to a full region
    dispatch(mapActions.animateToRegion({
      region: {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      },
      duration: 1000, // optional
    }));
  };

  return (
    <View>
      <Button title="Navigate to SF" onPress={handleNavigateToLocation} />
      <Button title="Navigate to Region" onPress={handleNavigateToRegion} />
    </View>
  );
}
```

### Method 2: Direct Service Access (For Sagas)

If you're in a saga and need more control, you can use the service directly:

```typescript
import { mapRefService } from '@/utils/mapRef';

function* mySaga() {
  // Animate to a coordinate
  mapRefService.animateToCoordinate(37.78825, -122.4324);

  // Animate to a region
  mapRefService.animateToRegion({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Fit to multiple coordinates
  mapRefService.fitToCoordinates([
    { latitude: 37.78825, longitude: -122.4324 },
    { latitude: 37.33233, longitude: -122.03121 },
  ], {
    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
    animated: true,
  });

  // Animate camera (more advanced)
  mapRefService.animateCamera({
    center: { latitude: 37.78825, longitude: -122.4324 },
    zoom: 15,
  }, 1000);

  // Get map boundaries
  const boundaries = yield call([mapRefService, 'getMapBoundaries']);
  if (boundaries) {
    console.log('Map boundaries:', boundaries);
  }
}
```

## Available Methods

### `animateToRegion(region: Region, duration?: number)`
Animates the map to a specific region.

### `animateToCoordinate(latitude, longitude, latitudeDelta?, longitudeDelta?, duration?)`
Animates the map to a specific coordinate with optional zoom levels.

### `animateCamera(camera, duration?)`
Provides more control over the camera animation (pitch, heading, altitude, zoom).

### `fitToCoordinates(coordinates, options?)`
Fits the map to show all the specified coordinates.

### `getMapBoundaries()`
Returns the current visible boundaries of the map.

## Example: Navigate to Event Location

```typescript
// In a saga that handles event selection
function* navigateToEventSaga(action: PayloadAction<{ eventId: string }>) {
  const event = yield select(eventsSelectors.selectById, action.payload.eventId);

  if (event?.event.tags) {
    const gTag = event.event.tags.find(tag => tag[0] === 'g');
    if (gTag && gTag[1]) {
      const [lat, lon] = decodeGeohash(gTag[1]);

      // Animate to the event location
      yield put(mapActions.animateToCoordinate({
        latitude: lat,
        longitude: lon,
        duration: 1000,
      }));
    }
  }
}
```

## Implementation Details

- The map ref is registered in `MapMarkers.tsx` when the map is ready (`onMapReady`)
- The ref is cleaned up when the component unmounts
- If you try to call map methods before the ref is set, a warning will be logged
- All map method calls are non-blocking and fail gracefully if the ref isn't available

