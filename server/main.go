package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// --- 1. THE BRAIN (Global State) ---
type ProxyConfig struct {
    // --- Category 1: Network & Timing ---
    LagTime    int // Base delay (ms)
    JitterTime int // Random extra delay (±ms)
    
    // --- Category 2: HTTP Protocol ---
    ErrorRate       int    // Percentage (0-100)
}

// Set defaults
var config = ProxyConfig{
    LagTime:      0,
    JitterTime:   0,
    ErrorRate:    0,
}

// --- 2. THE REMOTE CONTROL (Admin API Handler) ---
func handleConfig(w http.ResponseWriter, r *http.Request) {
	// Enable CORS (So your React Dashboard on a different port can talk to this)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle Preflight (Browser checks permissions before sending POST)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Update the config from JSON
	var newConfig ProxyConfig
	err := json.NewDecoder(r.Body).Decode(&newConfig)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	config = newConfig
	fmt.Printf("Config Updated: Lag=%dms, Jitter=%dms, Errors=%d%%\n", config.LagTime, config.JitterTime, config.ErrorRate)

	// Send back the new state
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func main() {
	// --- 3. START ADMIN SERVER (Background Thread) ---
	go func() {
		http.HandleFunc("/api/config", handleConfig)
		fmt.Println("Admin API running on http://localhost:9000/api/config")
		log.Fatal(http.ListenAndServe(":9000", nil))
	}()

	// --- 4. START PROXY SERVER (Main Thread) ---
	// Point this to where your React/Next.js app is running
	dest := "http://localhost:3000"
	u, err := url.Parse(dest)
	if err != nil {
		panic(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(u)

	// Capture the original director logic
	originalDirector := proxy.Director

	// A. REQUEST INTERCEPTOR (The "Director")
	// Handles: Latency, Host Header Fixing
	proxy.Director = func(req *http.Request) {
        originalDirector(req)
        req.Host = req.URL.Host

        // --- CATEGORY 1: TIMING ---
        delay := 0
        
        // 1. Base Latency
        if config.LagTime > 0 {
            delay += config.LagTime
        }

        // 2. Jitter (Randomness)
        if config.JitterTime > 0 {
            // Adds a random amount between 0 and JitterTime
            delay += rand.Intn(config.JitterTime)
        }

        // Apply the total sleep
        if delay > 0 {
            // fmt.Printf("⏳ Lagging for %dms\n", delay) // Uncomment to debug
            time.Sleep(time.Duration(delay) * time.Millisecond)
        }
    }

	// B. RESPONSE INTERCEPTOR (The "Modifier")
	// Handles: 500 Errors, Data Corruption
	proxy.ModifyResponse = func(resp *http.Response) error {
		
		// path := resp.Request.URL.Path

		// Filter: Don't break static files (JS, CSS, Images)
		// We only want to break API calls or the main document
		// isStatic := false
		// if strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".png") {
		// 	isStatic = true
		// }

		// // Dynamic Error Injection
		// if !isStatic && config.ErrorRate > 0 {
		// 	if rand.Intn(100) < config.ErrorRate {
		// 		fmt.Printf("Chaos Triggered: Killing %s\n", path)
		// 		resp.StatusCode = http.StatusInternalServerError
		// 		resp.Status = "500 Internal Server Error"
		// 	}
		// }
		resp.Header.Del("Access-Control-Allow-Origin")
        resp.Header.Del("Access-Control-Allow-Credentials")

        resp.Header.Set("Access-Control-Allow-Origin", "*")
        resp.Header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        resp.Header.Set("Access-Control-Allow-Headers", "*")
		return nil
	}

	fmt.Println("Chaos Proxy running on http://localhost:8080")
	// Start the Proxy
	log.Fatal(http.ListenAndServe(":8080", proxy))
}