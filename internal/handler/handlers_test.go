package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"gpx-self-host/internal/config"
	"gpx-self-host/internal/model"
)

type mockGPXService struct {
	listFilesFunc func() ([]model.GPXFile, error)
}

func (m *mockGPXService) ListFiles() ([]model.GPXFile, error) {
	return m.listFilesFunc()
}

type mockTilesService struct {
	getTileFunc     func(ctx context.Context, providerName, z, x, yPng string) (string, error)
	prewarmViewFunc func(ctx context.Context, req model.PrewarmViewRequest) (model.PrewarmViewResponse, error)
	getStatsFunc    func() model.StatusResponse
}

func (m *mockTilesService) GetTile(ctx context.Context, providerName, z, x, yPng string) (string, error) {
	return m.getTileFunc(ctx, providerName, z, x, yPng)
}

func (m *mockTilesService) PrewarmView(ctx context.Context, req model.PrewarmViewRequest) (model.PrewarmViewResponse, error) {
	return m.prewarmViewFunc(ctx, req)
}

func (m *mockTilesService) GetStats() model.StatusResponse {
	return m.getStatsFunc()
}

func TestTileConfigHandler(t *testing.T) {
	cfg := &config.Config{
		Providers: map[string]config.TileProviderConfig{
			"test": {
				Name:        "Test Provider",
				IsTMS:       true,
				Attribution: "Test Attribution",
				ZoomRange:   [2]int{1, 10},
			},
		},
		Offline: true,
	}
	h := New(cfg, nil, nil)

	req := httptest.NewRequest("GET", "/api/tile-config", nil)
	rr := httptest.NewRecorder()

	h.TileConfig(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp model.TileConfigResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	if resp.Offline != true {
		t.Error("expected offline to be true")
	}
	p, ok := resp.Providers["test"]
	if !ok || p.Name != "Test Provider" || p.MinZoom != 1 || p.MaxZoom != 10 {
		t.Errorf("unexpected provider config: %+v", p)
	}
}

func TestTileProxyHandler(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		mockError      error
		expectedStatus int
	}{
		{
			name:           "Success",
			path:           "/tiles/test/1/2/3.png",
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Unknown Provider",
			path:           "/tiles/unknown/1/2/3.png",
			mockError:      context.DeadlineExceeded, // Service returns error, handler maps it
			expectedStatus: http.StatusBadGateway,
		},
		{
			name:           "Invalid Request Path",
			path:           "/tiles/too/short",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a temporary file to serve
			tmpFile, err := os.CreateTemp("", "tile*.png")
			if err != nil {
				t.Fatal(err)
			}
			defer os.Remove(tmpFile.Name())

			mockTiles := &mockTilesService{
				getTileFunc: func(ctx context.Context, providerName, z, x, yPng string) (string, error) {
					if tt.mockError != nil {
						return "", tt.mockError
					}
					return tmpFile.Name(), nil
				},
			}
			h := New(nil, nil, mockTiles)

			req := httptest.NewRequest("GET", tt.path, nil)
			rr := httptest.NewRecorder()

			h.TileProxy(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rr.Code)
			}
		})
	}
}

func TestTileProxyHandler_SpecificErrors(t *testing.T) {
	errorTests := []struct {
		errText        string
		expectedStatus int
	}{
		{"unknown provider", http.StatusNotFound},
		{"offline mode", http.StatusNotFound},
		{"upstream status 404", http.StatusNotFound},
		{"random error", http.StatusBadGateway},
	}

	for _, tt := range errorTests {
		t.Run(tt.errText, func(t *testing.T) {
			h := New(nil, nil, &mockTilesService{
				getTileFunc: func(ctx context.Context, providerName, z, x, yPng string) (string, error) {
					return "", &customError{tt.errText}
				},
			})

			req := httptest.NewRequest("GET", "/tiles/test/1/2/3.png", nil)
			rr := httptest.NewRecorder()
			h.TileProxy(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("for error %q expected %d, got %d", tt.errText, tt.expectedStatus, rr.Code)
			}
		})
	}
}

func TestListGPXHandler(t *testing.T) {
	mockGPX := &mockGPXService{
		listFilesFunc: func() ([]model.GPXFile, error) {
			return []model.GPXFile{{Name: "test.gpx"}}, nil
		},
	}
	h := New(nil, mockGPX, nil)

	req := httptest.NewRequest("GET", "/api/gpx", nil)
	rr := httptest.NewRecorder()

	h.ListGPXFiles(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp []model.GPXFile
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	if len(resp) != 1 || resp[0].Name != "test.gpx" {
		t.Errorf("unexpected response: %+v", resp)
	}
}

func TestStatusHandler(t *testing.T) {
	mockTiles := &mockTilesService{
		getStatsFunc: func() model.StatusResponse {
			return model.StatusResponse{CacheHits: 123}
		},
	}
	h := New(nil, nil, mockTiles)

	req := httptest.NewRequest("GET", "/api/status", nil)
	rr := httptest.NewRecorder()

	h.Status(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}

	var resp model.StatusResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}

	if resp.CacheHits != 123 {
		t.Errorf("expected 123 hits, got %d", resp.CacheHits)
	}
}

type customError struct{ text string }

func (e *customError) Error() string { return e.text }

func TestPrewarmViewHandler(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		body           interface{}
		mockError      error
		expectedStatus int
	}{
		{
			name:           "Success",
			method:         "POST",
			body:           model.PrewarmViewRequest{ProviderKey: "test"},
			mockError:      nil,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Method Not Allowed",
			method:         "GET",
			body:           nil,
			mockError:      nil,
			expectedStatus: http.StatusMethodNotAllowed,
		},
		{
			name:           "Invalid JSON",
			method:         "POST",
			body:           "invalid json",
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing Provider Key",
			method:         "POST",
			body:           model.PrewarmViewRequest{},
			mockError:      nil,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Unknown Provider",
			method:         "POST",
			body:           model.PrewarmViewRequest{ProviderKey: "unknown"},
			mockError:      &customError{"unknown provider"},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Offline Mode",
			method:         "POST",
			body:           model.PrewarmViewRequest{ProviderKey: "test"},
			mockError:      &customError{"offline mode"},
			expectedStatus: http.StatusConflict,
		},
		{
			name:           "Too Many Tiles",
			method:         "POST",
			body:           model.PrewarmViewRequest{ProviderKey: "test"},
			mockError:      &customError{"too many tiles"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Internal Error",
			method:         "POST",
			body:           model.PrewarmViewRequest{ProviderKey: "test"},
			mockError:      &customError{"something went wrong"},
			expectedStatus: http.StatusBadGateway,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockTiles := &mockTilesService{
				prewarmViewFunc: func(ctx context.Context, req model.PrewarmViewRequest) (model.PrewarmViewResponse, error) {
					return model.PrewarmViewResponse{Total: 10}, tt.mockError
				},
			}
			h := New(nil, nil, mockTiles)

			var reader io.Reader
			if tt.body != nil {
				if s, ok := tt.body.(string); ok {
					reader = strings.NewReader(s)
				} else {
					b, _ := json.Marshal(tt.body)
					reader = bytes.NewReader(b)
				}
			}

			req := httptest.NewRequest(tt.method, "/api/prewarm-view", reader)
			rr := httptest.NewRecorder()

			h.PrewarmView(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rr.Code)
			}
		})
	}
}
