# RunPod Serverless TRELLIS worker

Self-hosted replacement for the piapi.ai Trellis dependency that the backend
used. One container on a single RTX 4090 (24 GB) handles a TRELLIS
image-to-3D job and returns a `.glb` URL.

## Files

- `Dockerfile` — CUDA 12.1 + PyTorch 2.4 + TRELLIS upstream + RunPod SDK.
- `handler.py` — RunPod Serverless entrypoint. Decodes the request image,
  runs the pipeline, exports `.glb`, uploads to S3-compatible storage, and
  returns `{ model_file: <url> }`.

## One-time setup

1. Pick a container registry (Docker Hub, GHCR, ECR, etc.) and decide on an
   image tag, e.g. `your-org/trellis-runpod:1.0.0`.
2. Pick an object store for the resulting `.glb` files. Anything S3-compatible
   works — Cloudflare R2 and Backblaze B2 are both cheap. Note the endpoint,
   bucket name, and access key/secret.
3. (Optional) If the TRELLIS weights repo you use is HF-gated, generate a HF
   access token.

## Build & push

```bash
cd runpod-worker-trellis

# If the HF weights repo is gated:
export HF_TOKEN=hf_xxx

docker buildx build \
  --platform linux/amd64 \
  --build-arg HUGGINGFACE_HUB_TOKEN="$HF_TOKEN" \
  -t your-org/trellis-runpod:1.0.0 \
  --push \
  .
```

The first build is large (~25 GB) because TRELLIS pulls weights and heavy
CUDA wheels. Subsequent rebuilds reuse cache.

## Deploy on RunPod

1. RunPod → Serverless → New Endpoint.
2. Container image: `your-org/trellis-runpod:1.0.0`.
3. GPU type: **RTX 4090** (or RTX 4090 community for cheaper rate). 24 GB
   VRAM is enough for default TRELLIS settings.
4. Container disk: ≥ 40 GB.
5. Max workers: start with 1–2; scale on demand.
6. Idle timeout: 5–30 s (keep low to avoid burning $$ between requests).
7. Enable **FlashBoot** to cut cold starts (TRELLIS load is the long part).
8. Environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `TRELLIS_REPO` | no | HF repo to pull weights from. Default `jetx/trellis-image-large`. |
| `HUGGINGFACE_HUB_TOKEN` | only if HF repo is gated | Read-only HF token |
| `R2_ENDPOINT_URL` | yes for URL output | e.g. `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | yes for URL output | bucket name |
| `R2_ACCESS_KEY_ID` | yes for URL output | R2 API token: Object Read & Write |
| `R2_SECRET_ACCESS_KEY` | yes for URL output | |
| `R2_PUBLIC_BASE_URL` | optional | r2.dev subdomain or custom domain; otherwise a presigned URL is returned |
| `R2_URL_TTL` | optional | presigned URL TTL in seconds (default 86400) |

If R2 vars are missing the handler returns the `.glb` as base64 in
`model_b64`, which is fine for quick smoke tests but too heavy for
production traffic — set up R2 before going live.

9. After the endpoint is provisioned, copy the **endpoint ID** and an
   **API key** from RunPod settings and put them in
   `backend/.env`:

   ```bash
   RUNPOD_API_KEY=...
   RUNPOD_TRELLIS_ENDPOINT_ID=...
   ```

## Local sanity check

```bash
# rough host-side smoke test (needs nvidia-docker + a 4090)
docker run --rm --gpus all \
  --env-file .env \
  hyuni2020/trellis-runpod:1.0.0 \
  python -c "from handler import handler; print(handler({'input': {'image': 'https://...png'}}))"
```

## Wire-up summary

```
frontend → /api/trellis/task (POST)            → RunPod /run        → returns job_id
frontend → /api/trellis/task/ws/{job_id} (WS) → poll RunPod /status → emits {status, data: <glb_url>}
```

Frontend code at `frontend/app/lib/vibe3DCode.tsx` is unchanged — the
backend keeps the same response envelope (`data.task_id`, then a WS that
yields `{status: "completed", data: <url>}`).
