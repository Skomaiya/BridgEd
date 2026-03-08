"""
Device detection for CUDA/GPU vs CPU.
Used for logging and for any future in-process ML (e.g. local LLM).
No hard dependency on PyTorch: tries torch first, then nvidia-smi.
"""

import logging
import subprocess
import sys
from typing import Tuple

logger = logging.getLogger(__name__)

_DEVICE_CACHE = None


def _detect_via_torch() -> Tuple[str, dict]:
    """Use PyTorch if available. Returns (device, info)."""
    try:
        import torch
        if torch.cuda.is_available():
            name = torch.cuda.get_device_name(0) if torch.cuda.device_count() else "NVIDIA GPU"
            count = torch.cuda.device_count()
            return "cuda", {"backend": "torch", "name": name, "device_count": count}
        return "cpu", {"backend": "torch", "reason": "CUDA not available"}
    except ImportError:
        return "cpu", {"backend": None, "reason": "PyTorch not installed"}


def _detect_via_nvidia_smi() -> bool:
    """Return True if nvidia-smi runs and reports a GPU."""
    try:
        out = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            timeout=5,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0,
        )
        return out.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def get_device() -> str:
    """
    Return "cuda" if a GPU is available, else "cpu".
    Uses PyTorch if installed, otherwise nvidia-smi to detect NVIDIA GPU.
    """
    device, _ = get_device_and_info()
    return device


def get_device_and_info() -> Tuple[str, dict]:
    """
    Return (device, info) where device is "cuda" or "cpu"
    and info is a dict with backend, name, etc. for logging.
    """
    global _DEVICE_CACHE
    if _DEVICE_CACHE is not None:
        return _DEVICE_CACHE

    device, info = _detect_via_torch()
    if device == "cpu" and info.get("backend") is None:
        if _detect_via_nvidia_smi():
            device = "cuda"
            info = {"backend": "nvidia-smi", "name": "NVIDIA GPU"}
        else:
            info["reason"] = "No PyTorch and nvidia-smi not found or no GPU"
    _DEVICE_CACHE = (device, info)
    return _DEVICE_CACHE


def is_cuda_available() -> bool:
    """Return True if CUDA/GPU is available."""
    return get_device() == "cuda"


def log_device_info() -> None:
    """Log detected device for startup visibility."""
    device, info = get_device_and_info()
    if device == "cuda":
        name = info.get("name", "GPU")
        logger.info("Device: cuda (%s) — GPU will be used when available (e.g. Ollama uses it automatically).", name)
    else:
        reason = info.get("reason", "no GPU detected")
        logger.info("Device: cpu (%s). Install PyTorch with CUDA or ensure nvidia-smi sees a GPU to use GPU.", reason)
