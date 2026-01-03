package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

func newPackageCmd() *cobra.Command {
	var (
		inputDir  string
		outputZip string
		gameExe   string
	)

	cmd := &cobra.Command{
		Use:   "package",
		Short: "Package DOS game files into a ZIP file ready for blockchain upload",
		Long: `Package DOS game files into a ZIP file that can be uploaded to the blockchain
and run directly in the browser using JS-DOS.

The ZIP file will contain all game files with proper structure for DOS emulation.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if inputDir == "" {
				return fmt.Errorf("--dir is required")
			}

			// Validate input directory
			info, err := os.Stat(inputDir)
			if err != nil {
				return fmt.Errorf("cannot access directory %s: %w", inputDir, err)
			}
			if !info.IsDir() {
				return fmt.Errorf("%s is not a directory", inputDir)
			}

			// Determine output filename
			outputFile := outputZip
			if outputFile == "" {
				dirName := filepath.Base(inputDir)
				if dirName == "." || dirName == "/" {
					dirName = "game"
				}
				outputFile = dirName + ".zip"
			}

			fmt.Printf("Packaging DOS game from directory: %s\n", inputDir)
			fmt.Printf("Output file: %s\n", outputFile)

			// Create ZIP file
			zipFile, err := os.Create(outputFile)
			if err != nil {
				return fmt.Errorf("failed to create ZIP file: %w", err)
			}
			defer zipFile.Close()

			zipWriter := zip.NewWriter(zipFile)
			defer zipWriter.Close()

			// Find game executable if not specified
			gameExecutable := gameExe
			if gameExecutable == "" {
				gameExecutable = findGameExecutable(inputDir)
				if gameExecutable == "" {
					fmt.Printf("Warning: No game executable found (.exe, .com, or .bat). You may need to specify --exe\n")
				} else {
					fmt.Printf("Found game executable: %s\n", gameExecutable)
				}
			}

			// Walk directory and add files to ZIP
			var filesAdded int
			var totalSize int64
			err = filepath.Walk(inputDir, func(path string, info os.FileInfo, err error) error {
				if err != nil {
					return err
				}

				// Skip directories
				if info.IsDir() {
					return nil
				}

				// Skip the output ZIP file if it's in the directory
				if filepath.Base(path) == filepath.Base(outputFile) {
					return nil
				}

				// Get relative path from input directory
				relPath, err := filepath.Rel(inputDir, path)
				if err != nil {
					return err
				}

				// Normalize path separators to forward slashes (DOS/Windows compatibility)
				zipPath := strings.ReplaceAll(relPath, "\\", "/")

				// Open source file
				srcFile, err := os.Open(path)
				if err != nil {
					return fmt.Errorf("failed to open %s: %w", path, err)
				}
				defer srcFile.Close()

				// Create file in ZIP
				zipEntry, err := zipWriter.Create(zipPath)
				if err != nil {
					return fmt.Errorf("failed to create ZIP entry for %s: %w", zipPath, err)
				}

				// Copy file contents
				written, err := io.Copy(zipEntry, srcFile)
				if err != nil {
					return fmt.Errorf("failed to write %s to ZIP: %w", zipPath, err)
				}

				filesAdded++
				totalSize += written
				fmt.Printf("  Added: %s (%d bytes)\n", zipPath, written)

				return nil
			})

			if err != nil {
				return fmt.Errorf("failed to package files: %w", err)
			}

			// Close ZIP writer before calculating hash
			zipWriter.Close()
			zipFile.Close()

			// Calculate SHA256 of the ZIP file
			hash, err := calculateSHA256(outputFile)
			if err != nil {
				fmt.Printf("Warning: failed to calculate SHA256: %v\n", err)
			} else {
				fmt.Printf("\nSHA256: %s\n", hash)
			}

			fmt.Printf("\n✓ Successfully created ZIP package:\n")
			fmt.Printf("  File: %s\n", outputFile)
			fmt.Printf("  Files: %d\n", filesAdded)
			fmt.Printf("  Total size: %d bytes (%.2f KB)\n", totalSize, float64(totalSize)/1024)
			if gameExecutable != "" {
				fmt.Printf("  Game executable: %s\n", gameExecutable)
				fmt.Printf("\nThis ZIP file is ready to upload to the blockchain.\n")
				fmt.Printf("After syncing and verifying, users can run it directly in the browser using JS-DOS.\n")
			} else {
				fmt.Printf("\nWarning: No game executable found. Make sure your ZIP contains a .exe, .com, or .bat file.\n")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&inputDir, "dir", "", "Directory containing game files to package")
	cmd.Flags().StringVar(&outputZip, "output", "", "Output ZIP file path (default: <dirname>.zip)")
	cmd.Flags().StringVar(&gameExe, "exe", "", "Main game executable (e.g., DOOM.EXE). If not specified, will try to find .exe, .com, or .bat files")
	cmd.MarkFlagRequired("dir")

	return cmd
}

func findGameExecutable(dir string) string {
	var executables []string

	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".exe" || ext == ".com" || ext == ".bat" {
			relPath, err := filepath.Rel(dir, path)
			if err == nil {
				executables = append(executables, strings.ReplaceAll(relPath, "\\", "/"))
			}
		}
		return nil
	})

	// Prefer .exe, then .com, then .bat
	for _, ext := range []string{".exe", ".com", ".bat"} {
		for _, exe := range executables {
			if strings.HasSuffix(strings.ToLower(exe), ext) {
				return exe
			}
		}
	}

	return ""
}

func calculateSHA256(filename string) (string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}
