# nostroots: nostrifying trustroots

Trustroots is a social network of travelers and hosts that offer couches. Founded in 2014, 112k+ members now. We're working on moving this onto nostr, see e.g. https://nostr.net/. You can follow our progress on the trustroots blog: https://ideas.trustroots.org/category/nostr/

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

## Getting started

There are 3 parts to this code.

- `nr-common` - A module that is shared between the rest of the projects
- `nr-app` - An expo app
- `nr-server` - A deno application that is hosted by Trustroots
- `nr-push` - A Go application that handles push notifications for the app.

### Nostroots mobile app.

First, run `pnpm i` in the root directory.

The fastest way to get started is using Expo go:
In `nr-app`, run `pnpm run start` and choose Expo Go. You can try starting an emulator or simulator from here if you have it installed. Alternatively, install the Expo Go app on your mobile device and scan the QR code.

If you want to use a development build, you can switch to that by pressing `s`. Open an emulator or simulator with this build using the commands available.

If you want to run a development build on your phone, you'll have to download the latest app and scan the QR code with it. For Android, you can use an existing build from https://expo.dev/accounts/nostroots/projects/nr-app/builds/ . For iOS, you'd have to register your device first using `eas devices` and then make a build.

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


### Partners in the ecosystem 
We need platforms and communities that work in Berlin, are not money-focused, are valuable to travellers, and encourage personal connection and sharing. There are no good partner organisations in the current Nostr ecosystem. Our best bet will be supportive interested other groups that we build the tech for. So we need to build a good DX for adding logging in.

