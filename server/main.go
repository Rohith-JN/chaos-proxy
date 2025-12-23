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
	LagToReq  int `json:"lagToReq"`  
	LagToResp int `json:"lagToResp"` 

	BandwidthUp   int `json:"bandwidthUp"`   
	BandwidthDown int `json:"bandwidthDown"` 

	Jitter      int `json:"jitterMs"`

	FailureMode string `json:"failureMode"`
}

var (
	configMutex   sync.RWMutex
	currentConfig = ProxyConfig{
		Mode: ModeSplit,
		FailureMode: "normal",
	}
)

type ThrottledReadCloser struct {
    rc          io.ReadCloser
    bytesPerSec int
    baseDelay   time.Duration
    jitter      time.Duration
    
    failureMode string 
}

func (t *ThrottledReadCloser) Read(p []byte) (int, error) {
    if t.baseDelay > 0 {
        time.Sleep(t.baseDelay)
        t.baseDelay = 0
    }

    n, err := t.rc.Read(p)

    if t.failureMode != "" && t.failureMode != "normal" && n > 0 {
        
        if t.failureMode == "hang_body" && rand.Intn(100) < 1 {
             select{} 
        }

        if t.failureMode == "close_body" && rand.Intn(100) < 1 {
            return n, io.ErrUnexpectedEOF 
        }
    }

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

func createDynamicProxy(isBackendRoute bool) *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			configMutex.RLock()
			cfg := currentConfig
			configMutex.RUnlock()

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

			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

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
				lag := cfg.LagToResp
				if cfg.FailureMode == "timeout" {
					lag = 60000 // 60 seconds
				}
				if resp.Body != nil {
		resp.Body = &ThrottledReadCloser{
			rc:          resp.Body,
                bytesPerSec: cfg.BandwidthDown * 1024,
                baseDelay:   time.Duration(lag) * time.Millisecond,
                jitter:      time.Duration(cfg.Jitter) * time.Millisecond,
			failureMode: cfg.FailureMode,
		}
	}
			return nil
		},
	}
}

func main() {
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

		configMutex.RLock()
		cfg := currentConfig
		configMutex.RUnlock()

		if cfg.TargetUnified == "" && cfg.TargetFrontend == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Chaos Proxy not configured. Go to http://localhost:9000"))
			return
		}

		var writer http.ResponseWriter = w

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
