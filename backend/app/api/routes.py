import asyncio
import base64
import json
import re
import uuid
from typing import Any, Dict, Literal, Optional

import httpx
from celery.result import AsyncResult
from fastapi import APIRouter, Body, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sse_starlette.sse import EventSourceResponse

from app.api.models import (
    ClaudeResponse,
    GeminiImageResponse,
    StreamRequest,
    TaskResponse,
    TaskStatusResponse,
    TrellisRequest,
)
from app.core.config import settings
from app.core.redis import redis_service
from app.tasks.gemini_tasks import GeminiCodeEditTask, GeminiCodeGenTask, parse_threejs_with_gemini
from app.tasks.openai_tasks import parse_threejs_with_openai
from app.tasks.flux_tasks import FluxImageTask

router = APIRouter()

RUNPOD_BASE = "https://api.runpod.ai/v2"


async def get_task_result(task_id: str) -> Dict[str, Any]:
    result_json = redis_service.get_value(f"task_response:{task_id}")
    if result_json:
        return json.loads(result_json)

    task_result = AsyncResult(task_id)
    if task_result.state == "PENDING":
        return {"status": "pending"}
    if task_result.state == "FAILURE":
        return {
            "status": "error",
            "error": str(task_result.result),
            "error_type": type(task_result.result).__name__,
        }
    if task_result.state == "SUCCESS":
        return task_result.result
    return {"status": task_result.state.lower()}


@router.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    result = await get_task_result(task_id)
    status = "completed" if result.get("status") not in ["pending", "failed"] else result.get("status")

    response_model = None
    if status == "completed":
        if "images" in result:
            response_model = GeminiImageResponse(**result)
        else:
            response_model = ClaudeResponse(**result)

    return TaskStatusResponse(task_id=task_id, status=status, result=response_model)


@router.post("/queue/{type}", response_model=TaskResponse)
async def queue_task(type: str, request: StreamRequest):
    """Queue an async task.

    Types:
      - 3d:    Gemini 3 Pro generates Three.js from a 2D drawing
      - edit:  Gemini 3 Pro edits existing Three.js code
      - image: FLUX.2 (Replicate) converts a sketch into a clean render
    """
    task_id = request.task_id or str(uuid.uuid4())

    if type == "3d":
        GeminiCodeGenTask.apply_async(
            args=[
                task_id, request.image_base64, request.prompt, request.system_prompt,
                request.max_tokens, request.temperature, request.additional_params,
            ],
            task_id=task_id,
        )
    elif type == "edit":
        if not request.threejs_code:
            raise HTTPException(status_code=400, detail="Three.js code is required for editing")
        if not request.image_base64 and not request.prompt:
            raise HTTPException(status_code=400, detail="At least one of image or text prompt must be provided")
        GeminiCodeEditTask.apply_async(
            args=[
                task_id, request.threejs_code, request.image_base64, request.prompt,
                request.system_prompt, request.max_tokens, request.temperature, request.additional_params,
            ],
            task_id=task_id,
        )
    elif type == "image":
        if not request.image_base64:
            raise HTTPException(status_code=400, detail="Image base64 is required for image generation")
        FluxImageTask.apply_async(
            args=[
                task_id, request.image_base64, request.prompt, request.system_prompt,
                request.max_tokens, request.temperature, request.additional_params,
            ],
            task_id=task_id,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported task type: {type}")

    return TaskResponse(task_id=task_id)


async def event_generator(task_id: str, request: Request):
    pubsub = redis_service.subscribe(f"task_stream:{task_id}")
    try:
        while not await request.is_disconnected():
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data = json.loads(message["data"])
                event_type = data.get("event")
                yield {"event": event_type, "data": json.dumps(data.get("data"))}
                if event_type in ["complete", "error"]:
                    break
            await asyncio.sleep(0.01)
    except Exception as e:
        yield {
            "event": "error",
            "data": json.dumps({
                "status": "error",
                "error": str(e),
                "error_type": type(e).__name__,
                "task_id": task_id,
            }),
        }
    finally:
        pubsub.unsubscribe(f"task_stream:{task_id}")
        pubsub.close()


@router.get("/subscribe/{task_id}")
async def subscribe_events(task_id: str, request: Request):
    return EventSourceResponse(event_generator(task_id, request))


# -------- Parser (Gemini Flash Lite vs OpenAI nano A/B) --------

def _strip_codefence(raw: str) -> str:
    blocks = re.findall(r"```(?:javascript|js)?(.*?)```", raw, re.DOTALL)
    return blocks[0].strip() if blocks else raw.strip()


async def _parse_dispatch(provider: str, code: str) -> Dict[str, Any]:
    if provider == "gemini":
        result = await parse_threejs_with_gemini(code)
    elif provider == "openai":
        result = await parse_threejs_with_openai(code)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
    return {
        "status": "success",
        "provider": provider,
        "content": _strip_codefence(result["text"]),
        "model": result["model"],
        "usage": result["usage"],
    }


@router.post("/parse")
async def parse_code(
    provider: Literal["gemini", "openai"] = Query("gemini"),
    code: str = Body(..., media_type="text/plain"),
):
    """Extract main 3D object code from a Three.js scene. ?provider=gemini|openai for A/B."""
    return await _parse_dispatch(provider, code)


# Backward-compat alias for the existing frontend call site.
@router.post("/cerebras/parse")
async def parse_code_legacy(code: str = Body(..., media_type="text/plain")):
    return await _parse_dispatch("gemini", code)


# -------- Trellis on RunPod Serverless --------

def _runpod_endpoint() -> str:
    if not (settings.RUNPOD_API_KEY and settings.RUNPOD_TRELLIS_ENDPOINT_ID):
        raise HTTPException(status_code=500, detail="RunPod TRELLIS endpoint not configured")
    return f"{RUNPOD_BASE}/{settings.RUNPOD_TRELLIS_ENDPOINT_ID}"


def _runpod_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.RUNPOD_API_KEY}",
        "Content-Type": "application/json",
    }


