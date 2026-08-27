#!/usr/bin/env python3
import glob
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed

# ==============================================================================
# CONFIGURATION
# ==============================================================================
RAW_DIR = r"D:\Webmap\360 web mapping\360 web mapping\public\MMS_PIC"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TILES_DIR = os.path.join(BASE_DIR, "processed_tiles")
R2_REMOTE_BUCKET = "r2:geosphere-panorama/tiles"
CUBESIZE = 2048
CLEANUP_LOCAL_TILES_AFTER_UPLOAD = False
MAX_WORKERS = max(1, os.cpu_count() - 1)
NONA_PATH = r"C:\Program Files\Hugin\bin\nona.exe"
GENERATE_PY_PATH = os.path.join(BASE_DIR, "generate.py")
RCLONE_EXE_PATH = os.path.join(BASE_DIR, "rclone.exe")
# ==============================================================================


def extract_subgrid(image_path: str) -> str:
    """Extracts the subgrid folder name safely."""
    rel = os.path.relpath(image_path, RAW_DIR)
    parts = rel.split(os.sep)
    if len(parts) > 1:
        return parts[0]
    base = os.path.splitext(os.path.basename(image_path))[0]
    return base.split("-")[0] if "-" in base else "general"


def slice_single_image(image_path: str) -> tuple[str, str]:
    """Runs generate.py in an isolated working directory to eliminate file locking."""
    filename = os.path.basename(image_path)
    pano_id = os.path.splitext(filename)[0]
    subgrid = extract_subgrid(image_path)

    # Subgrid directory (e.g., ./processed_tiles/N93E70)
    subgrid_dir = os.path.abspath(os.path.join(TILES_DIR, subgrid))
    target_output_dir = os.path.join(subgrid_dir, pano_id)
    config_file = os.path.join(target_output_dir, "config.json")

    # Skip if already fully sliced
    if os.path.exists(config_file):
        return "SKIPPED", f"[SKIPPED] {pano_id} (Already exists in {subgrid}/{pano_id})"

    # Clean incomplete or interrupted previous attempts so generate.py doesn't complain
    if os.path.exists(target_output_dir):
        shutil.rmtree(target_output_dir, ignore_errors=True)

    # Ensure parent subgrid directory exists, but DO NOT create target_output_dir
    os.makedirs(subgrid_dir, exist_ok=True)

    worker_temp_dir = tempfile.mkdtemp(prefix=f"pano_work_{pano_id}_")

    cmd = [
        sys.executable,
        GENERATE_PY_PATH,
        "-n",
        NONA_PATH,
        "--haov",
        "360",
        "--vaov",
        "180",
        "--cubesize",
        str(CUBESIZE),
        "-o",
        target_output_dir,
        os.path.abspath(image_path),
    ]

    try:
        res = subprocess.run(
            cmd,
            cwd=worker_temp_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        if os.path.exists(config_file):
            return "DONE", f"[DONE] {pano_id} (Sliced into {subgrid}/{pano_id})"
        else:
            shutil.rmtree(target_output_dir, ignore_errors=True)
            err_lines = [
                line
                for line in (res.stderr or "").splitlines()
                if "pyshtools" not in line
            ]
            clean_err = " ".join(err_lines).strip() or res.stdout.strip() or "Tile generation incomplete"
            return "FAILED", f"[FAILED] {pano_id}: {clean_err}"

    except Exception as e:
        shutil.rmtree(target_output_dir, ignore_errors=True)
        return "FAILED", f"[FAILED] {pano_id}: {str(e)}"

    finally:
        shutil.rmtree(worker_temp_dir, ignore_errors=True)


def sync_tiles_to_r2():
    """Uploads processed subgrid tiles to Cloudflare R2."""
    print("\n=======================================================")
    print("  Syncing Sliced Tiles to Cloudflare R2 via rclone")
    print("=======================================================")

    cmd = [
        RCLONE_EXE_PATH,
        "copy",
        TILES_DIR,
        R2_REMOTE_BUCKET,
        "--transfers=32",
        "--checkers=64",
        "--fast-list",
        "--progress",
    ]

    try:
        subprocess.run(cmd, check=True)
        print("\n[SUCCESS] All tiles synced to Cloudflare R2 successfully.")

        if CLEANUP_LOCAL_TILES_AFTER_UPLOAD:
            print("[CLEANUP] Removing local tiles folder to free disk space...")
            shutil.rmtree(TILES_DIR, ignore_errors=True)
            print("[CLEANUP] Done.")

    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] rclone sync failed: {e}")


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(TILES_DIR, exist_ok=True)

    image_patterns = [
        os.path.join(RAW_DIR, "**", f"*{ext}")
        for ext in (".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG")
    ]

    images = []
    for pattern in image_patterns:
        images.extend(glob.glob(pattern, recursive=True))

    valid_images = []
    for img in set(images):
        if "processed_tiles" in img:
            continue
        rel = os.path.relpath(img, RAW_DIR)
        if os.sep in rel:
            valid_images.append(img)

    valid_images.sort()
    total_images = len(valid_images)

    if total_images == 0:
        print(f"No subgrid panorama images found inside '{RAW_DIR}'.")
        return

    print(f"Found {total_images} valid panoramas across subgrids.")
    print(f"Processing slices using {MAX_WORKERS} isolated parallel workers...")
    print("-------------------------------------------------------")

    counts = {"DONE": 0, "SKIPPED": 0, "FAILED": 0}
    failed_files = []

    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(slice_single_image, img): img for img in valid_images}
        for future in as_completed(futures):
            status, msg = future.result()
            counts[status] += 1
            if status == "FAILED":
                failed_files.append((futures[future], msg))
            print(msg)

    total_ready = counts["DONE"] + counts["SKIPPED"]

    print("-------------------------------------------------------")
    print(f"Summary: {total_ready}/{total_images} Panoramas Ready")
    print(f"  • Newly Sliced : {counts['DONE']}")
    print(f"  • Pre-Existing : {counts['SKIPPED']}")
    print(f"  • Failed       : {counts['FAILED']}")
    print("-------------------------------------------------------")

    if failed_files:
        print(f"\n[!] Failed files ({len(failed_files)}):")
        for f, err in failed_files:
            print(f"  - {f}\n    Reason: {err}")

    if total_ready == 0:
        print("\nNo tiles available to upload.")
        return

    while True:
        choice = (
            input(
                f"\nProceed with uploading {total_ready} panoramas to Cloudflare R2 ({R2_REMOTE_BUCKET})? [y/n]: "
            )
            .strip()
            .lower()
        )
        if choice in ("y", "yes"):
            sync_tiles_to_r2()
            break
        elif choice in ("n", "no"):
            print("\n[CANCELLED] Cloudflare upload skipped.")
            break
        else:
            print("Please enter 'y' to upload or 'n' to cancel.")


if __name__ == "__main__":
    main()