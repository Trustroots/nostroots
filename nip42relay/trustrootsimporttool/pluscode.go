package main

import (
	"fmt"
	"math"
	"strings"
)

const (
	plusCodeAlphabet  = "23456789CFGHJMPQRVWX"
	plusCodeSeparator = "+"
)

var pairResolutions = []float64{20, 1, 0.05, 0.0025, 0.000125}

func encodePlusCode(latitude, longitude float64) (string, error) {
	if latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 {
		return "", fmt.Errorf("coordinates out of range")
	}
	if latitude == 90 {
		latitude = math.Nextafter(90, 0)
	}
	longitude = normalizeLongitude(longitude)

	lat := latitude + 90
	lng := longitude + 180
	var builder strings.Builder

	for _, resolution := range pairResolutions {
		latDigit := int(math.Floor(lat / resolution))
		lngDigit := int(math.Floor(lng / resolution))
		latDigit = clampDigit(latDigit)
		lngDigit = clampDigit(lngDigit)
		builder.WriteByte(plusCodeAlphabet[latDigit])
		builder.WriteByte(plusCodeAlphabet[lngDigit])
		lat -= float64(latDigit) * resolution
		lng -= float64(lngDigit) * resolution
	}

	code := builder.String()
	return code[:8] + plusCodeSeparator + code[8:], nil
}

func clampDigit(digit int) int {
	if digit < 0 {
		return 0
	}
	if digit >= len(plusCodeAlphabet) {
		return len(plusCodeAlphabet) - 1
	}
	return digit
}

func normalizeLongitude(longitude float64) float64 {
	for longitude < -180 {
		longitude += 360
	}
	for longitude >= 180 {
		longitude -= 360
	}
	return longitude
}

func plusCodePrefixes(plusCode string) []string {
	raw := strings.ReplaceAll(plusCode, plusCodeSeparator, "")
	lengths := []int{2, 4, 6, 8}
	prefixes := make([]string, 0, len(lengths))
	seen := map[string]bool{}
	for _, length := range lengths {
		if len(raw) < length {
			continue
		}
		prefix := raw[:length]
		padded := prefix + strings.Repeat("0", 8-length) + plusCodeSeparator
		if !seen[padded] {
			prefixes = append(prefixes, padded)
			seen[padded] = true
		}
	}
	return prefixes
}
