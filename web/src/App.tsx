import { Button, Typography } from "@mui/material";
import { Container } from "@mui/system";
import { getPublicKey } from "nostr-tools";
import { useEffect, useState } from "react";
import { getConfig } from "./services/config/config.service";
import {
  getNostrProfile,
  getOffers,
  NostrProfile,
  Offer,
  publishOffer,
  setNostrProfile,
} from "./services/nostr/nostr.service";

const addOfferFactory = (private_key: string) => () => {
  const name = globalThis.prompt("Name of your hospex offer?");
  const about = globalThis.prompt("Description of your offer?");
  const picture = globalThis.prompt("URL to a picture of your offer?");
  const location = globalThis.prompt(
    "Please enter a plus code to identify the location of your offer"
  );

  if (name === null || about === null || picture == null || location === null) {
    globalThis.alert(
      "Sorry, something failed. Please provide all 3 values. #PCXaE2"
    );
    return;
  }

  const offer = {
    name,
    about,
    picture,
    location,
  };

  publishOffer(private_key, offer);
};

function App() {
  const { private_key } = getConfig();
  const [profile, setProfile] = useState<NostrProfile>({});
  const [profileError, setProfileError] = useState("");

  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    getNostrProfile(getPublicKey(private_key))
      .then((profile) => {
        setProfile(profile);
      })
      .catch((error) => {
        setProfileError("Failed to load profile");
      });
  }, []);

  useEffect(() => {
    getOffers().then((offers) => {
      setOffers(offers);
    });
  }, []);

  return (
    <div className="App">
      <Container maxWidth="lg">
        <Typography variant="h1">Gifts on nostr</Typography>
        <Typography variant="h2">Keys</Typography>
        <Typography>Your private key is {private_key}</Typography>
        <Typography>Your public key is {getPublicKey(private_key)}</Typography>
        <Typography variant="h2">Profile</Typography>
        {typeof profile?.name === "string" ? (
          <div>
            <Typography>Name: {profile.name}</Typography>
            <Typography>About: {profile.about}</Typography>
            <Typography>Picture: {profile.picture}</Typography>
          </div>
        ) : profileError === "" ? (
          <div>Profile loading</div>
        ) : (
          <div>{profileError}</div>
        )}
        <Button
          variant="contained"
          onClick={async () => {
            const name = globalThis.prompt("Name?");
            const about = globalThis.prompt("About?");
            const picture = globalThis.prompt("Profile pic?");

            if (name === null || about === null || picture == null) {
              globalThis.alert(
                "Sorry, something failed. Please provide all 3 values. #QdnKpN"
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
        <Typography variant="h2">Offers</Typography>
        <div>
          <ul>
            {offers.map((offer, i) => (
              <li key={i}>
                {offer.name}, {offer.about}, {offer.location}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="contained" onClick={addOfferFactory(private_key)}>
          Add hospex offer
        </Button>
      </Container>
    </div>
  );
}

export default App;
