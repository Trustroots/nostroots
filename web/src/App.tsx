import { Button, Typography } from "@mui/material";
import { Container } from "@mui/system";
import { getPublicKey } from "nostr-tools";
import { useEffect, useState } from "react";
import { getConfig } from "./services/config/config.service";
import {
  getNostrProfile,
  NostrProfile,
  setNostrProfile,
} from "./services/nostr/nostr.service";

function App() {
  const { private_key } = getConfig();
  const [profile, setProfile] = useState<NostrProfile>({});
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    getNostrProfile(getPublicKey(private_key))
      .then((profile) => {
        setProfile(profile);
      })
      .catch((error) => {
        setProfileError("Failed to load profile");
      });
  }, []);

  return (
    <div className="App">
      <Container maxWidth="lg">
        <Typography>Your private key is {private_key}</Typography>
        <Typography>Your public key is {getPublicKey(private_key)}</Typography>
        {typeof profile?.name === "string" ? (
          <div>{JSON.stringify(profile)}</div>
        ) : profileError === "" ? (
          <div>Profile loading</div>
        ) : (
          <div>{profileError}</div>
        )}
        <Button
          onClick={async () => {
            const name = globalThis.prompt("Name?");
            const about = globalThis.prompt("About?");
            const picture = globalThis.prompt("Profile pic?");

            if (name === null || about === null || picture == null) {
              globalThis.alert(
                "Sorry, something failed. Please provide all 3 values."
              );
              return;
            }

            await setNostrProfile(private_key, {
              name,
              about,
              picture,
            });
          }}
        >
          Set profile
        </Button>
      </Container>
    </div>
  );
}

export default App;
