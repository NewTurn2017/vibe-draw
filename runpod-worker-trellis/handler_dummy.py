"""Dummy RunPod handler used to validate the end-to-end pipeline before the
real TRELLIS build is finalized.

Same input/output contract as the real handler.py — the only difference is
that we DO NOT run a 3D model. We pretend the work took ~3 seconds and
upload a pre-baked sample .glb (a small Khronos Box) to R2 under a unique
key, then return its public URL. Everything else — R2 wiring, RunPod
job lifecycle, backend WebSocket pickup, frontend GLTF load — is exercised
for real.
"""

from __future__ import annotations

import base64
import os
import time
import uuid
from typing import Any, Dict, Optional

import runpod

SAMPLE_GLB_PATH = "/workspace/sample.glb"


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
    if not payload.get("image"):
        return {"error": "input.image is required"}

    # Simulate compute so the WS polling on the backend side gets to emit
    # at least one 'processing' update before completion.
    time.sleep(3)

    job_id = event.get("id") or uuid.uuid4().hex
    url = _upload_to_r2(SAMPLE_GLB_PATH, f"trellis/{job_id}.glb")
    elapsed = round(time.time() - started, 2)

    if url:
        return {
            "model_file": url,
            "elapsed_sec": elapsed,
            "seed": int(payload.get("seed", 0)),
            "dummy": True,
        }

    with open(SAMPLE_GLB_PATH, "rb") as fh:
        data = fh.read()
    return {
        "model_b64": base64.b64encode(data).decode("ascii"),
        "elapsed_sec": elapsed,
        "seed": int(payload.get("seed", 0)),
        "dummy": True,
        "warning": "R2_BUCKET not configured; returning base64 GLB",
    }


runpod.serverless.start({"handler": handler})
