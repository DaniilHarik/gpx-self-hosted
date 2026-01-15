package cache

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"gpx-self-host/internal/model"
)

type CacheItem struct {
	Metadata model.GPXMetadata `json:"metadata"`
	Size     int64             `json:"size"`
	ModTime  int64             `json:"modTime"`
}

type Cache struct {
	path  string
	items map[string]CacheItem
	mu    sync.RWMutex
}

func NewCache(path string) *Cache {
	return &Cache{
		path:  path,
		items: make(map[string]CacheItem),
	}
}

func (c *Cache) Load() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := os.ReadFile(c.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	if err := json.Unmarshal(data, &c.items); err != nil {
		return err
	}

	slog.Info("Loaded metadata cache", "path", c.path, "entries", len(c.items))
	return nil
}

func (c *Cache) Save() error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data, err := json.MarshalIndent(c.items, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(c.path), 0755); err != nil {
		return err
	}

	if err := os.WriteFile(c.path, data, 0644); err != nil {
		return err
	}

	slog.Info("Saved metadata cache", "path", c.path, "entries", len(c.items))
	return nil
}

func (c *Cache) Get(path string, size int64, modTime int64) (model.GPXMetadata, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, ok := c.items[path]
	if !ok {
		slog.Debug("Metadata cache miss", "path", path)
		return model.GPXMetadata{}, false
	}

	if item.Size != size || item.ModTime != modTime {
		slog.Info("Metadata cache invalidated", "path", path)
		return model.GPXMetadata{}, false
	}

	return item.Metadata, true
}

func (c *Cache) Set(path string, metadata model.GPXMetadata, size int64, modTime int64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items[path] = CacheItem{
		Metadata: metadata,
		Size:     size,
		ModTime:  modTime,
	}
}
