package main

import (
	"encoding/json"
	"errors"
	"os"
)

func loadState(path string) (State, error) {
	state := State{Offers: map[string]StateEntry{}}
	bytes, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(bytes) == 0 {
		return state, nil
	}
	if err := json.Unmarshal(bytes, &state); err != nil {
		return state, err
	}
	if state.Offers == nil {
		state.Offers = map[string]StateEntry{}
	}
	return state, nil
}

func saveState(path string, state State) error {
	bytes, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(bytes, '\n'), 0o600)
}

func staleEntries(previous State, current State) map[string]StateEntry {
	stale := map[string]StateEntry{}
	for offerID, entry := range previous.Offers {
		if _, ok := current.Offers[offerID]; !ok {
			stale[offerID] = entry
		}
	}
	return stale
}
