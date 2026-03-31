package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	// Create directories
	dirs := []string{
		"D:/Gsoc/C-scout/cscout/cscout-lens/sample/calc",
		"D:/Gsoc/C-scout/cscout/cscout-lens/src/db",
		"D:/Gsoc/C-scout/cscout/cscout-lens/src/scripts",
		"D:/Gsoc/C-scout/cscout/cscout-lens/src/services",
		"D:/Gsoc/C-scout/cscout/cscout-lens/src/webview",
		"D:/Gsoc/C-scout/cscout/cscout-lens/src/test",
		"D:/Gsoc/C-scout/cscout/cscout-lens/resources",
	}

	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("         Creating directories with Go...")
	fmt.Println("═══════════════════════════════════════════════════════════\n")

	for _, dir := range dirs {
		// Convert to Windows path format
		winPath := filepath.FromSlash(dir)
		err := os.MkdirAll(winPath, 0755)
		if err != nil {
			fmt.Printf("✗ Error creating %s: %v\n", dir, err)
		} else {
			fmt.Printf("✓ Created: %s\n", dir)
		}
	}

	fmt.Println("\n✓ All directories created successfully!")
	fmt.Println("\n═══════════════════════════════════════════════════════════")
	fmt.Println("         Running node master-setup.js...")
	fmt.Println("═══════════════════════════════════════════════════════════\n")

	// Change to the cscout-lens directory and run node script
	cmd := exec.Command("node", "master-setup.js")
	cmd.Dir = `D:\Gsoc\C-scout\cscout\cscout-lens`
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	err := cmd.Run()
	if err != nil {
		fmt.Printf("Error running master-setup.js: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("\n✓ Script completed successfully!")
}
