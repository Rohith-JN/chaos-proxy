package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"
)

// --- 1. THE BRAIN (Global State) ---
type ProxyConfig struct {
	// --- Category 1: Network & Timing ---
	LagTime    int // Base delay (ms)
	JitterTime int // Random extra delay (±ms)

	// NEW: Bandwidth Limit (Bytes per second). 0 = Unlimited.
    // Example: 10240 = 10KB/s (Very Slow)
    ThrottleBps  int
	// --- Category 2: HTTP Protocol ---
	ErrorRate int // Percentage (0-100)
}

// Set defaults
var config = ProxyConfig{
	LagTime:    0,
	JitterTime: 0,
	ThrottleBps: 0,
	ErrorRate:  0,
}

// This allows WebSockets (and React HMR) to work through your throttler
func (w *ThrottledResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
    // Check if the underlying writer supports hijacking
    hijacker, ok := w.ResponseWriter.(http.Hijacker)
    if !ok {
        return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
    }
    // Pass the hijack request through
    return hijacker.Hijack()
}

// --- 2. THE REMOTE CONTROL (Admin API Handler) ---
func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		return
	}

	// --- NEW: Handle GET (Read Config) ---
    if r.Method == http.MethodGet {
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(config)
        return
    }

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newConfig ProxyConfig
	var err error = json.NewDecoder(r.Body).Decode(&newConfig)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	config = newConfig
	fmt.Printf("Config Updated: Lag=%dms, Jitter=%dms, Throttle=%dbps, Errors=%d%%\n", config.LagTime, config.JitterTime, config.ThrottleBps, config.ErrorRate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// A custom writer that slows down data transfer
type ThrottledResponseWriter struct {
    http.ResponseWriter // Embed the original writer so we inherit its methods
    ThrottleBps int
}

func (w *ThrottledResponseWriter) Write(b []byte) (int, error) {
    // If no limit, just write normally
    if w.ThrottleBps <= 0 {
        return w.ResponseWriter.Write(b)
    }

    // "The Slicer" Logic
    totalBytes := len(b)
    written := 0
    
    // Calculate chunk size (e.g., send 1/10th of the limit every 100ms)
    // This makes the flow smoother than sending 1 big chunk every second.
    chunkSize := w.ThrottleBps / 10 
    if chunkSize == 0 { chunkSize = 1 } // Prevent divide by zero

    for written < totalBytes {
        // Determine how much to write in this chunk
        remaining := totalBytes - written
        toWrite := chunkSize
        if remaining < toWrite {
            toWrite = remaining
        }

        // Write the chunk
        n, err := w.ResponseWriter.Write(b[written : written+toWrite])
        if err != nil {
            return written, err
        }
        written += n

        // Flush! (Force the browser to receive this chunk immediately)
        if f, ok := w.ResponseWriter.(http.Flusher); ok {
            f.Flush()
        }

        // Sleep to simulate the low bandwidth
        // Logic: 10 chunks per second = 100ms sleep
        time.Sleep(100 * time.Millisecond)
    }

    return written, nil
}

// --- 3. HELPERS ---

// A. The Basic Plumbing (Apply this to BOTH Frontend and Backend)
// This ensures Next.js/Nginx knows we are talking to them, but adds NO lag.
func prepareProxy(p *httputil.ReverseProxy, target *url.URL) {
    originalDirector := p.Director
    p.Director = func(req *http.Request) {
        originalDirector(req)
        // CRITICAL: Rewrite the Host header to match the target.
        // Without this, Next.js might think you are spam/invalid.
        req.Host = target.Host
        req.URL.Scheme = target.Scheme
        req.URL.Host = target.Host
    }
}

// B. The Chaos Injection (Apply this ONLY to the Backend)
func applyChaos(p *httputil.ReverseProxy) {
    // We wrap the EXISTING director (which already has the Host fix from prepareProxy)
    originalDirector := p.Director
    
    p.Director = func(req *http.Request) {
        // 1. Run the basic plumbing first
        originalDirector(req)

        // 2. Now apply Chaos (Lag/Jitter)
        // Only happens if config is set > 0
        delay := 0
        if config.LagTime > 0 {
            delay += config.LagTime
        }
        if config.JitterTime > 0 {
            delay += rand.Intn(config.JitterTime)
        }
        if delay > 0 {
            time.Sleep(time.Duration(delay) * time.Millisecond)
        }
    }

    // 3. Response Tampering (Errors, CORS)
    p.ModifyResponse = func(resp *http.Response) error {
        // ... (Insert your existing CORS and ErrorRate logic here) ...
        // See previous code for the full body of ModifyResponse
        
        // Quick recap of CORS logic for safety:
        resp.Header.Del("Access-Control-Allow-Origin")
        resp.Header.Set("Access-Control-Allow-Origin", "*")
        
        if config.ErrorRate > 0 && rand.Intn(100) < config.ErrorRate {
             resp.StatusCode = http.StatusInternalServerError
        }
        return nil
    }
}

func main() {
	frontendUrlArg := flag.String("frontend", "http://localhost:3000", "URL of the Frontend (e.g., http://localhost:3000)")
	
	// "backend" flag. Default: Empty string (will fallback to frontend)
	backendUrlArg := flag.String("backend", "", "URL of the Backend API (optional, defaults to frontend URL)")
	
	flag.Parse() // Process the arguments

	// 2. Resolve URLs
	// Parse Frontend URL
	frontendURL, err := url.Parse(*frontendUrlArg)
	if err != nil {
		fmt.Printf("Invalid Frontend URL: %v\n", err)
		os.Exit(1)
	}

	// Parse Backend URL
	// Logic: If backend arg is empty, we assume "Single API" mode (Next.js style)
	// and point backend traffic to the frontend URL.
	var backendURL *url.URL
	if *backendUrlArg == "" {
		fmt.Println("Single API Mode detected. Routing API calls to Frontend URL.")
		backendURL = frontendURL
	} else {
		fmt.Println("Dual API Mode detected.")
		backendURL, err = url.Parse(*backendUrlArg)
		if err != nil {
			fmt.Printf("❌ Invalid Backend URL: %v\n", err)
			os.Exit(1)
		}
	}

	// 3. Setup Proxies (Same logic as before, just using variables)
	frontendProxy := httputil.NewSingleHostReverseProxy(frontendURL)
	backendProxy := httputil.NewSingleHostReverseProxy(backendURL)
	
	// Apply your existing setupProxy logic (CORS, Chaos, etc.)
	// 2. Setup FRONTEND (Plumbing Only - Fast!)
    prepareProxy(frontendProxy, frontendURL)
	
	// 3. Setup BACKEND (Plumbing + Chaos - Slow!)
    prepareProxy(backendProxy, backendURL) // Fix headers first
    applyChaos(backendProxy)               // Then add toxins

	fmt.Printf("\nChaos Proxy Running!\n")
	fmt.Printf("   Proxy URL:    http://localhost:8080\n")
	fmt.Printf("   Frontend:     %s\n", frontendURL)
	fmt.Printf("   Backend:      %s\n", backendURL)
	fmt.Printf("   Admin Panel:  http://localhost:9000/api/config\n\n")

	// --- 4. START ADMIN SERVER (Background Thread) ---
	go func() {
		http.HandleFunc("/api/config", handleConfig)
		log.Fatal(http.ListenAndServe(":9000", nil))
	}()

	// --- 6. THE ROUTER (Main Thread) ---
    mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        
        // 1. Wrap the writer with our Throttler
        // We pass the global config.ThrottleBps to it.
        // Note: We only wrap if throttling is actually enabled to save CPU.
        var finalWriter http.ResponseWriter = w
        
        if config.ThrottleBps > 0 {
            finalWriter = &ThrottledResponseWriter{
                ResponseWriter: w,
                ThrottleBps: config.ThrottleBps,
            }
        }

        // 2. Routing Logic
        if strings.HasPrefix(r.URL.Path, "/graphql") || strings.HasPrefix(r.URL.Path, "/api") {
            backendProxy.ServeHTTP(finalWriter, r)
        } else {
            frontendProxy.ServeHTTP(finalWriter, r)
        }
    })

	// Standard start (simplest version)
	if err := http.ListenAndServe(":8080", mainHandler); err != nil {
		fmt.Printf("❌ Failed to start server: %v\n", err)
	}
}