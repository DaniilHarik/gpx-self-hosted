package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

func TestTileConfigHandler(t *testing.T) {
	cfg := &config.Config{
		Providers: map[string]config.TileProviderConfig{
			"custom": {
				Name:        "Custom",
				URLTemplate: "http://example.com/{z}/{x}/{y}.png",
				IsTMS:       true,
				Attribution: "Attr",
				ZoomRange:   [2]int{2, 8},
			},
		},
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/api/tile-config", nil)
	rr := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", got)
	}
	if got := rr.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", got)
	}

	var resp model.TileConfigResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}

	if resp.Initial != "maaamet-kaart" {
		t.Fatalf("expected initial provider maaamet-kaart, got %s", resp.Initial)
	}

	custom, ok := resp.Providers["custom"]
	if !ok {
		t.Fatalf("custom provider missing from response")
	}

	if custom.Name != "Custom" || !custom.IsTMS || custom.Attribution != "Attr" {
		t.Fatalf("provider fields not mirrored correctly: %+v", custom)
	}
	if custom.MinZoom != 2 || custom.MaxZoom != 8 {
		t.Fatalf("expected zoom range 2-8, got %d-%d", custom.MinZoom, custom.MaxZoom)
	}
}

func TestListGPXFiles(t *testing.T) {
	dataDir, err := os.MkdirTemp("", "gpx-data-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(dataDir) })

	files := []string{"test1.gpx", "test2.gpx", "ignore.txt", "TEST3.GPX"}
	activitiesDir := filepath.Join(dataDir, "Activities")
	if err := os.MkdirAll(activitiesDir, 0755); err != nil {
		t.Fatalf("Failed to create Activities dir: %v", err)
	}
	for _, f := range files {
		path := filepath.Join(activitiesDir, f)
		if err := os.WriteFile(path, []byte("gpx data"), 0644); err != nil {
			t.Fatalf("Failed to create test file %s: %v", f, err)
		}
	}

	nestedDir := filepath.Join(activitiesDir, "sub")
	if err := os.MkdirAll(nestedDir, 0755); err != nil {
		t.Fatalf("Failed to create nested dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(nestedDir, "nested.gpx"), []byte("gpx data"), 0644); err != nil {
		t.Fatalf("Failed to create nested test file: %v", err)
	}

	plansDir := filepath.Join(dataDir, "Plans")
	if err := os.MkdirAll(plansDir, 0755); err != nil {
		t.Fatalf("Failed to create Plans dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(plansDir, "plan.gpx"), []byte("gpx data"), 0644); err != nil {
		t.Fatalf("Failed to create plan file: %v", err)
	}

	if err := os.WriteFile(filepath.Join(dataDir, "root.gpx"), []byte("gpx data"), 0644); err != nil {
		t.Fatalf("Failed to create root file: %v", err)
	}

	cfg := &config.Config{
		DataDir: dataDir,
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/api/gpx", nil)
	rr := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var fileList []model.GPXFile
	if err := json.Unmarshal(rr.Body.Bytes(), &fileList); err != nil {
		t.Errorf("handler returned invalid json: %v", err)
	}

	expectedCount := 5 // test1.gpx, test2.gpx, TEST3.GPX, sub/nested.gpx, plan.gpx
	if len(fileList) != expectedCount {
		t.Errorf("handler returned %v files, expected %v", len(fileList), expectedCount)
	}

	foundNested := false
	for _, f := range fileList {
		if f.RelativePath == "Activities/sub/nested.gpx" && f.Path == "/data/Activities/sub/nested.gpx" {
			foundNested = true
			break
		}
	}
	if !foundNested {
		t.Errorf("nested file not returned with expected path information")
	}
}

func TestTileProxyHandler(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/15/10/20.png" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("fake tile data"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer upstream.Close()

	tmpDir, err := os.MkdirTemp("", "gpx-tile-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		CacheDir:      tmpDir,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				Name:        "Test",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
			"opentopomap": {
				Name:        "Test",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
		},
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/test/15/10/20.png", nil)
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Cache MISS: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	if rr.Body.String() != "fake tile data" {
		t.Errorf("Cache MISS: handler returned wrong body: got %v want %v", rr.Body.String(), "fake tile data")
	}

	cachePath := filepath.Join(tmpDir, "tiles", "test", "15", "10", "20.png")
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		t.Errorf("File was not cached at %s", cachePath)
	}

	upstream.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Should not be called", http.StatusInternalServerError)
	})

	rr2 := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr2, req)

	if status := rr2.Code; status != http.StatusOK {
		t.Errorf("Cache HIT: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	if rr2.Body.String() != "fake tile data" {
		t.Errorf("Cache HIT: handler returned wrong body: got %v want %v", rr2.Body.String(), "fake tile data")
	}
}

func TestPrewarmViewHandler(t *testing.T) {
	var upstreamCalls int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		if r.URL.Path == "/0/0/0.png" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("fake tile data"))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer upstream.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		CacheDir:      cacheDir,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				Name:        "Test",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
				ZoomRange:   [2]int{0, 0},
			},
		},
	}
	srv := New(cfg)

	body, _ := json.Marshal(model.PrewarmViewRequest{
		ProviderKey: "test",
		Bounds:      model.BoundsDTO{North: 1, South: -1, East: 1, West: -1},
		CenterZoom:  0,
		ZoomRadius:  0,
	})
	req := httptest.NewRequest("POST", "/api/prewarm-view", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var resp model.PrewarmViewResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}

	if resp.Total != 1 || resp.Ok != 1 || resp.Failed != 0 {
		t.Fatalf("unexpected response counts: %+v", resp)
	}

	cachePath := filepath.Join(cacheDir, "tiles", "test", "0", "0", "0.png")
	if _, err := os.Stat(cachePath); err != nil {
		t.Fatalf("expected tile cached at %s, got error: %v", cachePath, err)
	}
	if upstreamCalls != 1 {
		t.Fatalf("expected upstream to be called once, got %d", upstreamCalls)
	}
}

