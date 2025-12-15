package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"
)

//go:embed dist/*
var dashboardAssets embed.FS

type ProxyMode string

const (
	ModeSplit   ProxyMode = "split"
	ModeUnified ProxyMode = "unified"
)

type ProxyConfig struct {
	// --- Connection Settings ---
	Mode           ProxyMode `json:"mode"`           // "split" or "unified"
	TargetFrontend string    `json:"targetFrontend"` // Used in Split Mode
	TargetBackend  string    `json:"targetBackend"`  // Used in Split Mode
	TargetUnified  string    `json:"targetUnified"`  // Used in Unified Mode
	ChaosRoutes    []string  `json:"chaosRoutes"`    // e.g. ["/api", "/graphql"]

	// --- NEW: Blast Radius Controls ---
	ChaosOnFrontend bool `json:"chaosOnFrontend"` // Apply chaos to non-API routes?
	ChaosOnBackend  bool `json:"chaosOnBackend"`  // Apply chaos to API routes?

	// --- Chaos Settings ---
	LagToReq  int `json:"lagToReq"`
	LagToResp int `json:"lagToResp"`
}

var (
	configMutex   sync.RWMutex
	currentConfig = ProxyConfig{
		Mode:            ModeSplit,
		ChaosOnFrontend: true, // ✅ Default: Apply chaos to Frontend
		ChaosOnBackend:  true, // ✅ Default: Apply chaos to Backend
	}
)

func parseToUrl(addr string) *url.URL {
	u, _ := url.Parse(addr)
	return u
}

// createDynamicProxy now accepts 'isBackendRoute' strictly for ROUTING purposes.
// Chaos decisions are made inside dynamically based on flags.
func createDynamicProxy(isBackendRoute bool) *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			configMutex.RLock()
			cfg := currentConfig
			configMutex.RUnlock()

			// 1. ROUTING LOGIC
			var targetStr string
			if cfg.Mode == ModeUnified {
				targetStr = cfg.TargetUnified
			} else {
				if isBackendRoute {
					targetStr = cfg.TargetBackend
				} else {
					targetStr = cfg.TargetFrontend
				}
			}

			if targetStr == "" {
				return
			}
			target := parseToUrl(targetStr)

			// 2. REWRITE HEADERS
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			// 3. CHAOS DECISION ENGINE
			shouldApplyChaos := false
			if isBackendRoute && cfg.ChaosOnBackend {
				shouldApplyChaos = true
			}
			if !isBackendRoute && cfg.ChaosOnFrontend {
				shouldApplyChaos = true
			}

			// 4. APPLY REQUEST LAG
			if shouldApplyChaos {
				reqDelay := cfg.LagToReq
				if reqDelay > 0 {
					time.Sleep(time.Duration(reqDelay) * time.Millisecond)
				}
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			configMutex.RLock()
			cfg := currentConfig
			configMutex.RUnlock()

			// Re-evaluate Chaos Decision for Response
			shouldApplyChaos := false
			if isBackendRoute && cfg.ChaosOnBackend {
				shouldApplyChaos = true
			}
			if !isBackendRoute && cfg.ChaosOnFrontend {
				shouldApplyChaos = true
			}

			if shouldApplyChaos {
				resp.Header.Set("Access-Control-Allow-Origin", "*")

				// Response Lag
				if cfg.LagToResp > 0 {
					respDelay := cfg.LagToResp
					if respDelay > 0 {
						time.Sleep(time.Duration(respDelay) * time.Millisecond)
					}
				}
			}
			return nil
		},
	}
}

func main() {
	// 1. Create two proxies.
	// 'false' = Designed for Frontend Traffic
	// 'true'  = Designed for Backend Traffic
	frontendProxy := createDynamicProxy(false)
	backendProxy := createDynamicProxy(true)

	// --- SERVER 1: ADMIN DASHBOARD (:9000) ---
	go func() {
		mux := http.NewServeMux()

		mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				return
			}

			if r.Method == "POST" {
				configMutex.Lock()
				json.NewDecoder(r.Body).Decode(&currentConfig)
				configMutex.Unlock()
				fmt.Printf("Updated Config: Mode=%s\n", currentConfig.Mode)
			}
			configMutex.RLock()
			json.NewEncoder(w).Encode(currentConfig)
			configMutex.RUnlock()
		})

		distFS, _ := fs.Sub(dashboardAssets, "dist")
		mux.Handle("/", http.FileServer(http.FS(distFS)))

		fmt.Println("🛠  Admin Dashboard: http://localhost:9000")
		log.Fatal(http.ListenAndServe(":9000", mux))
	}()

	// --- SERVER 2: CHAOS PROXY (:8080) ---
	proxyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		// 🔒 CRITICAL: Read config safely once per request
		configMutex.RLock()
		cfg := currentConfig
		configMutex.RUnlock()

		if cfg.TargetUnified == "" && cfg.TargetFrontend == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Chaos Proxy not configured. Go to http://localhost:9000"))
			return
		}

		var writer http.ResponseWriter = w

		// Routing Logic: Backend or Frontend?
		isBackendRoute := false
		for _, route := range cfg.ChaosRoutes {
			if strings.HasPrefix(r.URL.Path, route) {
				isBackendRoute = true
				break
			}
		}

		if isBackendRoute {
			backendProxy.ServeHTTP(writer, r)
		} else {
			frontendProxy.ServeHTTP(writer, r)
		}
	})

	fmt.Println("🚀 Chaos Proxy: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", proxyHandler))
}