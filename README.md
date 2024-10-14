# nostroots: nostrifying trustroots

Trustroots is a social network of travelers and hosts that offer couches. Founded in 2014, 112k+ members now.  We're working on moving this onto nostr, see e.g. https://nostr.net/. You can follow our progress on the trustroots blog: https://ideas.trustroots.org/category/nostr/

nostroots is an initiative to seamlessly transition Trustroots, the platform for sharing, hosting, and community building, onto the nostr network. By leveraging the unique decentralized and open-source nature of nostr, nostroots aims to enhance Trustroots' community-focused ethos with greater privacy, security, and user autonomy.

## Goals

The principal goal is to facilitate real world interactions.

The sub goal could be summarised as exit-to-ecosystem. That means, moving trustroots from a walled garden to part of a larger ecosystem of interconnected sites. People should be able to log into any of a few sites or projects and have their same contacts, same messages, and (most) of the same trust or reputation as they do on trustroots.

One side benefit, and a secondary sub goal, is to enable innovation. When somebody wants to start a project like couchers, ideally they can leverage the trustroots community to get started. Or a female only hospitality network. Or a private dumpster diver map.

One measure of success is that 70% of active trustroots users have used their nostr identity to login on at least one other site. This is important because we're ultimately trying to protect against administrator mismanagement. For that to be true, users not only need to have the theoretical opportunity to use their profile on another site, they must also know that this option exists. The best test of that is that they have actually done it. At the same time, we want to remain accessible to non technical users.

## Next steps

