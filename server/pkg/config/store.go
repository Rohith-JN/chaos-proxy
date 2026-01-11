package config

import (
	"sync"
)

type ProxyMode string

const (
	ModeSplit   ProxyMode = "split"
	ModeUnified ProxyMode = "unified"
)

type StatusRule struct {
	ID          string `json:"id"`
	PathPattern string `json:"pathPattern"`
	StatusCode  int    `json:"statusCode"`
	ErrorRate   int    `json:"errorRate"` // 0-100
}

type HeaderRules struct {
	StripCORS          bool `json:"stripCORS"`
	StripCache         bool `json:"stripCache"`
	CorruptContentType bool `json:"corruptContentType"`
}

type MockRule struct {
	ID          string `json:"id"`
	PathPattern string `json:"pathPattern"` 
	Body        string `json:"body"`
	Active      bool   `json:"active"`
}

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

	StatusRules []StatusRule `json:"statusRules"`
	HeaderRules    HeaderRules  `json:"headerRules"`
	MockRules   []MockRule   `json:"mockRules"`
}

type Store struct {
	mu     sync.RWMutex
	config ProxyConfig
}

func NewStore() *Store {
	return &Store{
		config: ProxyConfig{
			Mode: ModeSplit, 
		},
	}
}

func (s *Store) Get() ProxyConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *Store) Update(newConfig ProxyConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = newConfig
}