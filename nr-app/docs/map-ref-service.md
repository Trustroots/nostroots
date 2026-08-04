# Map Ref Service

This document explains how to control the map from non-component code without storing refs in Redux state.

## Overview

The `mapRefService` allows map camera and bounds operations from app logic (including sagas) without putting refs into Redux state.

## Architecture

1. **Map Ref Service** (`src/utils/mapRef.ts`): Singleton that holds camera and map refs
2. **Map Component** (`src/components/MapLibreMapView.tsx`): Registers refs when the map is ready and clears refs on unmount
3. **Call Sites**: Components and sagas can call the service directly for imperative map control

## Usage

### Direct Service Access

Use the service directly when imperative map control is needed:

```typescript
import { mapRefService } from "@/utils/mapRef";

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

  // Get map boundaries
  const boundaries = yield call([mapRefService, "getMapBoundaries"]);
  if (boundaries) {
    // Use boundaries to update state or fetch map data.
  }
}
```

## Available Methods

### `animateToRegion(region: Region, duration?: number)`

Animates the map to a specific region.

### `animateToCoordinate(latitude, longitude, latitudeDelta?, longitudeDelta?, duration?)`

Animates the map to a specific coordinate with optional zoom levels.

### `getMapBoundaries()`

Returns the current visible boundaries of the map.

## Implementation Details

- Refs are registered in `MapLibreMapView.tsx` when `onDidFinishLoadingMap` fires
- Refs are cleared on component unmount
- Calls before refs are ready log warnings and no-op
- Methods are non-blocking except `getMapBoundaries`, which is async
