# Nostroots security

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue,
discussion, or pull request.

Report vulnerabilities using [GitHub's private vulnerability reporting][report]
for this repository.

Please include:

- the affected component and version or commit;
- a description of the vulnerability and its potential impact;
- steps to reproduce the issue;
- any proof-of-concept code, logs, or screenshots that help explain it;
- whether the vulnerability has been disclosed anywhere else.

Do not include private keys, personal data, or other users' information in the
report.

## Scope

This policy covers code maintained in this repository, including:

- the Nostroots web and mobile apps;
- Nostroots Browser;
- Nostroots relay and server components;
- push notification services;
- shared Nostroots libraries.

The current production deployments and the current default branch are
supported. Older builds and third-party Nostr clients, relays, extensions, and
services are generally outside the scope of this policy.

For vulnerabilities in Trustroots systems that are not maintained in this
repository, please use the security contact for the relevant Trustroots
project.

## What to expect

We will acknowledge the report after someone from the project has reviewed it.
We may ask for more information while reproducing and assessing the issue.

We will try to keep you informed about significant progress and coordinate
disclosure with you. Please give us a reasonable opportunity to investigate and
address the issue before publishing it.

This is a volunteer-run open source project, so we cannot guarantee a particular
response or remediation time.

## Research guidelines

When investigating a possible vulnerability:

- use your own accounts, keys, devices, and data;
- avoid accessing or changing another person's data;
- do not degrade the service or disrupt relays;
- do not send unsolicited messages or notifications;
- do not use social engineering;
- stop and report the issue if testing could affect other people or production
  data.

Good-faith research that follows these guidelines is appreciated.

## Bug bounties

We do not currently have a budget for security bug bounties. Trustroots is a
non-profit, open source, volunteer-based organisation.

[report]: https://github.com/Trustroots/nostroots/security/advisories/new
