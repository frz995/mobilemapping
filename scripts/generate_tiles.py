import os
import math
import json
import argparse
from PIL import Image

def generate_tiles(image_path, output_dir, tile_size=512):
    """
    Generates multi-resolution tiles for Pannellum (equirectangular).
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    img = Image.open(image_path)
    width, height = img.size
    
    # Calculate max levels
    # We want the lowest level to fit within a single tile (or close to it)
    max_level = math.ceil(math.log(max(width, height) / tile_size, 2))
    
    config = {
        "type": "multires",
        "multiRes": {
            "path": "%l/%y_%x",
            "fallbackPath": "fallback/%s",
            "extension": "jpg",
            "tileResolution": tile_size,
            "maxLevel": max_level,
            "cubeResolution": width / 4 # Approximate
        }
    }

    print(f"Processing {image_path}...")
    print(f"Original size: {width}x{height}")
    print(f"Max level: {max_level}")

    # Create fallback image (small version)
    fallback_dir = os.path.join(output_dir, "fallback")
    if not os.path.exists(fallback_dir):
        os.makedirs(fallback_dir)
    
    fallback_img = img.copy()
    fallback_img.thumbnail((1024, 512)) # Reasonable fallback size
    fallback_img.save(os.path.join(fallback_dir, "f.jpg"), quality=85)
    
    # Process each level
    current_img = img
    for level in range(max_level, 0, -1):
        level_dir = os.path.join(output_dir, str(level))
        if not os.path.exists(level_dir):
            os.makedirs(level_dir)
            
        current_width, current_height = current_img.size
        cols = math.ceil(current_width / tile_size)
        rows = math.ceil(current_height / tile_size)
        
        print(f"  Level {level}: {current_width}x{current_height} ({cols}x{rows} tiles)")
        
        for y in range(rows):
            for x in range(cols):
                # Calculate tile box
                left = x * tile_size
                upper = y * tile_size
                right = min(left + tile_size, current_width)
                lower = min(upper + tile_size, current_height)
                
                tile = current_img.crop((left, upper, right, lower))
                
                # If tile is partial (right/bottom edge), pad it? 
                # Pannellum handles partial tiles, but usually expects full squares.
                # Let's just save as is.
                tile_path = os.path.join(level_dir, f"{y}_{x}.jpg")
                tile.save(tile_path, quality=85)
        
        # Downscale for next level
        if level > 1:
            new_width = current_width // 2
            new_height = current_height // 2
            current_img = current_img.resize((new_width, new_height), Image.LANCZOS)

    # Save config.json
    config_path = os.path.join(output_dir, "config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
        
    print(f"Done! Config saved to {config_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate multi-res tiles for Pannellum")
    parser.add_argument("input", help="Input image file (JPG/PNG)")
    parser.add_argument("output", help="Output directory")
    parser.add_argument("--tile-size", type=int, default=512, help="Tile size (default 512)")
    
    args = parser.parse_args()
    
    generate_tiles(args.input, args.output, args.tile_size)
