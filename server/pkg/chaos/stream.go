package chaos

import (
	"io"
	"math/rand"
	"time"
)

type ThrottledReadCloser struct {
	RC          io.ReadCloser
	BytesPerSec int
	BaseDelay   time.Duration
	Jitter      time.Duration
	FailureMode string
}

func (t *ThrottledReadCloser) Read(p []byte) (int, error) {
	// 1. TTFB Delay
	if t.BaseDelay > 0 {
		time.Sleep(t.BaseDelay)
		t.BaseDelay = 0
	}

	n, err := t.RC.Read(p)

	// 2. Failure Modes
	if n > 0 && t.FailureMode != "" && t.FailureMode != "normal" {
		if rand.Intn(100) < 1 { // 1% chance per chunk
			if t.FailureMode == "hang_body" {
				select {} // Block forever
			}
			if t.FailureMode == "close_body" {
				return n, io.ErrUnexpectedEOF
			}
		}
	}

	// 3. Bandwidth Throttling
	if n > 0 && t.BytesPerSec > 0 {
		delay := time.Duration(float64(n)/float64(t.BytesPerSec)) * time.Second
		if t.Jitter > 0 {
			delay += time.Duration(rand.Int63n(int64(t.Jitter)))
		}
		time.Sleep(delay)
	}

	return n, err
}

func (t *ThrottledReadCloser) Close() error {
	return t.RC.Close()
}