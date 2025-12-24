package config

import (
	"encoding/json"
	"sync"
)

type ProxyMode string

const (
	ModeSplit   ProxyMode = "split"
	ModeUnified ProxyMode = "unified"
)

type ProxyConfig struct {
	Mode           ProxyMode `json:"mode"`
	TargetFrontend string    `json:"targetFrontend"`
	TargetBackend  string    `json:"targetBackend"`
	TargetUnified  string    `json:"targetUnified"`
	ChaosRoutes    []string  `json:"chaosRoutes"`

	LagToReq    int `json:"lagToReq"`
	LagToResp   int `json:"lagToResp"`
	BandwidthUp   int `json:"bandwidthUp"`
	BandwidthDown int `json:"bandwidthDown"`
	Jitter      int `json:"jitter"`
	FailureMode string `json:"failureMode"`
}

// Store handles thread-safe access to the config
type Store struct {
	mu     sync.RWMutex
	config ProxyConfig
}

func NewStore() *Store {
	return &Store{
		config: ProxyConfig{
			Mode: ModeSplit, // Default
		},
	}
}

// Get returns a snapshot of the current config
func (s *Store) Get() ProxyConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// Update updates the config safely
func (s *Store) Update(newConfig ProxyConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = newConfig
}

// LoadFromJSON helper for the API
func (s *Store) LoadFromJSON(data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return json.Unmarshal(data, &s.config)
}