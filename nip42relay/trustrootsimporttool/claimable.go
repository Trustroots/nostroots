package main

import "github.com/nbd-wtf/go-nostr"

const (
	claimableTagKey   = "claimable"
	claimableTagValue = "true"
)

func appendClaimableTag(tags *nostr.Tags) {
	if tags == nil {
		return
	}
	*tags = append(*tags, nostr.Tag{claimableTagKey, claimableTagValue})
}

