# Nostroots philosophy

Nostroots moves Trustroots onto Nostr. This page explains the thinking behind that, so that contributors can judge whether a change fits. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose one.

## What we value

Trustroots was never meant to be only about hosting. It is about gifting and sharing, based on trust and on shared values. Nostroots should keep that spirit.

A main goal of this project is that no one can hold the community hostage, including us as maintainers. This is why we are introducing our members to a decentralized protocol: living with it is a gentle way to learn what digital sovereignty means, and to own your identity and your data.

## Protecting the community

Many Trustroots members are not technical, and most are used to centralized services that someone else runs and answers for. We want to protect that community and look after each person in it while we move together, step by step, toward something more open.

This is a long process and hard to steer. We want to take ourselves out of the loop as much as possible, but never at the expense of our users' safety. Where those two pull apart, safety comes first.

## Interoperability, with care

We want Nostroots to work with the wider Nostr ecosystem. Sharing identity, data and tools with other projects is part of why we build on Nostr, and we welcome the people and ideas it brings.

We are also deliberate about where members' content shows up. A free hosting offer is generous. When it appears in an ordinary Nostr feed, it may reach people who have not yet met the idea of a gift economy, and who may misunderstand it: as a classified listing, as a service for sale, or as something to take advantage of. That is not their fault, and it is not what the member intended. So we take care that content shared in a spirit of trust and generosity arrives where it can be understood that way.

## A test for reuse

Before content leaves Nostroots, or a new integration is added, ask: would the member who shared this be glad to see it there?

If the audience would not understand the spirit in which it was shared, the answer is no.

## In the code

The event design reflects this, for example in why map notes use kind `30397` instead of kind `1`. See the rationale sections in [docs/Events.md](docs/Events.md).
