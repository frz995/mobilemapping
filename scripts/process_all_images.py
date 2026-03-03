import os
import glob
import sys

# Ensure we can import from the same directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_tiles import generate_tiles

def main():
    # Define paths relative to project root
    input_dir = "MMS PIC"
    output_base_dir = os.path.join("public", "tiles")
    
    # Check if input directory exists
    if not os.path.exists(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        # Try absolute path just in case
        cwd = os.getcwd()
        print(f"Current working directory: {cwd}")
        return

    # Create output directory
    if not os.path.exists(output_base_dir):
        os.makedirs(output_base_dir)

    # Find all jpg files
    pattern = os.path.join(input_dir, "*.jpg")
    image_files = glob.glob(pattern)
    print(f"Found {len(image_files)} images in '{input_dir}'")

    for img_path in image_files:
        filename = os.path.basename(img_path)
        name_without_ext = os.path.splitext(filename)[0]
        output_dir = os.path.join(output_base_dir, name_without_ext)
        
        # Check if already processed
        if os.path.exists(os.path.join(output_dir, "config.json")):
            print(f"Skipping {filename} (already processed)")
            continue

        print(f"Processing {filename}...")
        try:
            generate_tiles(img_path, output_dir)
        except Exception as e:
            print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    main()
