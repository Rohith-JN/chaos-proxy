package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math/rand"
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
	Mode           ProxyMode `json:"mode"`
	TargetFrontend string    `json:"targetFrontend"`
	TargetBackend  string    `json:"targetBackend"`
	TargetUnified  string    `json:"targetUnified"`
	ChaosRoutes    []string  `json:"chaosRoutes"`

	// --- REAL LAG SETTINGS ---
	LagToReq  int `json:"lagToReq"`  // TTFB (upload)
	LagToResp int `json:"lagToResp"` // TTFB (download)

	BandwidthUp   int `json:"bandwidthUp"`   // upload bandwidth
	BandwidthDown int `json:"bandwidthDown"` // download bandwidth

	Jitter      int `json:"jitterMs"`

}


var (
	configMutex   sync.RWMutex
	currentConfig = ProxyConfig{
		Mode:            ModeSplit,
	}
)

type ThrottledReadCloser struct {
	rc          io.ReadCloser
	bytesPerSec int
	baseDelay   time.Duration
	jitter      time.Duration
}

func (t *ThrottledReadCloser) Read(p []byte) (int, error) {
	// Delay first byte only once (TTFB)
	if t.baseDelay > 0 {
		time.Sleep(t.baseDelay)
		t.baseDelay = 0
	}

	n, err := t.rc.Read(p)

	if n > 0 && t.bytesPerSec > 0 {
		delay := time.Duration(float64(n)/float64(t.bytesPerSec)) * time.Second
		if t.jitter > 0 {
			delay += time.Duration(rand.Int63n(int64(t.jitter)))
		}
		time.Sleep(delay)
	}

	return n, err
}

func (t *ThrottledReadCloser) Close() error {
	return t.rc.Close()
}

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

			// 4. APPLY REQUEST LAG
			// REAL upload lag (client → backend)
if req.Body != nil {
	req.Body = &ThrottledReadCloser{
		rc:          req.Body,
		bytesPerSec: cfg.BandwidthUp * 1024,
		baseDelay:   time.Duration(cfg.LagToReq) * time.Millisecond,
		jitter:      time.Duration(cfg.Jitter) * time.Millisecond,
	}
}

		},
		ModifyResponse: func(resp *http.Response) error {
			if resp.StatusCode == http.StatusSwitchingProtocols {
        return nil
    }

    upgrade := strings.ToLower(resp.Header.Get("Upgrade"))
    if upgrade == "websocket" {
        return nil
    }
			configMutex.RLock()
			cfg := currentConfig
			configMutex.RUnlock()


				resp.Header.Set("Access-Control-Allow-Origin", "*")

				// Response Lag
				if resp.Body != nil {
		resp.Body = &ThrottledReadCloser{
			rc:          resp.Body,
			bytesPerSec: cfg.BandwidthDown * 1024,
			baseDelay:   time.Duration(cfg.LagToResp) * time.Millisecond,
			jitter:      time.Duration(cfg.Jitter) * time.Millisecond,
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

// apply chaos to all routes don't distinguish between frontend and backend
// get backend routes to apply backend specific tampering
