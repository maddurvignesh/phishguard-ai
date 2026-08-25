"""
compress_models.py — Compress model files for Vercel deployment.

Run this script before deploying to Vercel:
    python compress_models.py

This reduces model size by ~60% using joblib compression.
"""

import joblib
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"


def compress_model(input_path: Path, output_path: Path):
    print(f"Loading {input_path.name}...")
    model = joblib.load(input_path)
    
    print(f"Compressing to {output_path.name}...")
    joblib.dump(model, output_path, compress=3)
    
    original_size = input_path.stat().st_size / (1024 * 1024)
    compressed_size = output_path.stat().st_size / (1024 * 1024)
    reduction = (1 - compressed_size / original_size) * 100
    
    print(f"  Original: {original_size:.2f} MB")
    print(f"  Compressed: {compressed_size:.2f} MB")
    print(f"  Reduction: {reduction:.1f}%")
    print()


def main():
    print("=" * 50)
    print("PhishGuard AI - Model Compression for Vercel")
    print("=" * 50)
    print()
    
    # Compress best model
    best_model = MODELS_DIR / "phishguard_model.joblib"
    best_compressed = MODELS_DIR / "phishguard_model_compressed.joblib"
    
    if best_model.exists():
        compress_model(best_model, best_compressed)
    else:
        print(f"Warning: {best_model} not found")
    
    # Compress all models
    all_models = MODELS_DIR / "all_models.joblib"
    all_compressed = MODELS_DIR / "all_models_compressed.joblib"
    
    if all_models.exists():
        compress_model(all_models, all_compressed)
    else:
        print(f"Warning: {all_models} not found")
    
    print("=" * 50)
    print("Compression complete!")
    print()
    print("Next steps:")
    print("1. Update api/_lib/model.py to use compressed models")
    print("2. Deploy to Vercel with: vercel --prod")
    print("=" * 50)


if __name__ == "__main__":
    main()
