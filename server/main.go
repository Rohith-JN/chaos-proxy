package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"

	"chaos-proxy/pkg/config"
	"chaos-proxy/pkg/proxy"
)

//go:embed dist/*
var dashboardAssets embed.FS

func main() {
    // 1. Initialize State
	configStore := config.NewStore()

	// 2. Initialize Proxies (Dependency Injection)
	frontendProxy := proxy.CreateDynamicProxy(false, configStore)
	backendProxy := proxy.CreateDynamicProxy(true, configStore)

	// --- SERVER 1: ADMIN DASHBOARD (:9000) ---
	go func() {
		mux := http.NewServeMux()

		// API Handler
		mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			
            if r.Method == "POST" {
                // Use the Store's helper to update safely
				var newCfg config.ProxyConfig
				json.NewDecoder(r.Body).Decode(&newCfg)
				configStore.Update(newCfg)
				fmt.Printf("Updated Config")
			}
            
            // Use the Store to read safely
			json.NewEncoder(w).Encode(configStore.Get())
		})

		// Static Assets
		distFS, _ := fs.Sub(dashboardAssets, "dist")
		mux.Handle("/", http.FileServer(http.FS(distFS)))

		fmt.Println("🛠  Admin Dashboard: http://localhost:9000")
		log.Fatal(http.ListenAndServe(":9000", mux))
	}()

	// --- SERVER 2: CHAOS PROXY (:8080) ---
	proxyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cfg := configStore.Get() // Read config for routing decision

		if cfg.TargetUnified == "" && cfg.TargetFrontend == "" {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte("Chaos Proxy not configured. Go to http://localhost:9000"))

			return
		}

		isBackendRoute := false
		for _, route := range cfg.ChaosRoutes {
			if strings.HasPrefix(r.URL.Path, route) {
				isBackendRoute = true
				break
			}
		}

		if isBackendRoute {
			backendProxy.ServeHTTP(w, r)
		} else {
			frontendProxy.ServeHTTP(w, r)
		}
	})

	fmt.Println("Chaos Proxy: http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", proxyHandler))
}