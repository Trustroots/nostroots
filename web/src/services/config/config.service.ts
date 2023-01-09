import { generatePrivateKey } from "nostr-tools";

const KEY = "__trnostrConfig";

type Config = {
  private_key: string;
};

export const getConfig = (): Config => {
  const storedConfigJson = globalThis.localStorage.getItem(KEY);

  if (storedConfigJson === null) {
    const key = generatePrivateKey();
    const config = { private_key: key };
    const configJson = globalThis.JSON.stringify(config);
    globalThis.localStorage.setItem(KEY, configJson);

    return config;
  }

  const config = JSON.parse(storedConfigJson) as Config;
  return config;
};