def _r2_upload_base64_glb(model_b64: str, key: str) -> Optional[str]:
    """Upload a base64-encoded GLB to R2 and return its public URL.

    Returns None if R2 is not configured (e.g. local dev without R2 keys); the
    caller can then fall back to a data URI or surface an error.
    """
    if not (settings.R2_BUCKET and settings.R2_ENDPOINT_URL):
        return None

    import boto3  # local import — only needed when R2 is configured

    glb_bytes = base64.b64decode(model_b64)
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )
    s3.put_object(
        Bucket=settings.R2_BUCKET,
        Key=key,
        Body=glb_bytes,
        ContentType="model/gltf-binary",
    )

    if settings.R2_PUBLIC_BASE_URL:
        return f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{key}"
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key},
        ExpiresIn=settings.R2_URL_TTL,
    )


@router.post("/trellis/task")
async def create_trellis_task(request_data: TrellisRequest):
    """Submit an image-to-3D job to the RunPod TRELLIS.2 worker
    (wearebravelabs/trellis2-runpod).

    Maps the frontend's TRELLIS-1 style payload to the TRELLIS.2 handler
    contract. Guidance-strength params are dropped (TRELLIS.2 has no
    classifier-free guidance knob exposed at the public API).
    """
    # Quality is caller-controlled (frontend sends resolution/texture_size).
    # Pydantic caps the values to RunPod-payload-safe range (≤1024/≤2048).
    payload = {
        "input": {
            "image": request_data.input.image,
            "seed": request_data.input.seed,
            "sparse_structure_steps": request_data.input.ss_sampling_steps,
            "slat_sampler_steps": request_data.input.slat_sampling_steps,
            "resolution": request_data.input.resolution,
            "texture_size": request_data.input.texture_size,
            "output_format": "glb",
        }
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{_runpod_endpoint()}/run",
                headers=_runpod_headers(),
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()
            body = response.json()
            return {
                "code": 200,
                "data": {
                    "task_id": body.get("id"),
                    "status": body.get("status", "IN_QUEUE").lower(),
                },
                "raw": body,
            }
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"RunPod error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Error reaching RunPod: {e}")


@router.websocket("/trellis/task/ws/{task_id}")
async def trellis_task_status_websocket(websocket: WebSocket, task_id: str):
    """Poll RunPod for job status and stream updates over the WebSocket."""
    if not (settings.RUNPOD_API_KEY and settings.RUNPOD_TRELLIS_ENDPOINT_ID):
        await websocket.close(code=1008, reason="RunPod TRELLIS endpoint not configured")
        return

    await websocket.accept()
    continue_polling = True

    try:
        while continue_polling:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{_runpod_endpoint()}/status/{task_id}",
                        headers=_runpod_headers(),
                        timeout=10.0,
                    )

                if response.status_code != 200:
                    await websocket.send_json({
                        "status": "error",
                        "message": f"RunPod status error: {response.status_code} {response.text}",
                        "data": None,
                    })
                    await asyncio.sleep(2)
                    continue

                body = response.json()
                runpod_status = (body.get("status") or "").upper()

                if runpod_status == "COMPLETED":
                    output = body.get("output") or {}
                    # wearebravelabs/trellis2 returns base64 GLB in output.model;
                    # legacy workers (or our own) may return a URL directly.
                    model_url = (
                        output.get("model_file")
                        or output.get("model_url")
                        or output.get("glb_url")
                    )
                    if not model_url and output.get("model"):
                        try:
                            model_url = _r2_upload_base64_glb(
                                output["model"], f"trellis/{task_id}.glb"
                            )
                        except Exception as e:
                            await websocket.send_json({
                                "status": "failed",
                                "message": f"R2 upload failed: {e}",
                                "data": None,
                                "full_response": body,
                            })
                            continue_polling = False
                            continue
                    await websocket.send_json({
                        "status": "completed",
                        "message": "Task completed successfully",
                        "data": model_url,
                        "full_response": body,
                    })
                    continue_polling = False
                elif runpod_status in ("FAILED", "CANCELLED", "TIMED_OUT"):
                    err = body.get("error") or body.get("output") or "Task failed"
                    await websocket.send_json({
                        "status": "failed",
                        "message": str(err),
                        "data": None,
                        "full_response": body,
                    })
                    continue_polling = False
                else:
                    await websocket.send_json({
                        "status": "processing",
                        "message": f"RunPod status: {runpod_status.lower() or 'pending'}",
                        "data": None,
                    })

                try:
                    client_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                    if client_message == "close":
                        continue_polling = False
                except asyncio.TimeoutError:
                    pass

                if continue_polling:
                    await asyncio.sleep(2)

            except httpx.RequestError as e:
                await websocket.send_json({
                    "status": "error",
                    "message": f"Error connecting to RunPod: {e}",
                    "data": None,
                })
                await asyncio.sleep(2)

    except WebSocketDisconnect:
        continue_polling = False
    except Exception as e:
        try:
            await websocket.send_json({
                "status": "error",
                "message": f"Unexpected error: {e}",
                "data": None,
            })
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
