package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	mapNoteRepostKind = 30398
	maxContentLength  = 300
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
	ID       primitive.ObjectID `bson:"_id"`
	Username string             `bson:"username"`
	Public   bool               `bson:"public"`
	Roles    []string           `bson:"roles"`
	Member   []Membership       `bson:"member"`
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

type State struct {
	Offers map[string]StateEntry `json:"offers"`
}

type StateEntry struct {
	EventID string `json:"eventId"`
	DTag    string `json:"dTag"`
	PubKey  string `json:"pubkey"`
}
