package main

import (
	"bufio"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
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

    // --- Chaos Settings ---
    LagTime     int `json:"lagTime"`
    JitterTime  int `json:"jitterTime"`
    ThrottleBps int `json:"throttleBps"`
    ErrorRate   int `json:"errorRate"`
}

// Default State (Waiting for user input)
var currentConfig = ProxyConfig{
    Mode: ModeSplit, 
    // Initialize others as empty strings so the UI knows to prompt the user
}

// ThrottledResponseWriter wraps the standard writer to slow down data transfer
type ThrottledResponseWriter struct {
	http.ResponseWriter
	ThrottleBps int
}

func (w *ThrottledResponseWriter) Write(b []byte) (int, error) {
	// 1. If unlimited, pass through immediately
	if w.ThrottleBps <= 0 {
		return w.ResponseWriter.Write(b)
	}

	// 2. The "Slicer" Logic: Send data in small chunks with sleep
	totalBytes := len(b)
	written := 0
	chunkSize := w.ThrottleBps / 10 // Send 1/10th of limit every 100ms
	if chunkSize == 0 {
		chunkSize = 1
	}

	for written < totalBytes {
		remaining := totalBytes - written
		toWrite := min(remaining, chunkSize)

		// Write chunk
		n, err := w.ResponseWriter.Write(b[written : written+toWrite])
		if err != nil {
			return written, err
		}
		written += n

		// Flush to force browser to receive partial data
		if f, ok := w.ResponseWriter.(http.Flusher); ok {
			f.Flush()
		}

		time.Sleep(100 * time.Millisecond)
	}
	return written, nil
}

// Hijack is required for WebSockets and React Hot Module Replacement (HMR)
func (w *ThrottledResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := w.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, fmt.Errorf("response writer does not support hijacking")
}

// Helper to parse string to URL on the fly (ignoring errors for brevity)
func parseToUrl(addr string) *url.URL {
    u, _ := url.Parse(addr)
    return u
}

func createDynamicProxy(isChaosPath bool) *httputil.ReverseProxy {
    return &httputil.ReverseProxy{
        Director: func(req *http.Request) {
            // 1. READ CONFIG AT REQUEST TIME
            var targetStr string
            
            if currentConfig.Mode == ModeUnified {
                // Unified: Everything goes to same place
                targetStr = currentConfig.TargetUnified
            } else {
                // Split: Decide based on "Is this a Chaos Path?"
                if isChaosPath {
                    targetStr = currentConfig.TargetBackend
                } else {
                    targetStr = currentConfig.TargetFrontend
                }
            }
            
            // If user hasn't configured it yet, safe fallback
            if targetStr == "" { return }

            target := parseToUrl(targetStr)

            // 2. REWRITE HEADERS (The "Gateway" Logic)
            req.URL.Scheme = target.Scheme
            req.URL.Host = target.Host
            req.Host = target.Host // Vital for Vercel/Next.js/Nginx

            // 3. APPLY CHAOS (Only if this is the "Backend/Chaos" proxy)
            if isChaosPath {
                delay := currentConfig.LagTime
                if currentConfig.JitterTime > 0 {
                    // Normal Distribution Math
                    noise := rand.NormFloat64() * (float64(currentConfig.JitterTime) / 2.0)
                    delay += int(noise)
                }
                if delay > 0 {
                    time.Sleep(time.Duration(delay) * time.Millisecond)
                }
            }
        },
        // 4. RESPONSE MODIFIER (Errors/CORS)
        ModifyResponse: func(resp *http.Response) error {
            if isChaosPath {
                // Only chaos paths get 500s and CORS fixes
                resp.Header.Set("Access-Control-Allow-Origin", "*")
                if currentConfig.ErrorRate > 0 && rand.Intn(100) < currentConfig.ErrorRate {
                    resp.StatusCode = http.StatusInternalServerError
                }
            }
            return nil
        },
    }
}

func main() {
    // 1. Create two proxies. 
    // One for "Clean" traffic (Frontend/Static)
    // One for "Dirty" traffic (Backend/API)
    // Note: We don't pass a URL here! The Director handles it dynamically.
    cleanProxy := createDynamicProxy(false) 
    chaosProxy := createDynamicProxy(true)

    // --- SERVER 1: ADMIN DASHBOARD (:9000) ---
    go func() {
        mux := http.NewServeMux()

        // API: Handle Config Updates
        mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
            if r.Method == "OPTIONS" { return }

            if r.Method == "POST" {
                json.NewDecoder(r.Body).Decode(&currentConfig)
                fmt.Printf("Updated Config: Mode=%s\n", currentConfig.Mode)
            }
            json.NewEncoder(w).Encode(currentConfig)
        })

        // UI: Serve Embedded React App
        // Ensure "dist" exists (run npm run build!)
        distFS, _ := fs.Sub(dashboardAssets, "dist") 
        mux.Handle("/", http.FileServer(http.FS(distFS)))

        fmt.Println("🛠  Admin Dashboard: http://localhost:9000")
        log.Fatal(http.ListenAndServe(":9000", mux))
    }()

    // --- SERVER 2: CHAOS PROXY (:8080) ---
    proxyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        
        // Safety Check
        if currentConfig.TargetUnified == "" && currentConfig.TargetFrontend == "" {
            w.WriteHeader(http.StatusServiceUnavailable)
            w.Write([]byte("Chaos Proxy not configured. Go to http://localhost:9000"))
            return
        }

        // --- FIX STARTS HERE ---
        // 1. Throttling Logic
        // We MUST NOT throttle WebSockets (Upgrade: websocket) or it kills the connection.
        isWebSocket := r.Header.Get("Upgrade") == "websocket" || r.Header.Get("Upgrade") == "Websocket"

        var writer http.ResponseWriter = w
        
        // Only throttle if it is NOT a websocket AND throttling is enabled
        if !isWebSocket && currentConfig.ThrottleBps > 0 {
            writer = &ThrottledResponseWriter{ResponseWriter: w, ThrottleBps: currentConfig.ThrottleBps}
        }

        // 2. ROUTING LOGIC
        // Does this request match the "Chaos Routes" list?
        shouldApplyChaos := false
        for _, route := range currentConfig.ChaosRoutes {
            if strings.HasPrefix(r.URL.Path, route) {
                shouldApplyChaos = true
                break
            }
        }

        // 3. FORWARDING
        if shouldApplyChaos {
            chaosProxy.ServeHTTP(writer, r)
        } else {
            cleanProxy.ServeHTTP(writer, r)
        }
    })

    fmt.Println("🚀 Chaos Proxy:    http://localhost:8080")
    log.Fatal(http.ListenAndServe(":8080", proxyHandler))
}