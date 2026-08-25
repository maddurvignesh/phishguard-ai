# Vercel Deployment Guide for PhishGuard AI

## Prerequisites

1. **Vercel account** - Sign up at https://vercel.com
2. **Vercel CLI** - Install with `npm i -g vercel`
3. **Node.js 18+** - For frontend build

## Step 1: Compress Models

The model files are ~57MB each, which exceeds Vercel's limits. Run the compression script:

```bash
python compress_models.py
```

This creates compressed versions (~20MB each) in the `models/` directory.

## Step 2: Update .gitignore

Add these lines to your `.gitignore`:

```gitignore
# Vercel
.vercel/

# Original large models (keep compressed versions)
models/phishguard_model.joblib
models/all_models.joblib
```

## Step 3: Login to Vercel

```bash
vercel login
```

## Step 4: Deploy to Vercel

### Development (preview)
```bash
vercel
```

### Production
```bash
vercel --prod
```

## Step 5: Configure Environment Variables (Optional)

In Vercel Dashboard → Settings → Environment Variables:

- `PYTHON_PATH` - Path to Python (if needed)
- `NODE_ENV` - Set to `production`

## Important Notes

### Model Loading
- Models are loaded on cold start (first request after idle)
- Warm invocations reuse the cached model
- First request may take 5-10 seconds

### In-Memory Database
- Analysis history is stored in-memory
- History is lost on cold starts
- For persistent storage, use Turso/Vercel Postgres

### File Size Limits
- Vercel free tier: 100MB deployment size
- Compressed models: ~20MB each
- Total deployment: ~50MB (within limits)

## Troubleshooting

### "Model not found" error
- Run `python compress_models.py` first
- Ensure `models/` directory is committed to git

### Cold start timeout
- Increase `maxDuration` in `vercel.json`
- Consider using Vercel Pro tier

### CORS errors
- Ensure frontend and backend are on same Vercel project
- API routes use relative paths (`/api/...`)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Vercel Project                      │
├─────────────────────────────────────────────────────┤
│  Frontend (Static)     │  Backend (Serverless)       │
│  React + TypeScript    │  Python functions           │
│  Built with Vite       │  /api/* routes              │
│  Served from CDN       │  Model loaded on cold start │
└─────────────────────────────────────────────────────┘
```

## Alternative: External Model Storage

If model files are too large, host them externally:

1. Upload to GitHub Releases / S3 / Cloudflare R2
2. Update `api/_lib/model.py` to download on cold start
3. Set `MODEL_STORAGE_URL` environment variable
