package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// mongoClientTimeout caps how long we wait when MongoDB is unreachable (driver
// defaults are much slower, often ~30s for server selection).
const mongoClientTimeout = 5 * time.Second

func newMongoClientOptions(uri string) *options.ClientOptions {
	return options.Client().
		ApplyURI(uri).
		SetConnectTimeout(mongoClientTimeout).
		SetServerSelectionTimeout(mongoClientTimeout)
}

func fetchHosts(ctx context.Context, mongoURI string, limit int64) ([]HostRecord, error) {
	client, err := mongo.Connect(ctx, newMongoClientOptions(mongoURI))
	if err != nil {
		return nil, err
	}
	defer client.Disconnect(ctx)

	dbName := databaseNameFromURI(mongoURI)
	db := client.Database(dbName)
	offers := db.Collection("offers")

	// Align with Trustroots offer schema: only real host capacity, not expired windows.
	now := time.Now()
	filter := bson.M{
		"$and": []bson.M{
			{
				"type":            "host",
				"status":          bson.M{"$in": []string{"yes", "maybe"}},
				"maxGuests":       bson.M{"$gt": 0},
				"locationFuzzy.0": bson.M{"$gte": -90, "$lte": 90},
				"locationFuzzy.1": bson.M{"$gte": -180, "$lte": 180},
			},
			{
				"$or": []bson.M{
					{"showOnlyInMyCircles": false},
					{"showOnlyInMyCircles": bson.M{"$exists": false}},
				},
			},
			{
				"$or": []bson.M{
					{"validUntil": bson.M{"$exists": false}},
					{"validUntil": nil},
					{"validUntil": bson.M{"$gte": now}},
				},
			},
		},
	}
	findOptions := options.Find().SetSort(bson.D{{Key: "_id", Value: 1}})
	if limit > 0 {
		findOptions.SetLimit(limit)
	}
	cursor, err := offers.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var records []HostRecord
	for cursor.Next(ctx) {
		var offer Offer
		if err := cursor.Decode(&offer); err != nil {
			return nil, err
		}
		user, err := fetchUser(ctx, db, offer.UserID)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				// Some legacy offers reference missing users; skip them.
				continue
			}
			return nil, err
		}
		if !isEligibleHost(offer, user) {
			continue
		}
		circles, err := fetchPublicCircleSlugs(ctx, db, user.Member)
		if err != nil {
			return nil, err
		}
		records = append(records, HostRecord{
			Offer:   offer,
			User:    user,
			Circles: circles,
		})
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func openMongo(ctx context.Context, mongoURI string) (*mongo.Client, *mongo.Database, error) {
	client, err := mongo.Connect(ctx, newMongoClientOptions(mongoURI))
	if err != nil {
		return nil, nil, err
	}
	dbName := databaseNameFromURI(mongoURI)
	return client, client.Database(dbName), nil
}

func fetchEligibleUsers(ctx context.Context, db *mongo.Database) ([]User, map[primitive.ObjectID]User, error) {
	cursor, err := db.Collection("users").Find(ctx, bson.M{"public": true}, options.Find().SetSort(bson.D{{Key: "_id", Value: 1}}))
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)

	list := make([]User, 0, 1024)
	byID := make(map[primitive.ObjectID]User, 1024)
	for cursor.Next(ctx) {
		var user User
		if err := cursor.Decode(&user); err != nil {
			return nil, nil, err
		}
		if !isEligibleUser(user) {
			continue
		}
		list = append(list, user)
		byID[user.ID] = user
	}
	if err := cursor.Err(); err != nil {
		return nil, nil, err
	}
	return list, byID, nil
}

