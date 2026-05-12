package main

import (
	"reflect"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestProfileClaimFieldsFromUser_AliasMapping(t *testing.T) {
	user := User{
		CreatedAt: time.Date(2020, 5, 21, 10, 11, 12, 0, time.UTC),
		Raw: bson.M{
			"sex":             "Male",
			"birthday":        "1974-03-11",
			"locationCurrent": bson.M{"city": "Pisa", "country": "Italy"},
			"locationFrom":    "Pisa, Italy",
			"spokenLanguages": "English, Esperanto;Italian/Spanish",
		},
	}

	got := profileClaimFieldsFromUser(user)
	if got.Gender != "male" {
		t.Fatalf("gender = %q", got.Gender)
	}
	if got.BirthDate != "1974-03-11" {
		t.Fatalf("birthDate = %q", got.BirthDate)
	}
	if got.MemberSince != user.CreatedAt.Unix() {
		t.Fatalf("memberSince = %d want %d", got.MemberSince, user.CreatedAt.Unix())
	}
	if got.LivesIn == nil || got.LivesIn.Display != "Pisa, Italy" || got.LivesIn.City != "Pisa" || got.LivesIn.Country != "Italy" {
		t.Fatalf("livesIn = %#v", got.LivesIn)
	}
	if got.From == nil || got.From.Display != "Pisa, Italy" {
		t.Fatalf("from = %#v", got.From)
	}
	wantLanguages := []string{"English", "Esperanto", "Italian", "Spanish"}
	if !reflect.DeepEqual(got.Languages, wantLanguages) {
		t.Fatalf("languages = %#v want %#v", got.Languages, wantLanguages)
	}
}

func TestProfileClaimFieldsFromUser_MemberSinceAliasFallback(t *testing.T) {
	joinedMs := int64(1589913600000)
	user := User{
		Raw: bson.M{
			"gender":      "female",
			"dateOfBirth": "1982-09-20T00:00:00Z",
			"joinedAt":    joinedMs,
			"languages":   bson.A{"English", "French", "english"},
		},
	}
	got := profileClaimFieldsFromUser(user)
	if got.MemberSince != time.UnixMilli(joinedMs).Unix() {
		t.Fatalf("memberSince = %d", got.MemberSince)
	}
	if got.BirthDate != "1982-09-20" {
		t.Fatalf("birthDate = %q", got.BirthDate)
	}
	if !reflect.DeepEqual(got.Languages, []string{"English", "French"}) {
		t.Fatalf("languages = %#v", got.Languages)
	}
}

func TestAppendProfileClaimFields_SkipsEmptyValues(t *testing.T) {
	meta := map[string]any{
		"name": "alice",
	}
	appendProfileClaimFields(meta, User{})
	if len(meta) != 1 {
		t.Fatalf("expected metadata unchanged, got %#v", meta)
	}
}
