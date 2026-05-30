package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type MatrixClient struct {
	homeserver  string
	accessToken string
	http        *http.Client
}

type MatrixMessage struct {
	EventID string
	Sender  string
	Body    string
	RoomID  string
}

type MatrixSyncResult struct {
	NextBatch string
	Messages  []MatrixMessage
}

func NewMatrixClient(homeserver, accessToken string) *MatrixClient {
	return &MatrixClient{
		homeserver:  strings.TrimRight(homeserver, "/"),
		accessToken: accessToken,
		http:        &http.Client{Timeout: 25 * time.Second},
	}
}

func (c *MatrixClient) ResolveRoomID(ctx context.Context, roomAlias string) (string, error) {
	path := "/_matrix/client/v3/directory/room/" + url.PathEscape(roomAlias)
	var resp struct {
		RoomID string `json:"room_id"`
	}
	if err := c.doJSON(ctx, http.MethodGet, path, &resp); err != nil {
		return "", err
	}
	if strings.TrimSpace(resp.RoomID) == "" {
		return "", fmt.Errorf("matrix room alias %s resolved to empty room_id", roomAlias)
	}
	return resp.RoomID, nil
}

func (c *MatrixClient) WhoAmI(ctx context.Context) (string, error) {
	var resp struct {
		UserID string `json:"user_id"`
	}
	if err := c.doJSON(ctx, http.MethodGet, "/_matrix/client/v3/account/whoami", &resp); err != nil {
		return "", err
	}
	if strings.TrimSpace(resp.UserID) == "" {
		return "", fmt.Errorf("matrix whoami returned empty user_id")
	}
	return resp.UserID, nil
}

func (c *MatrixClient) SyncRoomMessages(ctx context.Context, roomID, since string) (MatrixSyncResult, error) {
	vals := url.Values{}
	vals.Set("timeout", "0")
	if since != "" {
		vals.Set("since", since)
	}
	path := "/_matrix/client/v3/sync"
	if encoded := vals.Encode(); encoded != "" {
		path += "?" + encoded
	}

	var resp struct {
		NextBatch string `json:"next_batch"`
		Rooms     struct {
			Join map[string]struct {
				Timeline struct {
					Events []struct {
						EventID string `json:"event_id"`
						Sender  string `json:"sender"`
						Type    string `json:"type"`
						Content struct {
							MsgType string `json:"msgtype"`
							Body    string `json:"body"`
						} `json:"content"`
					} `json:"events"`
				} `json:"timeline"`
			} `json:"join"`
		} `json:"rooms"`
	}

	if err := c.doJSON(ctx, http.MethodGet, path, &resp); err != nil {
		return MatrixSyncResult{}, err
	}
	if strings.TrimSpace(resp.NextBatch) == "" {
		return MatrixSyncResult{}, fmt.Errorf("matrix /sync returned empty next_batch")
	}

	out := MatrixSyncResult{NextBatch: resp.NextBatch}
	room, ok := resp.Rooms.Join[roomID]
	if !ok {
		return out, nil
	}
	for _, ev := range room.Timeline.Events {
		if ev.Type != "m.room.message" {
			continue
		}
		if ev.Content.MsgType != "m.text" {
			continue
		}
		body := strings.TrimSpace(ev.Content.Body)
		if body == "" || strings.TrimSpace(ev.EventID) == "" {
			continue
		}
		out.Messages = append(out.Messages, MatrixMessage{
			EventID: ev.EventID,
			Sender:  strings.TrimSpace(ev.Sender),
			Body:    body,
			RoomID:  roomID,
		})
	}
	return out, nil
}

func FormatMatrixNote(msg MatrixMessage, roomAlias string) string {
	permalink := fmt.Sprintf("https://matrix.to/#/%s/%s", roomAlias, msg.EventID)
	return fmt.Sprintf("[matrix] %s: %s\n%s", msg.Sender, msg.Body, permalink)
}

func (c *MatrixClient) doJSON(ctx context.Context, method, path string, out any) error {
	url := c.homeserver + path
	req, err := http.NewRequestWithContext(ctx, method, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var er struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&er)
		if strings.TrimSpace(er.Error) != "" {
			return fmt.Errorf("matrix API %s %s failed: %s (%s)", method, path, resp.Status, er.Error)
		}
		return fmt.Errorf("matrix API %s %s failed: %s", method, path, resp.Status)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
