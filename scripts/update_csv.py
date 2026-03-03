import csv
import os
import glob

def update_csv_with_tiles():
    # Base directories relative to project root
    public_dir = "public"
    tiles_dir = os.path.join(public_dir, "tiles")
    
    # Find all CSV files in public folder
    csv_files = glob.glob(os.path.join(public_dir, "*.csv"))
    
    print(f"Found {len(csv_files)} CSV files in {public_dir}")
    
    for csv_path in csv_files:
        print(f"Processing {csv_path}...")
        updated_rows = []
        fieldnames = []
        modified = False
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    print(f"  Skipping empty file: {csv_path}")
                    continue
                    
                fieldnames = list(reader.fieldnames)
                if 'config_url' not in fieldnames:
                    fieldnames.append('config_url')
                    modified = True
                
                for row in reader:
                    # Get filename from row
                    filename = row.get('filename') or row.get('image_name')
                    
                    if filename:
                        # Remove extension to get directory name
                        name_without_ext = os.path.splitext(filename)[0]
                        
                        # Check if tile config exists for this image
                        # Structure: public/tiles/<name>/config.json
                        tile_config_path = os.path.join(tiles_dir, name_without_ext, "config.json")
                        
                        if os.path.exists(tile_config_path):
                            # Set the config_url relative to public root (for web access)
                            new_config_url = f"tiles/{name_without_ext}/config.json"
                            
                            if row.get('config_url') != new_config_url:
                                row['config_url'] = new_config_url
                                modified = True
                        else:
                            # If no tile config, ensure empty string if column didn't exist
                            if 'config_url' not in row:
                                row['config_url'] = ''
                    else:
                         if 'config_url' not in row:
                            row['config_url'] = ''
                            
                    updated_rows.append(row)
            
            if modified:
                print(f"  Writing updates to {csv_path}...")
                with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(updated_rows)
            else:
                print(f"  No changes needed for {csv_path}")
                
        except Exception as e:
            print(f"  Error processing {csv_path}: {e}")

if __name__ == "__main__":
    update_csv_with_tiles()
