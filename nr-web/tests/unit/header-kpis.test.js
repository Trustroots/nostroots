import { describe, it, expect } from 'vitest';
import {
    computeHeaderKpiCounts,
    formatHeaderRelaysOnlineKpi,
    getHeaderKpiKeysForViewport,
} from '../../index.js';

describe('header KPI helpers', () => {
    it('computeHeaderKpiCounts counts only map note kinds and 24h window', () => {
        const now = 1_700_000_000;
        const events = [
            { kind: 30397, created_at: now - 5 },
            { kind: 30398, created_at: now - 20 },
            { kind: 30397, created_at: now - 86_400 }, // boundary: included
            { kind: 30397, created_at: now - 90_000 }, // outside window
            { kind: 0, created_at: now - 1 },
            { kind: 5, created_at: now - 1 },
        ];
        const result = computeHeaderKpiCounts(events, now);
        expect(result).toEqual({
            notesLoaded: 4,
            newNotes24h: 3,
        });
    });

    it('formatHeaderRelaysOnlineKpi formats x/y safely', () => {
        expect(formatHeaderRelaysOnlineKpi(0, 3)).toBe('0/3');
        expect(formatHeaderRelaysOnlineKpi(2, 3)).toBe('2/3');
        expect(formatHeaderRelaysOnlineKpi(3, 3)).toBe('3/3');
        expect(formatHeaderRelaysOnlineKpi(-1, 2)).toBe('0/2');
    });

    it('getHeaderKpiKeysForViewport returns compact and desktop sets', () => {
        expect(getHeaderKpiKeysForViewport(true)).toEqual([
            'newNotes24h',
            'relaysOnline',
        ]);
        expect(getHeaderKpiKeysForViewport(false)).toEqual([
            'newNotes24h',
            'notesLoaded',
            'subscribedAreas',
            'relaysOnline',
        ]);
    });
});
