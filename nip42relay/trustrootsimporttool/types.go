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
	TrustrootsUsernameLabelNamespace = "org.trustroots:username"
	profileClaimKind                 = 30390
	hostClaimKind                    = 30391
	relationClaimKind                = 30392
	experienceClaimKind              = 30393
	userMapNoteKind                  = 30397
	nip32LabelKind                   = 1985
	nip02FollowKind                  = 3
	nip51FollowSetKind               = 30000
	maxContentLength                 = 300
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
}

type User struct {
	ID               primitive.ObjectID `bson:"_id"`
	Username         string             `bson:"username"`
	DisplayName      string             `bson:"displayName"`
	Description      string             `bson:"description"`
	Avatar           string             `bson:"avatar"`
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
	ID     primitive.ObjectID `bson:"_id"`
	Label  string             `bson:"label"`
	Slug   string             `bson:"slug"`
	Public bool               `bson:"public"`
}

type HostRecord struct {
	Offer   Offer
	User    User
	Circles []string
}

type Contact struct {
	ID        primitive.ObjectID `bson:"_id"`
	UserID    primitive.ObjectID `bson:"user"`
	OtherID   primitive.ObjectID `bson:"contact"`
	CreatedAt time.Time          `bson:"createdAt"`
	Updated   time.Time          `bson:"updated"`
}

type ContactRecord struct {
	Contact Contact
	User    User
	Other   User
}

type Experience struct {
	ID             primitive.ObjectID `bson:"_id"`
	FromID         primitive.ObjectID `bson:"from"`
	ToID           primitive.ObjectID `bson:"to"`
	UserID         primitive.ObjectID `bson:"user"`
	TargetID       primitive.ObjectID `bson:"target"`
	AuthorID       primitive.ObjectID `bson:"author"`
	ReceiverID     primitive.ObjectID `bson:"receiver"`
	Text           string             `bson:"text"`
	Description    string             `bson:"description"`
	Public         bool               `bson:"public"`
	Visible        bool               `bson:"visible"`
	Hidden         bool               `bson:"hidden"`
	Recommendation string             `bson:"recommendation"`
	Recommend      recommendField     `bson:"recommend"`
	Positive       bool               `bson:"positive"`
	CreatedAt      time.Time          `bson:"createdAt"`
	Updated        time.Time          `bson:"updated"`
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
