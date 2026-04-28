package main

import (
	"context"
	"fmt"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func fetchHosts(ctx context.Context, mongoURI string, limit int64) ([]HostRecord, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		return nil, err
	}
	defer client.Disconnect(ctx)

	dbName := databaseNameFromURI(mongoURI)
	db := client.Database(dbName)
	offers := db.Collection("offers")

	filter := bson.M{
		"type":            "host",
		"status":          "yes",
		"locationFuzzy.0": bson.M{"$gte": -90, "$lte": 90},
		"locationFuzzy.1": bson.M{"$gte": -180, "$lte": 180},
		"$or": []bson.M{
			{"showOnlyInMyCircles": false},
			{"showOnlyInMyCircles": bson.M{"$exists": false}},
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

func fetchUser(ctx context.Context, db *mongo.Database, id primitive.ObjectID) (User, error) {
	var user User
	err := db.Collection("users").FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	return user, err
}

func fetchPublicCircleSlugs(ctx context.Context, db *mongo.Database, memberships []Membership) ([]string, error) {
	circles := make([]string, 0, len(memberships))
	for _, membership := range memberships {
		var tribe Tribe
		err := db.Collection("tribes").FindOne(ctx, bson.M{"_id": membership.Tribe, "public": true}).Decode(&tribe)
		if err == mongo.ErrNoDocuments {
			continue
		}
		if err != nil {
			return nil, err
		}
		circle := tribe.Slug
		if circle == "" {
			circle = tribe.Label
		}
		if circle != "" {
			circles = append(circles, circle)
		}
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
