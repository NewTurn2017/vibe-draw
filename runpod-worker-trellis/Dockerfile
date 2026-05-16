# RunPod Serverless worker for Microsoft TRELLIS (image-to-3D).
# Targets a single RTX 4090 (24 GB VRAM). CUDA 12.1 + PyTorch 2.4 baseline.
#
# Build:   docker buildx build --platform linux/amd64 -t <your-registry>/trellis-runpod:latest .
# Push:    docker push <your-registry>/trellis-runpod:latest
# Deploy:  attach this image to a RunPod Serverless endpoint with a 4090 worker.

FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TORCH_CUDA_ARCH_LIST="8.9" \
    SPCONV_ALGO=native \
    ATTN_BACKEND=xformers

RUN apt-get update && apt-get install -y --no-install-recommends \
        git wget curl build-essential \
        python3.10 python3.10-dev python3-pip \
        libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
        ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 1 \
    && python -m pip install --upgrade pip setuptools wheel

WORKDIR /workspace

# Clone TRELLIS WITH submodules (mip-splatting et al. live in submodules).
RUN git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git /workspace/TRELLIS

WORKDIR /workspace/TRELLIS

# Core deep-learning stack. Adjust torch wheel index if the CUDA tag changes.
RUN pip install --extra-index-url https://download.pytorch.org/whl/cu121 \
        torch==2.4.0 torchvision==0.19.0

# TRELLIS dependencies. The upstream `setup.sh` is unsafe in docker build
# (it probes torch.cuda.is_available() which is False without a GPU device),
# so reproduce the install steps directly. Skip flash-attn — we run with
# ATTN_BACKEND=xformers (see ENV above).
RUN pip install -r requirements.txt || true \
    && pip install \
        xformers==0.0.27.post2 \
        "git+https://github.com/NVlabs/nvdiffrast.git" \
        "git+https://github.com/JeffreyXiang/diffoctreerast.git" \
        "git+https://github.com/EasternJournalist/utils3d.git" \
        spconv-cu120 \
        easydict imageio imageio-ffmpeg trimesh rembg onnxruntime-gpu \
        scipy einops omegaconf safetensors transformers

# Kaolin (prebuilt NVIDIA wheel matched to torch 2.4.0 + CUDA 12.1).
RUN pip install kaolin==0.16.0 \
        -f https://nvidia-kaolin.s3.us-east-2.amazonaws.com/torch-2.4.0_cu121.html

# Mip-Splatting → its diff-gaussian-rasterization submodule (CUDA ext, compiled
# during pip install — needs nvcc but no GPU device; the base image has nvcc).
RUN git clone --recurse-submodules https://github.com/autonomousvision/mip-splatting.git /workspace/mip-splatting \
    && pip install /workspace/mip-splatting/submodules/diff-gaussian-rasterization

# RunPod serverless SDK + a tiny model store + boto3 for S3 uploads (optional).
RUN pip install runpod boto3 huggingface_hub

# Pre-download TRELLIS weights at build time so cold starts only pay for VRAM load.
# Set HUGGINGFACE_HUB_TOKEN as a build arg if the repo is gated.
ARG HUGGINGFACE_HUB_TOKEN=""
ENV HF_HUB_ENABLE_HF_TRANSFER=1
RUN python -c "import os; \
from huggingface_hub import snapshot_download; \
snapshot_download(repo_id='microsoft/TRELLIS-image-large', \
                  token=os.environ.get('HUGGINGFACE_HUB_TOKEN') or None)" || true

WORKDIR /workspace
COPY handler.py /workspace/handler.py

ENV PYTHONPATH="/workspace/TRELLIS:${PYTHONPATH}"

CMD ["python", "-u", "/workspace/handler.py"]
