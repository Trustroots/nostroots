# NIP-46 Client Login Implementation

This folder contains the implementation of basic NIP-46 login for a
sample external site located in `development-utils/nip-46-client`.

## Getting Started

To run the service, navigate to this folder and execute the following
command:

```bash
deno task start
```

Once the service is running, follow the instructions provided on the
website.

### How It Works

When you make a request to the server (e.g., by loading the page), a
temporary keypair and secret are generated. This information is
displayed in the `nostrconnect://` string. The application utilizes
this string to determine the appropriate actions and sends a signed
acknowledgment ("ack") to indicate that the user approves the login
and possesses the secret key corresponding to the public key.

In the context of NIP-46, this process is referred to as a "Direct
connection initiated by the client."

## Next Steps

Future enhancements include implementing NIP-5 to verify the public
key and exploring the option for initiating the connection via the
signer. This could involve entering your Trustroots username and
receiving a push notification to the app to commence the sign-in
process.
