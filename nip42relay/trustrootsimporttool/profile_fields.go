package main

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type profileLocation struct {
	Display string `json:"display"`
	City    string `json:"city,omitempty"`
	Country string `json:"country,omitempty"`
}

type profileClaimFields struct {
	Gender      string           `json:"gender,omitempty"`
	BirthDate   string           `json:"birthDate,omitempty"`
	MemberSince int64            `json:"memberSince,omitempty"`
	LivesIn     *profileLocation `json:"livesIn,omitempty"`
	From        *profileLocation `json:"from,omitempty"`
	Languages   []string         `json:"languages,omitempty"`
}

func normalizedAliasKey(raw string) string {
	if raw == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(raw))
	for _, r := range strings.ToLower(strings.TrimSpace(raw)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func rawValueByAliases(raw map[string]any, aliases ...string) (any, bool) {
	if len(raw) == 0 || len(aliases) == 0 {
		return nil, false
	}
	normAliases := make(map[string]struct{}, len(aliases))
	for _, alias := range aliases {
		norm := normalizedAliasKey(alias)
		if norm != "" {
			normAliases[norm] = struct{}{}
		}
	}
	if len(normAliases) == 0 {
		return nil, false
	}
	for key, value := range raw {
		if _, ok := normAliases[normalizedAliasKey(key)]; ok {
			return value, true
		}
	}
	return nil, false
}

func stringFromAny(value any) string {
	if value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	case primitive.ObjectID:
		if v.IsZero() {
			return ""
		}
		return v.Hex()
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", value))
	}
}

func timeFromAny(value any) (time.Time, bool) {
	switch v := value.(type) {
	case time.Time:
		if v.IsZero() {
			return time.Time{}, false
		}
		return v.UTC(), true
	case primitive.DateTime:
		t := v.Time().UTC()
		if t.IsZero() {
			return time.Time{}, false
		}
		return t, true
	case primitive.Timestamp:
		if v.T == 0 {
			return time.Time{}, false
		}
		return time.Unix(int64(v.T), 0).UTC(), true
	case int64:
		if v <= 0 {
			return time.Time{}, false
		}
		return unixCandidateToTime(v)
	case int32:
		if v <= 0 {
			return time.Time{}, false
		}
		return unixCandidateToTime(int64(v))
	case int:
		if v <= 0 {
			return time.Time{}, false
		}
		return unixCandidateToTime(int64(v))
	case float64:
		if v <= 0 {
			return time.Time{}, false
		}
		return unixCandidateToTime(int64(v))
	case float32:
		if v <= 0 {
			return time.Time{}, false
		}
		return unixCandidateToTime(int64(v))
	case string:
		s := strings.TrimSpace(v)
		if s == "" {
			return time.Time{}, false
		}
		if allDigits(s) {
			n, err := strconv.ParseInt(s, 10, 64)
			if err == nil && n > 0 {
				return unixCandidateToTime(n)
			}
		}
		for _, layout := range []string{time.RFC3339, "2006-01-02", "2006-01-02 15:04:05", "2006-01-02T15:04:05.000Z"} {
			if parsed, err := time.Parse(layout, s); err == nil {
				return parsed.UTC(), true
			}
		}
	}
	return time.Time{}, false
}

