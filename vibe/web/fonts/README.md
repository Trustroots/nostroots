# Self-hosted fonts

These variable WOFF2 fonts replace the Google Fonts stylesheet requests while
preserving the existing typography. `fonts.css` contains local URLs, Unicode
subsets, and `font-display: swap`. Browsers fetch only the faces/subsets in use.

- Nunito: normal, weights 400–900 (Latin, Latin extended, Cyrillic, Cyrillic extended, Vietnamese)
- DM Sans: normal, weights 400–700 (Latin, Latin extended)
- Newsreader: normal, weights 500–650, optical sizes 6–72 (Latin, Latin extended, Vietnamese)

Downloaded 2026-10-13 from the Google Fonts CSS API, using the variable axis
ranges above. The upstream source and SIL Open Font License for each family:

- https://github.com/google/fonts/tree/main/ofl/nunito
- https://github.com/google/fonts/tree/main/ofl/dmsans
- https://github.com/google/fonts/tree/main/ofl/newsreader

The corresponding OFL license files are bundled here. Serve this directory
alongside the HTML pages; no build step or external font service is required.
