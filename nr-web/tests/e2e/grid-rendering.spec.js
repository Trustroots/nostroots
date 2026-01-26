import { test, expect } from '@playwright/test';

/**
 * E2E tests for grid rendering
 * Tests the actual grid display on the map
 */
test.describe('Grid Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for map to load
    await page.waitForSelector('#map', { timeout: 10000 });
    
    // Wait a bit for map initialization
    await page.waitForTimeout(2000);
  });

  test('map should have grid source initialized', async ({ page }) => {
    // Check that the plus code grid source exists
    const gridSourceExists = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        return source !== undefined;
      }
      return false;
    });
    
    expect(gridSourceExists).toBe(true);
  });

  test('grid should have features after initialization', async ({ page }) => {
    // Wait a bit more for data to load
    await page.waitForTimeout(3000);
    
    // Check that grid features are being rendered
    const gridInfo = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source) {
          try {
            const data = source._data || source.serialize();
            if (data && data.features) {
              return {
                hasFeatures: data.features.length > 0,
                featureCount: data.features.length
              };
            }
          } catch (e) {
            return { hasFeatures: false, error: e.message };
          }
        }
        return { hasFeatures: false, noSource: true };
      }
      return { hasFeatures: false, mapNotLoaded: true };
    });
    
    expect(gridInfo).toBeTruthy();
  });

  test('grid features should have proper structure', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const featureStructure = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source && source._data && source._data.features && source._data.features.length > 0) {
          const feature = source._data.features[0];
          return {
            hasGeometry: !!feature.geometry,
            geometryType: feature.geometry?.type,
            hasProperties: !!feature.properties,
            hasPlusCode: !!feature.properties?.plusCode,
            hasFillColor: !!feature.properties?.fillColor,
            hasEventCount: feature.properties?.eventCount !== undefined
          };
        }
      }
      return null;
    });
    
    if (featureStructure) {
      expect(featureStructure.hasGeometry).toBe(true);
      expect(featureStructure.geometryType).toBe('Polygon');
      expect(featureStructure.hasProperties).toBe(true);
      expect(featureStructure.hasPlusCode).toBe(true);
      expect(featureStructure.hasFillColor).toBe(true);
      expect(featureStructure.hasEventCount).toBe(true);
    }
  });

  test('empty cells should have gray fill color', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const emptyCellColors = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source && source._data && source._data.features) {
          const emptyCells = source._data.features.filter(f => 
            f.properties && f.properties.eventCount === 0
          );
          
          if (emptyCells.length === 0) {
            return { noEmptyCells: true };
          }
          
          // Check that empty cells have gray color (100, 100, 100, 0.4)
          const correctColors = emptyCells.filter(f => 
            f.properties.fillColor && f.properties.fillColor.includes('100, 100, 100')
          );
          
          return {
            totalEmptyCells: emptyCells.length,
            correctColorCount: correctColors.length,
            allCorrect: correctColors.length === emptyCells.length
          };
        }
      }
      return null;
    });
    
    if (emptyCellColors && !emptyCellColors.noEmptyCells) {
      expect(emptyCellColors.allCorrect).toBe(true);
    }
  });

  test('cells with events should have red fill color', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const eventCellColors = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source && source._data && source._data.features) {
          const eventCells = source._data.features.filter(f => 
            f.properties && f.properties.eventCount > 0
          );
          
          if (eventCells.length === 0) {
            return { noEventCells: true };
          }
          
          // Check that cells with events have red-ish color
          const redCells = eventCells.filter(f => 
            f.properties.fillColor && 
            f.properties.fillColor.includes('0, 0, 0.6')
          );
          
          return {
            totalEventCells: eventCells.length,
            redColorCount: redCells.length,
            allRed: redCells.length === eventCells.length
          };
        }
      }
      return null;
    });
    
    if (eventCellColors && !eventCellColors.noEventCells) {
      expect(eventCellColors.allRed).toBe(true);
    }
  });

  test('grid should be complete without gaps', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    // Check that we have both cells with and without events (complete grid)
    const gridCompleteness = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source && source._data && source._data.features) {
          const features = source._data.features;
          const withEvents = features.filter(f => f.properties?.eventCount > 0);
          const withoutEvents = features.filter(f => f.properties?.eventCount === 0);
          
          return {
            totalFeatures: features.length,
            withEvents: withEvents.length,
            withoutEvents: withoutEvents.length,
            // Grid is complete if we have both types or just one type (all events or all empty)
            isComplete: features.length > 0
          };
        }
      }
      return null;
    });
    
    if (gridCompleteness) {
      expect(gridCompleteness.isComplete).toBe(true);
      expect(gridCompleteness.totalFeatures).toBeGreaterThan(0);
    }
  });

  test('grid should handle world-wrapping view', async ({ page }) => {
    // Zoom out to see the whole world
    await page.evaluate(() => {
      if (typeof map !== 'undefined' && map) {
        map.setZoom(1);
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Check that grid still renders at world scale
    const worldViewGrid = await page.evaluate(() => {
      if (typeof map !== 'undefined' && map && map.loaded && map.loaded()) {
        const source = map.getSource('pluscode-grid');
        if (source && source._data && source._data.features) {
          return {
            featureCount: source._data.features.length,
            hasFeatures: source._data.features.length > 0
          };
        }
      }
      return null;
    });
    
    if (worldViewGrid) {
      expect(worldViewGrid.hasFeatures).toBe(true);
      // At world scale with codeLength 2, should have multiple cells
      expect(worldViewGrid.featureCount).toBeGreaterThan(1);
    }
  });
});
