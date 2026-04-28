package main

import "testing"

func TestEncodePlusCode(t *testing.T) {
	code, err := encodePlusCode(52.5, 13.4)
	if err != nil {
		t.Fatal(err)
	}
	if code != "9F4MGC22+22" {
		t.Fatalf("encodePlusCode() = %q", code)
	}
}

func TestPlusCodePrefixes(t *testing.T) {
	got := plusCodePrefixes("9F4MGC22+22")
	want := []string{"9F000000+", "9F4M0000+", "9F4MGC00+", "9F4MGC22+"}
	if len(got) != len(want) {
		t.Fatalf("prefix count = %d", len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("prefix %d = %q, want %q", i, got[i], want[i])
		}
	}
}
