# Nostroots philosophy

Nostroots moves Trustroots onto Nostr. This page explains the thinking behind that, so that contributors can judge whether a change fits. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose one.

## What we value

Trustroots was never meant to be only about hosting. It is about gifting and sharing, based on trust and on shared values. Nostroots should keep that spirit, and give members ownership of their own identity.

## Protecting the community

We want to protect the existing Trustroots community while gradually moving it onto decentralized platforms. This is a long process and hard to steer. We want to take ourselves out of the loop as much as possible, but never at the expense of our users' safety.

## Interoperability, with care

We want Nostroots to work with the wider Nostr ecosystem. Sharing identity, data and tools with other projects is part of why we build on Nostr.

We are also deliberate about where members' content shows up. A free hosting offer is generous, and it does not belong in classified listings, where readers would not understand it as a gift.

## A test for reuse

Before content leaves Nostroots, or a new integration is added, ask: would the member who shared this be glad to see it there?

If the audience would not understand the spirit in which it was shared, the answer is no.

## In the code

The event design reflects this, for example in why map notes use kind `30397` instead of kind `1`. See the rationale sections in [docs/Events.md](docs/Events.md).