Possible groups and communities:
- [Bike Surf Berlin](bikesurf.org)
- Geocaching?
- [Couchers](couchers.org) and other hospex platforms
- related to [circles](https://www.trustroots.org/circles):
   - Semi-legal rave groups [circle](https://www.trustroots.org/circles/ravers)
   - [burners circle](https://www.trustroots.org/circles/burners)
   - foodsharing.de, [circle](https://www.trustroots.org/circles/foodsharing)
   - [acroyoga circle](https://www.trustroots.org/circles/acroyoga)
   - [lindyhop circle](https://www.trustroots.org/circles/lindyhoppers)
- [1NITE TENT](https://1nitetent.com/)


### Timeline
**Q4 2024:**
- Add functionality on main trustroots site to display and link recommended organisations in Berlin
  - possibly based on circles
  - track what gets clicked on
  - solicit experience reports and recs for other groups to display
  - minimally-invasive w/r/t to the existing messy codebase
- Build out Trustroots app
  - full notes functionality
  - ["login-with-trustroots" functionality](https://nips.nostr.com/46)
  - putting more profile data onto Nostr with opt-in, starting with Circles
  - experiment with nip-46 login with nip-05 flow

**Q1 2025:**
- Add login-with functionality to most promising one partner org
- Add more recommended orgs
- Solicit for some Berlin community management role?
- feed more data into the map and filter by Circles

**Q2 2025:**
- add nip-46 login to Trustroots app and begin encouraging users to store their nsec outside of the Trustroots app
- add login-with functionality to another partner org


### Log in with Nostr/Trustroots
#### User flow
- People search for something in Berlin
- A little sidebar informs them of other services in Berlin they might be interested in
  - it includes a mention of the app and ease of using them via the app.
- User downloads app.
- They're onboarded onto Nostr
  - private key generated and saved
  - public key nip-05 verified
  - (some) profile information published on the Nostr ecosystem (do we need extra consent here?).
- In the app, they can click on a link to an app [and get taken straight to the service](https://nips.nostr.com/46#direct-connection-initiated-by-remote-signer) onto the "edit account" page to fill in missing information.

#### Technical Flow:
- partner site embeds javascript we provide on their website
- partner site adds `login-with-nostr` endpoint to their API
- user clicks a "login with trustroots" button on 
- nip-46 flow is initiated
- server-side, sign-in gets verified and trustroots information parsed with a library we provide


---

## Background

Hospitality Club was the biggest hospex network in 2004, depended on one person, website down for large parts of 2023. CouchSurfing(tm) sold out to venture capital. Several other networks are based on proprietary software and/or charge money to be a member. As networks grow there is a tendency to grow bureaucracies and budgets, which eventually lead to negative side effects such as usage fees, monetization of user data or too much reliance on donations.

We think it is worth our time and energy to work towards gift economy social networks that do not rely on any specific person or organization, so effectively we want to make ourselves redundant.

The Nostr protocol is a decentralized, open network for social networking and messaging, using cryptographic keys for identity verification.

It is great there are now hospex networks running on open source free software that are free to use, apart from Trustroots there are also [BeWelcome](https://www.bewelcome.org/) and [Couchers.org](https://www.couchers.org/).

What is missing is more space for innovation and taking the gift economy into new directions. Think bicycle sharing, access to awesome parties, ride shares. Enabling Nostr on Trustroots will make it way easier for people with ideas to start off with a kickstart, just like Trustroots was kickstarted off Hitchwiki, but in a much smoother way. The user's data _and_ their connections become portable, so that projects like [Trip Hopping](https://www.triphopping.com/) can immediately be useful, even if you are the only user.

### How is Nostr different?

**Data Ownership:** In Nostr, users own their data. They can choose where to store it and which Nostr clients to use for interaction. This is in stark contrast to e.g. CouchSurfing(tm), where the company owns and controls user data, including its usage and monetization.

**Decentralization:** Unlike all existing hospitality networks, which are controlled by a single company or organization, Nostr is decentralized. It doesn't rely on a central server or entity. Instead, it operates through a network of independent servers, allowing for greater resistance to censorship and central control.

**Identity Verification:** Nostr uses cryptographic keys for identity verification. Each user has a unique pair of keys (public and private) for identity and authentication, contrasting with reliance on user-provided information like email or phone number that is used on almost all existing networks.

## FAQ

(edit this: improve, add questions, answers)

### Are you sure adopting new web technologies is a good idea for user experience?

"I've seen the sleepy.bike prototype from [OpenHospitalityNetwork](https://github.com/OpenHospitalityNetwork) using Solid and I really think it's too much to expect from users to use decentralized web for now. I know even I would be reluctant on creating some "new tech account" just to use some hospitality website."

Generally we want to see an explosion of gift economy ideas… and all kinds of remixes of ideas around geo data, meeting people and organizing events. Trustroots is good at hospitality, so for the foreseeable future we will keep this working as is. But the meet functionality was hardly used by anyone, and there is a lot of untapped potential around circles, and connecting this to for example Hitchwiki and maps. We want to try to add Nostr functionality in this direction, without breaking the hospitality part, and in a way that it's easy for anyone to try to use or even build new things if they choose to.

### ActivityPub, Solid vs Nostr

ActivityPub heavily relies on specific domains and sysadmins running servers. Solid is similar, but the protocol is kinda W3C-bloat. And there's no good profile portability. So if your favorite ActivityPub/Solid hospex network goes rogue and you want to move elsewhere you are out of luck.

Note that https://gitlab.com/soapbox-pub/mostr is a project to bridge ActivityPub and Nostr.

### Bluesky vs Nostr

We didn't dive into Bluesky but Cory Doctorow [wrote this](https://pluralistic.net/2024/11/02/ulysses-pact/#tie-yourself-to-a-federated-mast) about it:

> Bluesky lacks the one federated feature that is absolutely necessary for me to trust it: the ability to leave Bluesky and go to another host and continue to talk to the people I've entered into community with there. While there are many independently maintained servers that provide services to Bluesky and its users, there is only one Bluesky server. A federation of multiple servers, each a peer to the other, has been on Bluesky's roadmap for as long as I've been following it, but they haven't (yet) delivered it.

We also spoke to [Rabble](https://primal.net/rabble) in person and he brought up that the protocol itself is decided upon by Bluesky
in a very centralized way, focused on cloning X/Twitter, whereas Nostr NIPs are created by a wide range
of people building various different applications. 

### BeWelcome, couchers.org?

It would be great to at some point connect with BW and Couchers over Nostr. We're working on building these connections.

### tokens, dao, blockchain, other scams?

If you see "nostr token", run away, it is a scam. There's no nostr token. There was no nostr ICO, nostr is not a DAO, there is no blockchain. Nostr makes it easy to integrate bitcoin lightning, which may at some point be helpful to for example keep out spammers. But this is not something we are interested in for the foreseeable future.

### Why are you building an app?

Most of our users are travellers accessing the site from their phone. We think that UX with Nostr and self-managd keys will be challenging in the best of cases. We need the added functionalities of a native app to make the whole process accpeptably smooth. Native apps provide for better notification services, better location access, more reliable private key storage and backup, better interaction with other apps (e.g. for the purpose of logging in with a different app) and an overall smoother experience. Users almost universally prefer apps over mobile websites. Choosing to build one is putting their interests over the interests of the developers.

### How is this decentralized? Aren't you still controlling access?

In an ideal world, we'd just move Trustroots data onto Nostr, tell all our users to generate and store their private keys, and watch the beautiful decentralistion blossom. In this world, that plan doesn't work. Users will forget their keys, not understand what's going on, and be left frustrated by the experience. A perfect decentralisation that's unused does not actually achieve any of our goals.

We believe that we need to slowly introduce the idea of owning your own identity and introduce new possibilities on top of this, making sure that at any step along the way the excitement is bigger than the frustration. To this end, we will start by offering the users to maintain their private keys for them.  They can experience using the Trustroots app to interact with other parts of the Nostr ecosystem in ways that we sufficiently own to make sure their pleasant. Then, as the Nostr ecosystem develops, we will nudge them towards storing their identity in some other way and accessing Trustroots with that identity the same way they used their Trustroots-stored identity for other services in the past.

Similarly, we will initially do a lot of curating about what content is shown to users and slowly encourage them to place their own filters.

### How is this going to be appealing for hosts?

A lot of our roadmap is focused on the surfer experience. They'll be motivated to try out new tech because they're trying to have a good trip. Hosts, however, have no such incentive. But they're the life of the community! To reach them, we will have to focus on old-fashioned community work. We believe that hosts are the most committed to the values of sharing and gifting and will appreciate getting to know people or feeling connected with other people who share those values outside of the hospitality exchange sphere of things.

### Why aren't you working with existing Nostr kinds more?

We believe that the main benefit of Nostr comes from owning your data through owning your identity and the publicy-by-default nature of how that data is stored, making it easy to build services on top of existing data. We don't think that being able to easily pull in data from a different service type (e.g. a social media app) and display it in your own service is a big advantage. In fact, it's likely to cause a worse user experience because the pulled-in data doesn't quite match the style and vibe of the service that's doing the pulling. On top of this, using kinds that are controlled by someone else or a NIP severely reduces the innovation speed, and easy innovation is the most valuable aspet of the Nostr ecosystem right now.
