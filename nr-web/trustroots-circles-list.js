/**
 * Trustroots circle slugs (tribes) for Nostr tags and nr-web UI — lowercase,
 * no ASCII hyphens (matches trustrootsimporttool `d` / `l` values).
 *
 * Keep aligned with Trustroots + kind 30410 circle directory imports.
 */
export const TRUSTROOTS_CIRCLE_SLUG_LIST = Object.freeze([
    'hosts',
    'hitch',
    'dumpsterdivers',
    'families',
    'musicians',
    'buskers',
    'veg',
    'hackers',
    'lgbtq',
    'ecoliving',
    'lindyhoppers',
    'nomads',
    'punks',
    'cyclists',
    'foodsharing',
    'yoga',
    'climbers',
    'hikers',
    'sailors',
    'artists',
    'rainbowgathering',
    'slackline',
    'spirituals',
    'dancers',
    'acroyoga',
    'jugglers',
    'vanlife',
    'volunteers',
    'winemakers',
    'squatters',
    'surfers',
    'skateboarders',
    'pilgrims',
    'photographers',
    'naturists',
    'motorcyclists',
    'feminists',
    'circus',
    'cooking',
    'burners',
    'beerbrewers',
    'anarchists',
    'gardeners',
    'scubadivers',
    'ravers',
    'zerowasters',
    'activists',
    'runners',
    'filmmakers',
    'books',
    'cypherpunks',
    'lightfoot'
]);

/** @returns {{ slug: string }[]} */
export function getTrustrootsCircleEntries() {
    return TRUSTROOTS_CIRCLE_SLUG_LIST.map((slug) => ({ slug }));
}