func TestPrewarmViewHandler_OfflineMode(t *testing.T) {
	var upstreamCalls int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls++
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		CacheDir:      t.TempDir(),
		Offline:       true,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				Name:        "Test",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
				ZoomRange:   [2]int{0, 0},
			},
		},
	}
	srv := New(cfg)

	body, _ := json.Marshal(model.PrewarmViewRequest{
		ProviderKey: "test",
		Bounds:      model.BoundsDTO{North: 1, South: -1, East: 1, West: -1},
		CenterZoom:  0,
		ZoomRadius:  0,
	})
	req := httptest.NewRequest("POST", "/api/prewarm-view", bytes.NewReader(body))
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d", rr.Code)
	}
	if upstreamCalls != 0 {
		t.Fatalf("expected upstream not to be called while offline, got %d", upstreamCalls)
	}
}

func TestTileProxyHandler_UnknownProvider(t *testing.T) {
	cfg := &config.Config{
		Providers: map[string]config.TileProviderConfig{},
		CacheDir:  t.TempDir(),
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/unknown/1/2/3.png", nil)
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown provider, got %d", rr.Code)
	}
}

func TestTileProxyHandler_UpstreamNotFound(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer upstream.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		Providers: map[string]config.TileProviderConfig{
			"missing": {
				Name:        "Missing",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
		},
		CacheDir: cacheDir,
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/missing/1/2/3.png", nil)
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when upstream reports missing tile, got %d", rr.Code)
	}

	cachePath := filepath.Join(cacheDir, "tiles", "missing", "1", "2", "3.png")
	if _, err := os.Stat(cachePath); err == nil {
		t.Fatalf("expected no cached file to be written for upstream 404")
	} else if !os.IsNotExist(err) {
		t.Fatalf("unexpected cache stat error: %v", err)
	}
}

func TestTileProxyHandler_OfflineModeCacheOnly(t *testing.T) {
	var upstreamCalled int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalled++
		http.Error(w, "should not be called while offline", http.StatusInternalServerError)
	}))
	defer upstream.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		CacheDir:      cacheDir,
		Offline:       true,
		Providers: map[string]config.TileProviderConfig{
			"offline": {
				Name:        "Offline",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
		},
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/offline/1/2/3.png", nil)
	rr := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when offline and tile missing, got %d", rr.Code)
	}
	if upstreamCalled != 0 {
		t.Fatalf("expected no upstream calls in offline mode, got %d", upstreamCalled)
	}
	cachePath := filepath.Join(cacheDir, "tiles", "offline", "1", "2", "3.png")
	if _, err := os.Stat(cachePath); err == nil {
		t.Fatalf("expected no cached file to be written while offline")
	} else if !os.IsNotExist(err) {
		t.Fatalf("unexpected cache stat error: %v", err)
	}

	// Pre-seed cache and ensure it is served without contacting upstream.
	if err := os.MkdirAll(filepath.Dir(cachePath), 0755); err != nil {
		t.Fatalf("failed to create cache dir: %v", err)
	}
	if err := os.WriteFile(cachePath, []byte("cached tile"), 0644); err != nil {
		t.Fatalf("failed to seed cache: %v", err)
	}

	rr2 := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr2, req)

	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 on cached tile while offline, got %d", rr2.Code)
	}
	if rr2.Body.String() != "cached tile" {
		t.Fatalf("unexpected body from cached tile: %q", rr2.Body.String())
	}
	if upstreamCalled != 0 {
		t.Fatalf("expected no upstream calls even after cache hit, got %d", upstreamCalled)
	}
}

