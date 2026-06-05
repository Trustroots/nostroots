package bridge

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

type GitHubClient struct {
	token string
	http  *http.Client
}

type GitHubCommit struct {
	SHA       string
	Message   string
	Author    string
	URL       string
	CreatedAt time.Time
}

func NewGitHubClient(token string) *GitHubClient {
	return &GitHubClient{
		token: token,
		http:  &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *GitHubClient) ListCommits(ctx context.Context, since time.Time) ([]GitHubCommit, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf(
			"https://api.github.com/repos/%s/%s/commits?sha=%s&since=%s&per_page=100",
			GithubRepoOwner,
			GithubRepoName,
			GithubBranch,
			since.UTC().Format(time.RFC3339),
		), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	if strings.TrimSpace(c.token) != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("github commits API returned %s", resp.Status)
	}

	var raw []struct {
		SHA     string `json:"sha"`
		HTMLURL string `json:"html_url"`
		Commit  struct {
			Message string `json:"message"`
			Author  struct {
				Name string `json:"name"`
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
		Author *struct {
			Login string `json:"login"`
		} `json:"author"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	commits := make([]GitHubCommit, 0, len(raw))
	for _, item := range raw {
		if strings.TrimSpace(item.SHA) == "" {
			continue
		}
		createdAt, _ := time.Parse(time.RFC3339, item.Commit.Author.Date)
		author := strings.TrimSpace(item.Commit.Author.Name)
		if item.Author != nil && strings.TrimSpace(item.Author.Login) != "" {
			author = "@" + strings.TrimSpace(item.Author.Login)
		}
		msg := strings.TrimSpace(item.Commit.Message)
		msg = strings.Split(msg, "\n")[0]
		commits = append(commits, GitHubCommit{
			SHA:       item.SHA,
			Message:   msg,
			Author:    author,
			URL:       strings.TrimSpace(item.HTMLURL),
			CreatedAt: createdAt,
		})
	}

	sort.Slice(commits, func(i, j int) bool {
		return commits[i].CreatedAt.Before(commits[j].CreatedAt)
	})
	return commits, nil
}

func FormatGitHubSummary(commits []GitHubCommit) string {
	if len(commits) == 0 {
		return ""
	}
	const maxLines = 12
	b := &strings.Builder{}
	fmt.Fprintf(b, "[github] %s/%s@%s: %d new commit(s)", GithubRepoOwner, GithubRepoName, GithubBranch, len(commits))
	limit := len(commits)
	if limit > maxLines {
		limit = maxLines
	}
	for i := 0; i < limit; i++ {
		c := commits[i]
		sha := c.SHA
		if len(sha) > 7 {
			sha = sha[:7]
		}
		fmt.Fprintf(b, "\n- %s %s", sha, c.Message)
		if c.Author != "" {
			fmt.Fprintf(b, " (%s)", c.Author)
		}
		if c.URL != "" {
			fmt.Fprintf(b, " %s", c.URL)
		}
	}
	if len(commits) > limit {
		fmt.Fprintf(b, "\n- ... and %d more", len(commits)-limit)
	}
	return b.String()
}