func unixCandidateToTime(value int64) (time.Time, bool) {
	if value <= 0 {
		return time.Time{}, false
	}
	// Treat 13+ digits as milliseconds.
	if value >= 1_000_000_000_000 {
		return time.UnixMilli(value).UTC(), true
	}
	return time.Unix(value, 0).UTC(), true
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func normalizedGender(value any) string {
	raw := strings.ToLower(strings.TrimSpace(stringFromAny(value)))
	if raw == "" {
		return ""
	}
	raw = strings.ReplaceAll(raw, "_", " ")
	raw = strings.ReplaceAll(raw, "-", " ")
	raw = strings.Join(strings.Fields(raw), " ")
	switch raw {
	case "m", "man", "male", "masculine", "cis man", "cis male":
		return "male"
	case "f", "woman", "female", "feminine", "cis woman", "cis female":
		return "female"
	case "nb", "nonbinary", "non binary", "non-binary":
		return "non-binary"
	default:
		return raw
	}
}

func normalizedLanguages(value any) []string {
	push := func(out []string, seen map[string]struct{}, candidate string) []string {
		s := strings.TrimSpace(candidate)
		if s == "" {
			return out
		}
		key := strings.ToLower(s)
		if _, ok := seen[key]; ok {
			return out
		}
		seen[key] = struct{}{}
		return append(out, s)
	}

	out := make([]string, 0, 4)
	seen := make(map[string]struct{}, 4)
	switch v := value.(type) {
	case []string:
		for _, row := range v {
			out = push(out, seen, row)
		}
	case bson.A:
		for _, row := range v {
			out = push(out, seen, stringFromAny(row))
		}
	case []any:
		for _, row := range v {
			out = push(out, seen, stringFromAny(row))
		}
	case string:
		parts := strings.FieldsFunc(v, func(r rune) bool {
			switch r {
			case ',', ';', '/', '|':
				return true
			default:
				return false
			}
		})
		if len(parts) == 0 {
			out = push(out, seen, v)
		} else {
			for _, row := range parts {
				out = push(out, seen, row)
			}
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func locationFromAny(value any) *profileLocation {
	finalize := func(display, city, country string) *profileLocation {
		display = strings.TrimSpace(display)
		city = strings.TrimSpace(city)
		country = strings.TrimSpace(country)
		if display == "" {
			switch {
			case city != "" && country != "":
				display = city + ", " + country
			case city != "":
				display = city
			case country != "":
				display = country
			}
		}
		if display == "" {
			return nil
		}
		row := &profileLocation{Display: display}
		if city != "" {
			row.City = city
		}
		if country != "" {
			row.Country = country
		}
		return row
	}

	switch v := value.(type) {
	case string:
		return finalize(v, "", "")
	case bson.M:
		display := stringFromAny(firstRawValue(v, "display", "formatted", "name", "label", "value", "text"))
		city := stringFromAny(firstRawValue(v, "city", "locality", "town"))
		country := stringFromAny(firstRawValue(v, "country", "countryName", "countryCode"))
		return finalize(display, city, country)
	case map[string]any:
		display := stringFromAny(firstRawValue(v, "display", "formatted", "name", "label", "value", "text"))
		city := stringFromAny(firstRawValue(v, "city", "locality", "town"))
		country := stringFromAny(firstRawValue(v, "country", "countryName", "countryCode"))
		return finalize(display, city, country)
	case bson.D:
		m := v.Map()
		return locationFromAny(map[string]any(m))
	}
	return nil
}

func firstRawValue(raw map[string]any, aliases ...string) any {
	v, ok := rawValueByAliases(raw, aliases...)
	if !ok {
		return nil
	}
	return v
}

func profileClaimFieldsFromUser(user User) profileClaimFields {
	out := profileClaimFields{}

	if rawGender, ok := rawValueByAliases(user.Raw, "gender", "sex", "userGender"); ok {
		out.Gender = normalizedGender(rawGender)
	}

	if rawBirthDate, ok := rawValueByAliases(user.Raw,
		"birthDate", "birthdate", "birthday", "dateOfBirth", "dob", "born", "birth_date",
	); ok {
		if ts, ok := timeFromAny(rawBirthDate); ok {
			out.BirthDate = ts.Format("2006-01-02")
		}
	}

	if !user.CreatedAt.IsZero() {
		out.MemberSince = user.CreatedAt.UTC().Unix()
	} else if rawMemberSince, ok := rawValueByAliases(user.Raw,
		"memberSince", "createdAt", "created", "joinedAt", "joinDate", "joinAt", "registeredAt", "registrationDate",
	); ok {
		if ts, ok := timeFromAny(rawMemberSince); ok {
			out.MemberSince = ts.Unix()
		}
	}

	if rawLivesIn, ok := rawValueByAliases(user.Raw,
		"livesIn", "locationCurrent", "currentLocation", "location", "cityCurrent", "displayLocation",
	); ok {
		out.LivesIn = locationFromAny(rawLivesIn)
	}
	if out.LivesIn == nil {
		city := ""
		if rawCity, ok := rawValueByAliases(user.Raw, "city", "locationCity", "locationcity"); ok {
			city = stringFromAny(rawCity)
		}
		country := ""
		if rawCountry, ok := rawValueByAliases(user.Raw, "country", "locationCountry", "locationcountry"); ok {
			country = stringFromAny(rawCountry)
		}
		out.LivesIn = locationFromAny(map[string]any{"city": city, "country": country})
	}

	if rawFrom, ok := rawValueByAliases(user.Raw,
		"from", "hometown", "homeTown", "locationFrom", "origin", "bornIn",
	); ok {
		out.From = locationFromAny(rawFrom)
	}
	if out.From == nil {
		city := ""
		if rawCity, ok := rawValueByAliases(user.Raw, "hometownCity", "fromCity", "homeCity"); ok {
			city = stringFromAny(rawCity)
		}
		country := ""
		if rawCountry, ok := rawValueByAliases(user.Raw, "hometownCountry", "fromCountry", "homeCountry"); ok {
			country = stringFromAny(rawCountry)
		}
		out.From = locationFromAny(map[string]any{"city": city, "country": country})
	}

	if rawLanguages, ok := rawValueByAliases(user.Raw,
		"languages", "language", "spokenLanguages", "speaks", "languagesSpoken", "langs", "lang",
	); ok {
		out.Languages = normalizedLanguages(rawLanguages)
	}

	return out
}

func appendProfileClaimFields(metadata map[string]any, user User) {
	if metadata == nil {
		return
	}
	fields := profileClaimFieldsFromUser(user)
	if fields.Gender != "" {
		metadata["gender"] = fields.Gender
	}
	if fields.BirthDate != "" {
		metadata["birthDate"] = fields.BirthDate
	}
	if fields.MemberSince > 0 {
		metadata["memberSince"] = fields.MemberSince
	}
	if fields.LivesIn != nil {
		metadata["livesIn"] = fields.LivesIn
	}
	if fields.From != nil {
		metadata["from"] = fields.From
	}
	if len(fields.Languages) > 0 {
		metadata["languages"] = fields.Languages
	}
}
