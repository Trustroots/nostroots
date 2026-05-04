package main

import (
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// recommendField decodes Trustroots experience.recommend, which may be stored as
// a boolean or (legacy) string in MongoDB.
type recommendField bool

func recommendTruthFromString(s string) bool {
	v := strings.ToLower(strings.TrimSpace(s))
	switch v {
	case "yes", "true", "1", "positive", "recommend", "recommended", "vouch":
		return true
	default:
		return false
	}
}

func (r *recommendField) UnmarshalBSONValue(t bsontype.Type, data []byte) error {
	raw := bson.RawValue{Type: t, Value: data}
	switch t {
	case bsontype.Boolean:
		var b bool
		if err := raw.Unmarshal(&b); err != nil {
			return err
		}
		*r = recommendField(b)
		return nil
	case bsontype.String:
		var s string
		if err := raw.Unmarshal(&s); err != nil {
			return err
		}
		*r = recommendField(recommendTruthFromString(s))
		return nil
	case bsontype.Null, bsontype.Undefined:
		*r = false
		return nil
	default:
		return fmt.Errorf("unsupported BSON type for recommend: %v", t)
	}
}

const (
	mapNoteRepostKind                = 30398
	profileClaimKind                 = 30390
	relationClaimKind                = 30392
	experienceClaimKind              = 30393
	circleMetadataKind               = 30410
	maxContentLength                 = 300
	TrustrootsUsernameLabelNamespace = "org.trustroots:username"
	trustrootsCircleLabelNamespace   = "trustroots-circle"
)

type Offer struct {
	ID                  primitive.ObjectID `bson:"_id"`
	Type                string             `bson:"type"`
	Status              string             `bson:"status"`
	Description         string             `bson:"description"`
	LocationFuzzy       []float64          `bson:"locationFuzzy"`
	Updated             time.Time          `bson:"updated"`
	CreatedAt           time.Time          `bson:"createdAt"`
	UserID              primitive.ObjectID `bson:"user"`
	ShowOnlyInMyCircles bool               `bson:"showOnlyInMyCircles"`
	MaxGuests           int                `bson:"maxGuests"`
	ValidUntil          *time.Time         `bson:"validUntil"`
}

type User struct {
	ID               primitive.ObjectID `bson:"_id"`
	Username         string             `bson:"username"`
	DisplayName      string             `bson:"displayName"`
	Description      string             `bson:"description"`
	Avatar           string             `bson:"avatar"`
	// Trustroots user.server.model.js — used when `avatar` is absent to build kind 30390 `picture`.
	AvatarSource   string    `bson:"avatarSource"`
	AvatarUploaded bool      `bson:"avatarUploaded"`
	EmailHash      string    `bson:"emailHash"`
	Updated        time.Time `bson:"updated"`
	NostrNpub        string             `bson:"nostrNpub"`
	Public           bool               `bson:"public"`
	EmailConfirmed   *bool              `bson:"emailConfirmed"`
	EmailUnconfirmed bool               `bson:"emailunconfirmed"`
	Roles            []string           `bson:"roles"`
	Member           []Membership       `bson:"member"`
}

type Membership struct {
	Tribe primitive.ObjectID `bson:"tribe"`
}

type Tribe struct {
	ID          primitive.ObjectID `bson:"_id"`
	Label       string             `bson:"label"`
	Slug        string             `bson:"slug"`
	Public      bool               `bson:"public"`
	Description string             `bson:"description"`
	Image       bool               `bson:"image"`
	Color       string             `bson:"color"`
}

type HostRecord struct {
	Offer   Offer
	User    User
	Circles []string
}

// Contact matches Trustroots modules/contacts/server/models/contacts.server.model.js
type Contact struct {
	ID        primitive.ObjectID `bson:"_id"`
	UserFrom  primitive.ObjectID `bson:"userFrom"`
	UserTo    primitive.ObjectID `bson:"userTo"`
	Confirmed bool               `bson:"confirmed"`
	Created   time.Time          `bson:"created"`
}

type ContactRecord struct {
	Contact Contact
	User    User
	Other   User
}

// Experience matches Trustroots modules/experiences/server/models/experiences.server.model.js
type Experience struct {
	ID             primitive.ObjectID `bson:"_id"`
	UserFrom       primitive.ObjectID `bson:"userFrom"`
	UserTo         primitive.ObjectID `bson:"userTo"`
	Public         bool               `bson:"public"`
	Visible        bool               `bson:"visible"`
	Hidden         bool               `bson:"hidden"`
	Recommendation string           `bson:"recommendation"`
	Recommend      recommendField     `bson:"recommend"`
	Positive       bool               `bson:"positive"`
	FeedbackPublic string             `bson:"feedbackPublic"`
	Interactions   struct {
		Met   bool `bson:"met"`
		Guest bool `bson:"guest"`
		Host  bool `bson:"host"`
	} `bson:"interactions"`
	Created time.Time `bson:"created"`
}

type ExperienceRecord struct {
	Experience Experience
	Author     User
	Target     User
}

type State struct {
	Offers map[string]StateEntry `json:"offers"`
}

type StateEntry struct {
	EventID string `json:"eventId"`
	DTag    string `json:"dTag"`
	PubKey  string `json:"pubkey"`
}