func TestTileProxyHandler_UpstreamFailureAfterRetries(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "fail", http.StatusInternalServerError)
	}))
	upstream.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		ClientTimeout: 200 * time.Millisecond,
		MaxRetries:    2,
		Providers: map[string]config.TileProviderConfig{
			"flaky": {
				Name:        "Flaky",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
		},
		CacheDir: cacheDir,
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/flaky/1/2/3.png", nil)
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when upstream fails after retries, got %d", rr.Code)
	}

	cachePath := filepath.Join(cacheDir, "tiles", "flaky", "1", "2", "3.png")
	if _, err := os.Stat(cachePath); err == nil {
		t.Fatalf("expected no cached file for upstream failure")
	} else if !os.IsNotExist(err) {
		t.Fatalf("unexpected cache stat error: %v", err)
	}
}

func TestTileProxyHandler_InvalidRequest(t *testing.T) {
	cfg := &config.Config{
		Providers: map[string]config.TileProviderConfig{},
		CacheDir:  ".",
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/invalid", nil)
	rr := httptest.NewRecorder()

	srv.Handler().ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("ExpectedStatusBadRequest, got %v", status)
	}
}

func TestStatusEndpointCounts(t *testing.T) {
	var requestCount int
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if r.URL.Path == "/15/10/20.png" && requestCount == 1 {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("fake tile data"))
			return
		}
		http.Error(w, "unexpected upstream request", http.StatusInternalServerError)
	}))
	defer upstream.Close()

	cacheDir := t.TempDir()
	cfg := &config.Config{
		ClientTimeout: 1 * time.Second,
		MaxRetries:    1,
		CacheDir:      cacheDir,
		Providers: map[string]config.TileProviderConfig{
			"test": {
				Name:        "Test",
				URLTemplate: upstream.URL + "/{z}/{x}/{y}.png",
				IsTMS:       false,
			},
		},
	}
	srv := New(cfg)

	req := httptest.NewRequest("GET", "/tiles/test/15/10/20.png", nil)
	rr := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 on initial fetch, got %d", rr.Code)
	}

	// Upstream should not be called on cache hit.
	upstream.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "should not be called", http.StatusInternalServerError)
	})

	rr2 := httptest.NewRecorder()
	srv.Handler().ServeHTTP(rr2, req)
	if rr2.Code != http.StatusOK {
		t.Fatalf("expected 200 on cache hit, got %d", rr2.Code)
	}

	errorReq := httptest.NewRequest("GET", "/tiles/unknown/1/2/3.png", nil)
	errorResp := httptest.NewRecorder()
	srv.Handler().ServeHTTP(errorResp, errorReq)
	if errorResp.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown provider, got %d", errorResp.Code)
	}

	statusReq := httptest.NewRequest("GET", "/api/status", nil)
	statusResp := httptest.NewRecorder()
	srv.Handler().ServeHTTP(statusResp, statusReq)
	if statusResp.Code != http.StatusOK {
		t.Fatalf("expected 200 from status endpoint, got %d", statusResp.Code)
	}
	if got := statusResp.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %s", got)
	}

	var status model.StatusResponse
	if err := json.Unmarshal(statusResp.Body.Bytes(), &status); err != nil {
		t.Fatalf("unexpected json error: %v", err)
	}

	if status.CacheHits != 1 || status.CacheMisses != 1 || status.CacheErrors != 1 {
		t.Fatalf("unexpected counters: %+v", status)
	}
}

func TestFormatBytes(t *testing.T) {
	tests := []struct {
		input    int64
		expected string
	}{
		{0, "0 B"},
		{500, "500 B"},
		{1023, "1023 B"},
		{1024, "1.0 KB"},
		{1500, "1.5 KB"},
		{1024 * 1024, "1.0 MB"},
		{3 * 1024 * 1024 * 1024, "3.0 GB"},
	}

	for _, tc := range tests {
		got := formatBytes(tc.input)
		if got != tc.expected {
			t.Errorf("formatBytes(%d): got %s, want %s", tc.input, got, tc.expected)
		}
	}
}

func TestGetDirSize(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "gpx-size-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(tmpDir) })

	size, err := getDirSize(tmpDir)
	if err != nil {
		t.Errorf("getDirSize failed on empty dir: %v", err)
	}
	if size != 0 {
		t.Errorf("Expected size 0 for empty dir, got %d", size)
	}

	content := []byte("hello")
	if err := os.WriteFile(filepath.Join(tmpDir, "file1.txt"), content, 0644); err != nil {
		t.Fatal(err)
	}

	size, err = getDirSize(tmpDir)
	if err != nil {
		t.Errorf("getDirSize failed: %v", err)
	}
	if size != 5 {
		t.Errorf("Expected size 5, got %d", size)
	}

	subDir := filepath.Join(tmpDir, "sub")
	if err := os.Mkdir(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(subDir, "file2.txt"), content, 0644); err != nil {
		t.Fatal(err)
	}

	size, err = getDirSize(tmpDir)
	if err != nil {
		t.Errorf("getDirSize failed: %v", err)
	}
	if size != 10 {
		t.Errorf("Expected size 10, got %d", size)
	}
}