Given the goals above, and our (deprecated) experiment with [notes.trustroots.org](https://notes.trustroots.org), the next step is to build a better map that uses nostr to move data around. This will take the form of a mobile application. The reasoning for a mobile application is to be able to provide the best possible use case on mobile. We reason that people will use the map primarily on mobile devices, and the experience is significantly better in a native app compared to a progressive web app.

The app should be on similar level of quality and polish as the trustroots site. The app should always be an optional addition to the core trustroots experience, but not mandatory. Users should be able to find hosts without installing an app.

The key features the app requires are:

- Ability to post notes on an area of the map
  - Posted to an area, rather than a point
  - Could be seen as a forum post, an event invitation, or otherwise
  - The word note in this context means the nostr definition of a note
- Interactions between users
  - Potentially replies that are also public
  - At least for the foreseeable future, the map should support interactions over several months, so a person might post and then three months later another person might reply
- Notifications
  - If somebody replies to what you posted, you should be told
  - It should be possible to signup to be notified about anything that's posted in a given area

----


## Background

Hospitality Club was the biggest hospex network in 2004, depended on one person, website down for large parts of 2023. CouchSurfing(tm) sold out to venture capital. Several other networks are based on proprietary software and/or charge money to be a member.   As networks grow there is a tendency to grow bureaucracies and budgets, which eventually lead to negative side effects such as usage fees, monetization of user data or too much reliance on donations.

We think it is worth our time and energy to work towards gift economy social networks that do not rely on any specific person or organization, so effectively we want to make ourselves redundant. 

The Nostr protocol is a decentralized, open network for social networking and messaging, using cryptographic keys for identity verification.

It is great there are now hospex networks running on open source free software that are free to use, apart from Trustroots there are also [BeWelcome](https://www.bewelcome.org/) and [Couchers.org](https://www.couchers.org/).

What is missing is more space for innovation and taking the gift economy into new directions.  Think bicycle sharing, access to awesome parties, ride shares.  Enabling Nostr on Trustroots will make it way easier for people with ideas to start off with a kickstart, just like Trustroots was kickstarted off Hitchwiki, but in a much smoother way.  The user's data *and* their connections become portable, so that projects like [Trip Hopping](https://www.triphopping.com/) can immediately be useful, even if you are the only user.


### How is Nostr different?

**Data Ownership:** In Nostr, users own their data. They can choose where to store it and which Nostr clients to use for interaction. This is in stark contrast to e.g. CouchSurfing(tm), where the company owns and controls user data, including its usage and monetization.

**Decentralization:** Unlike all existing hospitality networks, which are controlled by a single company or organization, Nostr is decentralized. It doesn't rely on a central server or entity. Instead, it operates through a network of independent servers, allowing for greater resistance to censorship and central control.

**Identity Verification:** Nostr uses cryptographic keys for identity verification. Each user has a unique pair of keys (public and private) for identity and authentication, contrasting with reliance on user-provided information like email or phone number that is used on almost all existing networks.



## FAQ

(edit this: improve, add questions, answers)

### Are you sure adopting new web technologies is a good idea for user experience?

"I've seen the sleepy.bike prototype from [OpenHospitalityNetwork](https://github.com/OpenHospitalityNetwork)  using Solid and I really think it's too much to expect from users to use decentralized web for now. I know even I would be reluctant on creating some "new tech account" just to use some hospitality website."

Generally we want to see an explosion of gift economy ideas… and all kinds of remixes of ideas around geo data, meeting people and organizing events.  Trustroots is good at hospitality, so for the foreseeable future we will keep this working as is. But the meet functionality is hardly used by anyone, and there is a lot of untapped potential around circles, and connecting this to for example Hitchwiki and maps.  We want to try to add Nostr functionality in this direction, without breaking the hospitality part, and in a way that it's easy for anyone to try to use or even build new things if they choose to.


### ActivityPub, Solid vs Nostr

ActivityPub heavily relies on specific domains and sysadmins running servers. Solid is similar, but the protocol is kinda W3C-bloat.  And there's no good profile portability.  So if your favorite ActivityPub/Solid hospex network goes rogue and you want to move elsewhere you are out of luck.

Note that https://gitlab.com/soapbox-pub/mostr is a project to bridge ActivityPub and Nostr.


### BeWelcome, couchers.org?

It would be great to at some point connect with BW and Couchers over Nostr.


### tokens, dao, blockchain, other scams?

If you see "nostr token", run away, it is a scam. There's no nostr token. There was no nostr ICO, nostr is not a DAO, there is no blockchain. Nostr makes it easy to integrate bitcoin lightning, which may at some point be helpful to for example keep out spammers. But this is not something we are interested in for the foreseeable future.



## Roadmap

Goal: 70% of active Trustroots users are on Nostroots by middle of 2026
- active trustroots users: around 5K active within last month, 70% is around 3.5K ([Trustroots statistics](https://www.trustroots.org/statistics))
- "are on Nostroots": Have had a Nostroots experience means have some feature use that went well and is associated with Nostroots. The users don't need to recognize Nostr as the protocol, just that something is possible that wasn't before. This could be logging into a different site, transporting some of their network, or interacting with content from a different platform.

First step: Trial this in Berlin. Largest userbase, close to some of the developers.

200 users in Berlin, likely around 30 active within the last 6 months. Probably around 5 people requesting hosting every week.


The technical side of things are manageable as long as we just care about Trustroots functionality. There are two big challenges for migrating our users.
- telling the story
- finding partners in the ecosystem.

### Telling the story
Trustroots users skew hippie, alternative, vanguard, experimental, left, gifting. The Nostr userbase is generally cryptocurrency and privacy focused.

As far as our users are concerned, Trustroots is fine and nothing is broken. So a degradation of their experience will likely only lead to frustration. At best, we can justify inconvenience through appealing to the values of the community. The community also won't care that much about the admins' wish to make Trustroots more maintainable.

Trustroots users interact with the app when they're looking for something in a new city. That is the moment they're engaged and ready to be excited and we should find a story that works for them.

Story:
- Trustroots was never meant to be just for hosting. It's meant to enable gifting and sharing based on trust and shared values.
- In a world of companies owning your identity online, Trustroots wants to empower you to own your own identity.
- There's more cool stuff like Trustroots in the world.


### Partners in the ecosystem
There are no good partner organisations in the ecosystem.

"Log in with trustroots" – forward.

What's the simplest login-with functionality we can implement?