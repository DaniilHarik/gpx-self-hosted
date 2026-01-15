package gpx

import (
	"context"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"gpx-self-host/internal/model"
	"gpx-self-host/internal/service/gpx/cache"
)

type Service struct {
	DataDir string
	Cache   *cache.Cache
}

func NewService(dataDir string) *Service {
	return &Service{DataDir: dataDir}
}

func (s *Service) ListFiles(ctx context.Context) ([]model.GPXFile, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var files []model.GPXFile
	cacheUpdated := false

	scanRoots := []string{"Activities", "Plans"}

	for _, root := range scanRoots {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		rootPath := filepath.Join(s.DataDir, root)
		info, err := os.Stat(rootPath)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, err
		}
		if !info.IsDir() {
			continue
		}

		err = filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
			if ctxErr := ctx.Err(); ctxErr != nil {
				return ctxErr
			}
			if err != nil {
				return err
			}
			if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), ".gpx") {
				relPath, err := filepath.Rel(s.DataDir, path)
				if err != nil {
					return err
				}
				relPath = filepath.ToSlash(relPath)

				var metadata *model.GPXMetadata
				if s.Cache != nil {
					info, err := d.Info()
					if err == nil {
						if m, ok := s.Cache.Get(relPath, info.Size(), info.ModTime().Unix()); ok {
							metadata = &m
						}
					}
				}

				if metadata == nil {
					f, err := os.Open(path)
					if err == nil {
						m, err := ParseGPX(f)
						f.Close()
						if err == nil {
							metadata = &m
							if s.Cache != nil {
								info, err := d.Info()
								if err == nil {
									s.Cache.Set(relPath, m, info.Size(), info.ModTime().Unix())
									cacheUpdated = true
								}
							}
						}
					}
				}

				files = append(files, model.GPXFile{
					Name:         d.Name(),
					Path:         "/data/" + relPath,
					RelativePath: relPath,
					Metadata:     metadata,
				})
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	if cacheUpdated && s.Cache != nil {
		if err := s.Cache.Save(); err != nil {
			slog.Error("failed to save gpx metadata cache", "error", err)
		}
	}

	return files, nil
}
