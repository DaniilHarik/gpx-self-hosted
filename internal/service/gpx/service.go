package gpx

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gpx-self-host/internal/model"
)

type Service struct {
	DataDir string
}

func NewService(dataDir string) *Service {
	return &Service{DataDir: dataDir}
}

func (s *Service) ListFiles() ([]model.GPXFile, error) {
	var files []model.GPXFile

	scanRoots := []string{"Activities", "Plans"}

	for _, root := range scanRoots {
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
			if err != nil {
				return err
			}
			if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), ".gpx") {
				relPath, err := filepath.Rel(s.DataDir, path)
				if err != nil {
					return err
				}
				relPath = filepath.ToSlash(relPath)
				files = append(files, model.GPXFile{
					Name:         d.Name(),
					Path:         "/data/" + relPath,
					RelativePath: relPath,
				})
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	return files, nil
}
