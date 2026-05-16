"""RunPod Serverless handler for Microsoft TRELLIS image-to-3D.

Input event shape (matches the backend's /trellis/task body):
{
  "input": {
    "image": "<https URL or data URI>",
    "seed": 0,
    "ss_sampling_steps": 12,
    "slat_sampling_steps": 12,
    "ss_guidance_strength": 7.5,
    "slat_guidance_strength": 3.0
  }
}

Output shape (consumed by the FastAPI WebSocket poller):
{
  "model_file": "<https URL to .glb>",   # or "model_url" / "glb_url"
  "preview_video": "<optional mp4 URL>"
}

Storage: by default the worker uploads the resulting .glb to Cloudflare R2
using R2_ENDPOINT_URL / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.
If those are missing the worker falls back to returning a base64 string in
`model_b64` so the pipeline still works for smoke tests.
"""

from __future__ import annotations

import base64
import io
import os
import time
import uuid
from typing import Any, Dict, Optional

import runpod
import requests
from PIL import Image

# TRELLIS pipeline import — assumes the upstream repo is on PYTHONPATH
# (handled by the Dockerfile). Update import path if upstream restructures.
from trellis.pipelines import TrellisImageTo3DPipeline  # type: ignore
from trellis.utils import postprocessing_utils  # type: ignore

_PIPELINE: Optional[TrellisImageTo3DPipeline] = None


def _load_pipeline() -> TrellisImageTo3DPipeline:
    global _PIPELINE
    if _PIPELINE is None:
        repo = os.environ.get("TRELLIS_REPO", "microsoft/TRELLIS-image-large")
        pipeline = TrellisImageTo3DPipeline.from_pretrained(repo)
        pipeline.cuda()
        _PIPELINE = pipeline
    return _PIPELINE


def _decode_image(image_field: str) -> Image.Image:
    if image_field.startswith("data:"):
        _, b64 = image_field.split(",", 1)
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    if image_field.startswith(("http://", "https://")):
        resp = requests.get(image_field, timeout=30)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    # Assume raw base64
    return Image.open(io.BytesIO(base64.b64decode(image_field))).convert("RGB")


def _upload_to_r2(local_path: str, key: str) -> Optional[str]:
    bucket = os.environ.get("R2_BUCKET")
    endpoint = os.environ.get("R2_ENDPOINT_URL")
    if not bucket or not endpoint:
        return None
    import boto3

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )
    s3.upload_file(local_path, bucket, key, ExtraArgs={"ContentType": "model/gltf-binary"})
    public_base = os.environ.get("R2_PUBLIC_BASE_URL")
    if public_base:
        return f"{public_base.rstrip('/')}/{key}"
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=int(os.environ.get("R2_URL_TTL", "86400")),
    )


def handler(event: Dict[str, Any]) -> Dict[str, Any]:
    started = time.time()
    payload = event.get("input") or {}
    image_field = payload.get("image")
    if not image_field:
        return {"error": "input.image is required"}

    seed = int(payload.get("seed", 0))
    ss_steps = int(payload.get("ss_sampling_steps", 12))
    slat_steps = int(payload.get("slat_sampling_steps", 12))
    ss_cfg = float(payload.get("ss_guidance_strength", 7.5))
    slat_cfg = float(payload.get("slat_guidance_strength", 3.0))

    image = _decode_image(image_field)
    pipeline = _load_pipeline()

    outputs = pipeline.run(
        image,
        seed=seed,
        sparse_structure_sampler_params={"steps": ss_steps, "cfg_strength": ss_cfg},
        slat_sampler_params={"steps": slat_steps, "cfg_strength": slat_cfg},
    )

    glb = postprocessing_utils.to_glb(
        outputs["gaussian"][0],
        outputs["mesh"][0],
        simplify=0.95,
        texture_size=1024,
    )

    job_id = event.get("id") or uuid.uuid4().hex
    local_path = f"/tmp/{job_id}.glb"
    glb.export(local_path)

    url = _upload_to_r2(local_path, f"trellis/{job_id}.glb")
    elapsed = round(time.time() - started, 2)

    if url:
        return {
            "model_file": url,
            "elapsed_sec": elapsed,
            "seed": seed,
        }

    with open(local_path, "rb") as fh:
        data = fh.read()
    return {
        "model_b64": base64.b64encode(data).decode("ascii"),
        "elapsed_sec": elapsed,
        "seed": seed,
        "warning": "R2_BUCKET not configured; returning base64 GLB",
    }


# Warm the model on container start so the first real request is fast.
try:
    _load_pipeline()
except Exception as exc:  # noqa: BLE001
    print(f"[warmup] pipeline preload skipped: {exc}")


runpod.serverless.start({"handler": handler})
