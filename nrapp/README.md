# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Setup

### Alternative 1: pkgx - per session

Here's a quick way to set up each session:

```
sh <(curl https://pkgx.sh) +pnpm.io +watchman sh
```

(We recommend installing pkgx from [pkgx.dev](https://pkgx.sh/) for extra speed & goodies, but it's optional.)

### Alternative 2: manual - global & permanent

1. Install watchman (or equivalent on *nix)

   ```bash
   brew install watchman
   ```

2. Use nvm to set the correct node version. Make sure you have the appropriate version of node installed (`nvm i`).

   ```bash
   nvm use
   ```

3. Enable pnpm

   ```bash
   corepack enable pnpm
   ```

4. Install dependencies

   ```bash
   pnpm install
   ```

## Start

```bash
pnpm start
```

(If you get a `too many open files` error, `rm -rf node_modules; npm install` will [fix](https://github.com/Trustroots/nostroots/issues/30) this, funny enough.)

### View the app

You cannot (currently) view the app in the web. The maps package is not supported on web. The easiest option is to install an app called Expo Go into your phone. Then you can scan the QR code that was output in the terminal from the `pnpm start` command and the app will load onto your phone.

This requires that your phone and computer are on the same network, and that your phone can load the app from your computer.

You can also install Android Studio or XCode and then load the app in a simulator. That is beyond the scope of this readme, but [the expo docs](https://docs.expo.dev/get-started/set-up-your-environment/) are a good place to start.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
