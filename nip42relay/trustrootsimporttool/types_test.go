package main

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestExperienceRecommendBSONTypes(t *testing.T) {
	cases := []struct {
		name string
		doc  bson.M
		yes  bool
	}{
		{"string yes", bson.M{"recommend": "yes"}, true},
		{"string no", bson.M{"recommend": "no"}, false},
		{"bool true", bson.M{"recommend": true}, true},
		{"bool false", bson.M{"recommend": false}, false},
		{"string recommended", bson.M{"recommend": "recommended"}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := bson.Marshal(tc.doc)
			if err != nil {
				t.Fatal(err)
			}
			var exp Experience
			if err := bson.Unmarshal(data, &exp); err != nil {
				t.Fatal(err)
			}
			if bool(exp.Recommend) != tc.yes {
				t.Fatalf("Recommend=%v want %v", exp.Recommend, tc.yes)
			}
		})
	}
}
