import { Typography } from "@mui/material";
import { Container } from "@mui/system";
import { getPublicKey } from "nostr-tools";
import { getConfig } from "./services/config/config.service";

function App() {
  const { private_key } = getConfig();

  return (
    <div className="App">
      <Container maxWidth="lg">
        <Typography>Your public key is {getPublicKey(private_key)}</Typography>
      </Container>
    </div>
  );
}

export default App;