func fetchContactRecords(ctx context.Context, db *mongo.Database, limit int64) ([]ContactRecord, error) {
	findOptions := options.Find().SetSort(bson.D{{Key: "_id", Value: 1}})
	if limit > 0 {
		findOptions.SetLimit(limit)
	}
	cursor, err := db.Collection("contacts").Find(ctx, bson.M{}, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	records := make([]ContactRecord, 0, 1024)
	for cursor.Next(ctx) {
		var contact Contact
		if err := cursor.Decode(&contact); err != nil {
			return nil, err
		}
		user, errU := fetchUser(ctx, db, contact.UserFrom)
		if errU == mongo.ErrNoDocuments {
			continue
		}
		if errU != nil {
			return nil, errU
		}
		other, errO := fetchUser(ctx, db, contact.UserTo)
		if errO == mongo.ErrNoDocuments {
			continue
		}
		if errO != nil {
			return nil, errO
		}
		if !isRelaxedTrustrootsUser(user) || !isRelaxedTrustrootsUser(other) {
			continue
		}
		if !hasValidNpub(user) && !hasValidNpub(other) {
			continue
		}
		records = append(records, ContactRecord{
			Contact: contact,
			User:    user,
			Other:   other,
		})
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func fetchExperienceRecords(ctx context.Context, db *mongo.Database, limit int64) ([]ExperienceRecord, error) {
	findOptions := options.Find().SetSort(bson.D{{Key: "_id", Value: 1}})
	if limit > 0 {
		findOptions.SetLimit(limit)
	}
	cursor, err := db.Collection("experiences").Find(ctx, bson.M{}, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	records := make([]ExperienceRecord, 0, 1024)
	for cursor.Next(ctx) {
		var experience Experience
		if err := cursor.Decode(&experience); err != nil {
			return nil, err
		}
		if !isPositiveExperience(experience) {
			continue
		}
		authorID := experience.UserFrom
		targetID := experience.UserTo
		author, errA := fetchUser(ctx, db, authorID)
		if errA == mongo.ErrNoDocuments {
			continue
		}
		if errA != nil {
			return nil, errA
		}
		target, errT := fetchUser(ctx, db, targetID)
		if errT == mongo.ErrNoDocuments {
			continue
		}
		if errT != nil {
			return nil, errT
		}
		if !isRelaxedTrustrootsUser(author) || !isRelaxedTrustrootsUser(target) {
			continue
		}
		if !hasValidNpub(author) && !hasValidNpub(target) {
			continue
		}
		records = append(records, ExperienceRecord{
			Experience: experience,
			Author:     author,
			Target:     target,
		})
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return records, nil
}

func fetchUser(ctx context.Context, db *mongo.Database, id primitive.ObjectID) (User, error) {
	var user User
	err := db.Collection("users").FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	return user, err
}

func fetchPublicTribes(ctx context.Context, db *mongo.Database) ([]Tribe, error) {
	cursor, err := db.Collection("tribes").Find(ctx, bson.M{"public": true}, options.Find().SetSort(bson.D{{Key: "slug", Value: 1}, {Key: "label", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var out []Tribe
	for cursor.Next(ctx) {
		var tribe Tribe
		if err := cursor.Decode(&tribe); err != nil {
			return nil, err
		}
		out = append(out, tribe)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchPublicCircleSlugs(ctx context.Context, db *mongo.Database, memberships []Membership) ([]string, error) {
	circles := make([]string, 0, len(memberships))
	seen := make(map[string]struct{}, len(memberships))
	for _, membership := range memberships {
		var tribe Tribe
		err := db.Collection("tribes").FindOne(ctx, bson.M{"_id": membership.Tribe, "public": true}).Decode(&tribe)
		if err == mongo.ErrNoDocuments {
			continue
		}
		if err != nil {
			return nil, err
		}
		// Same normalization as kind 30410 / 30398 tags (trustrootsCircleSlugForNostr): hyphen-free
		// slugs so JSONL `circles` matches `d` / `l` / `t` on exported events.
		circle := trustrootsCircleSlugForNostr(tribe.Slug)
		if circle == "" {
			continue
		}
		if _, dup := seen[circle]; dup {
			continue
		}
		seen[circle] = struct{}{}
		circles = append(circles, circle)
	}
	return circles, nil
}

func databaseNameFromURI(uri string) string {
	trimmed := strings.TrimRight(uri, "/")
	lastSlash := strings.LastIndex(trimmed, "/")
	if lastSlash == -1 || lastSlash == len(trimmed)-1 {
		return "trustroots"
	}
	dbName := trimmed[lastSlash+1:]
	if question := strings.Index(dbName, "?"); question >= 0 {
		dbName = dbName[:question]
	}
	if dbName == "" {
		return "trustroots"
	}
	return dbName
}

func validatePrivateKey(privateKey string) error {
	if len(privateKey) != 64 {
		return fmt.Errorf("invalid NSEC: expected decoded secret key to be 64 hex characters")
	}
	for _, char := range privateKey {
		if !strings.ContainsRune("0123456789abcdefABCDEF", char) {
			return fmt.Errorf("invalid NSEC: decoded secret key must be hex")
		}
	}
	return nil
}
