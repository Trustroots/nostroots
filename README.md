# nostroots: nostrifying trustroots

Trustroots is a social network of travelers and hosts that offer couches. Founded in 2014, 105k+ members now.  We're working on moving this onto nostr, see e.g. https://nostr.net/

nostroots is an initiative to seamlessly transition Trustroots, the platform for sharing, hosting, and community building, onto the nostr network. By leveraging the unique decentralized and open-source nature of nostr, nostroots aims to enhance Trustroots' community-focused ethos with greater privacy, security, and user autonomy.

So we need to get to a point where we have:

1. a nostr app for hospitality exchange
2. a relay server that offers the features we want, e.g. NIP-42

By moving onto Nostr development will become distributed and not centralized like it is now, so everyone can volunteer in their own autonomous way and with whomever they please.


## current status

- experiments and ideas
- collective coming near Berlin, May 2024 [#11](https://github.com/Trustroots/nostroots/issues/11)
- possibility to make it a bit more real thru NIP-05 support on trustroots.org [#4](https://github.com/Trustroots/nostroots/issues/4)

## nostroots app 

- basic hospitality app
- fork off [an existing nostr app](https://www.nostr.net/)?
- how to do profiles?


## nostroots relay

Limited access to the nostroots relay

- you can only post if you have credentials
- you can only read if you have credentials, [NIP-42](https://github.com/Trustroots/nostroots/issues/9)
- users can additionally choose to connect to other relay servers


There’s already authenticated relays. So only authenticated users can post.


## Goals

sufficient decentralization:
- anyone can run and fork the relay server
- anyone can fork app


### ideas

We could even cut off signups for the relay and let other folks take over. Force decentralisation politically, but might not be necessary.



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

It would be great to at some point connect with BW and Couchers over Nostr, but it seems unlikely this could happen anytime soon. 

### tokens, dao, blockchain, other scams?

If you see "nostr token", run away, it is a scam. There's no nostr token. There was no nostr ICO, nostr is not a DAO, there is no blockchain. Nostr makes it easy to integrate bitcoin lightning, which may at some point be helpful to for example keep out spammers. But this is not something we are interested in for the foreseeable future.


