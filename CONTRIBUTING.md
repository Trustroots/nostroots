# Contributing to Nostroots

Thank you for helping. Nostroots is open source, released under the [GNU Affero General Public License v3](LICENSE), and contributions of all sizes are welcome: bug reports, ideas, documentation, tests and code.

Please read [PHILOSOPHY.md](PHILOSOPHY.md) first. We want interoperability, and we are deliberate about where our events and offers show up.

## Talk to us

We meet in person to develop, and contributors are welcome to talk to the team directly or join us during the in-person sprints. If you would like to get involved, say hello in an issue or send us a message (see the contact link in the [README](README.md)).

## Reporting bugs and suggesting ideas

- Search the existing issues first, to avoid duplicates.
- For a bug, say what you did, what you expected and what happened, with the app version or commit and your platform. A screenshot or log helps.
- For an idea, describe the problem you want to solve before the solution. Small ideas are fine as a short issue.
- Please do not report security vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).

## Making a change

1. For anything bigger than a small fix, open an issue or talk to us first, so we can agree on the direction before you spend time on it.
2. Fork the repository and work on a branch, not on `main`.
3. Keep the change focused: one topic per pull request.
4. Follow the existing code style and conventions of the package you are changing; each package has its own README.
5. Add or update tests where it makes sense, and make sure the existing tests pass.
6. Update the documentation when behaviour changes, for example [docs/Events.md](docs/Events.md) for anything touching event kinds.
7. Open a pull request that says what it does, links the issue, and is honest about what you tested and what you did not. Be open to feedback; reviews are a conversation.

## Proposing NIPs, new event kinds or integrations

A good proposal covers two things:

- **Fit with our ideals.** How does the proposal affect who sees members' content and offers? See [PHILOSOPHY.md](PHILOSOPHY.md).
- **Practical limits of the protocol.** Research the known limitations of the NIP or design you propose. Some NIPs turn out to be unfeasible for Nostroots because of them, so it helps to show that this has been looked at.

The rationale sections in [docs/Events.md](docs/Events.md) show the kind of reasoning we mean:

- [Why map notes use kind `30397` and not kind `1`](docs/Events.md#30397-map-note)
- [Why validation does not use NIP-32 labels](docs/Events.md#canonical-events-and-validation)
- [Why Plus Codes and not geohash](docs/Events.md#why-plus-codes-not-geohash)

Other kinds can be supported when needed, but this requires checking interoperability first, for example geohash versus Plus Codes for location.
