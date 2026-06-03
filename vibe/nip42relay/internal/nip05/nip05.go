package nip05

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

var ErrNoMatch = errors.New("nip05 pubkey does not match")

func (c Client) Verify(ctx context.Context, username, pubkey string) error {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" {
		return fmt.Errorf("username is empty")
	}

	u, err := url.Parse(c.BaseURL)
	if err != nil {
		return err
	}
	q := u.Query()
	q.Set("name", username)
	u.RawQuery = q.Encode()

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("nip05 lookup returned HTTP %d", resp.StatusCode)
	}

	var body struct {
		Names map[string]string `json:"names"`
		Error string            `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return err
	}
	if body.Error != "" {
		return errors.New(body.Error)
	}
	if strings.EqualFold(body.Names[username], pubkey) {
		return nil
	}
	return ErrNoMatch
}
