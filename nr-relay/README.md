## nr-relay

This is a docker container built on top of strfry which adds a simple strfry
plugin into the container which converts the strfry stdin / stdout plugin format
into an HTTP request.

- The plugin reads a URL from the env var `PLUGIN_HTTP_URL`
- For every line received via stdin, it sends one HTTP request to that URL with
  the line as the body
- Whatever it receives as a response, it outputs to stdout
- If it fails to reach the URL, or it receives a non 200 response, then it will
  try to issue a reject message to strfry over stdout
