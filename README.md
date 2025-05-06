# nostroots: nostrifying trustroots

Trustroots is a social network of travelers and hosts that offer couches. Founded in 2014, 112k+ members now. We're working on moving this onto nostr, see e.g. https://nostr.net/. You can follow our progress on the trustroots blog: https://ideas.trustroots.org/category/nostr/

nostroots is an initiative to seamlessly transition Trustroots, the platform for sharing, hosting, and community building, onto the nostr network. By leveraging the unique decentralized and open-source nature of nostr, nostroots aims to enhance Trustroots' community-focused ethos with greater privacy, security, and user autonomy.

_Send us a DM at [nostrchat.io](https://www.nostrchat.io/dm/npub1lt6a968lk4h6yqduqnxcha628cudulgy8xk607c4xyxn6d6w6kcsmgp8hj)_

## Goals

The principal goal is to facilitate real world interactions.

The sub goal could be summarised as exit-to-ecosystem. That means, moving trustroots from a walled garden to part of a larger ecosystem of interconnected sites. People should be able to log into any of a few sites or projects and have their same contacts, same messages, and (most) of the same trust or reputation as they do on trustroots.

One side benefit, and a secondary sub goal, is to enable innovation. When somebody wants to start a project like couchers, ideally they can leverage the trustroots community to get started. Or a female only hospitality network. Or a private dumpster diver map.

One measure of success is that 70% of active trustroots users have used their nostr identity to login on at least one other site. This is important because we're ultimately trying to protect against administrator mismanagement. For that to be true, users not only need to have the theoretical opportunity to use their profile on another site, they must also know that this option exists. The best test of that is that they have actually done it. At the same time, we want to remain accessible to non technical users.

## Next steps

We are working on an app, for which there are now APKs available at https://github.com/Trustroots/nostroots/issues/80

This is a work in progress, based on our (deprecated) experiment with [notes.trustroots.org](https://notes.trustroots.org). Data is stored on nostr relays. The reasoning for a mobile application is to be able to provide the best possible use case on mobile. We reason that people will use the map primarily on mobile devices, and the experience is significantly better in a native app compared to a progressive web app.

The app should have a similar level of quality and polish as the trustroots site. Initially the app is an optional addition to the core trustroots experience, not mandatory. Users should be able to find hosts without installing an app.

The key features the app requires are:

- [x] Ability to post notes on an area of the map
  - [ ] Posted to an area, rather than a point
  - [ ] Could be seen as a forum post, an event invitation, or otherwise
  - [ ] The word note in this context means the nostr definition of a note
- [ ] Interactions between users
  - [ ] Potentially replies that are also public
  - [ ] At least for the foreseeable future, the map should support interactions over several months, so a person might post and then three months later another person might reply
- [ ] Notifications
  - [ ] If somebody replies to what you posted, you should be told
  - [ ] It should be possible to signup to be notified about anything that's posted in a given area

## Getting started

There are 4 parts to this code.

- `nr-common` - A module that is shared between the rest of the projects
- `nr-app` - An expo app
- `nr-server` - A deno application that is hosted by Trustroots
- `nr-push` - A Go application that handles push notifications for the app, code currently at https://github.com/trustroots/notification-daemon

Please refer to the READMEs in the respective subfolders for working on them.

## Roadmap

Goal: 70% of active Trustroots users are on Nostroots by middle of 2026
- active trustroots users: around 5K active within last month, 70% is around 3.5K ([Trustroots statistics](https://www.trustroots.org/statistics))
- "are on Nostroots": Have had a Nostroots experience means have some feature use that went well and is associated with Nostroots. The users don't need to recognize Nostr as the protocol, just that something is possible that wasn't before. This could be logging into a different site, transporting some of their network, or interacting with content from a different platform.

First step: Trial this in Berlin. Largest userbase, close to some of the developers.

200 yes/maybe hosts in Berlin. Around 1000 users. Estimate 5-10 people requesting hosting every week.

The technical side of things are manageable as long as we just care about Trustroots functionality. There are two big challenges for migrating our users.
- telling the story
- finding partners in the ecosystem.

### Telling the story
Trustroots [circles](https://www.trustroots.org/circles) around hippie, alternative, vanguard, experimental, left, gifting crowds. The 2024 Nostr userbase is generally cryptocurrency and privacy focused.

As far as our users are concerned, Trustroots is fine and nothing is broken. So a degradation of their experience will likely only lead to frustration. At best, we can justify inconvenience through appealing to the values of the community. The community also won't care that much about the admins' wish to make Trustroots more maintainable.

Trustroots users interact with the app when they're looking for something in a new city. That is the moment they're engaged and ready to be excited and we should find a story that works for them.  The core elements of this story should be:
- Trustroots was never meant to be just for hosting. It's meant to enable gifting and sharing based on trust and shared values.
- In a world of companies owning your identity online, Trustroots wants to empower you to own your own identity.
- There's more cool stuff like Trustroots in the world.

A lot of coordination around events and groups occurs on telegram, whatsapp and facebook, we think a nostr geo tool can do better.

See https://github.com/Trustroots/nostroots/issues/102 for ideas around partner orgs.


https://team.trustroots.org/nostr.html is the project's home page.

