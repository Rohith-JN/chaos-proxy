package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"chaos-proxy/pkg/chaos"
	"chaos-proxy/pkg/config"
)

func parseToUrl(addr string) *url.URL {
	u, _ := url.Parse(addr)
	return u
}

func CreateDynamicProxy(isBackendRoute bool, store *config.Store) *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			cfg := store.Get()

			var targetStr string
			if cfg.Mode == config.ModeUnified {
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
				req.Body = &chaos.ThrottledReadCloser{
					RC:          req.Body,
					BytesPerSec: cfg.BandwidthUp * 1024,
					BaseDelay:   time.Duration(cfg.LagToReq) * time.Millisecond,
					Jitter:      time.Duration(cfg.Jitter) * time.Millisecond,
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
			cfg := store.Get();


				resp.Header.Set("Access-Control-Allow-Origin", "*")
				lag := cfg.LagToResp
				if cfg.FailureMode == "timeout" {
					lag = 60000 
				}
				if resp.Body != nil {
		resp.Body = &chaos.ThrottledReadCloser{
			RC:          resp.Body,
                BytesPerSec: cfg.BandwidthDown * 1024,
                BaseDelay:   time.Duration(lag) * time.Millisecond,
                Jitter:      time.Duration(cfg.Jitter) * time.Millisecond,
			FailureMode: cfg.FailureMode,
		}
	}
			return nil
		},
	}
}