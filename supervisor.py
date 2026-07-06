import subprocess
import sys
import os
import signal

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

backend_process = None
frontend_process = None

def cleanup(signum, frame):
    print("\n🛑 Shutting down servers...")
    if backend_process:
        backend_process.terminate()
    if frontend_process:
        frontend_process.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print("🚀 Starting SecureVault servers...")

backend_process = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
    cwd=BACKEND_DIR,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    universal_newlines=True
)

frontend_process = subprocess.Popen(
    ["npm.cmd", "run", "dev"],
    cwd=FRONTEND_DIR,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    universal_newlines=True
)

def stream_output(process, prefix):
    while True:
        line = process.stdout.readline()
        if not line:
            break
        print(f"[{prefix}] {line.rstrip()}")

import threading
threading.Thread(target=stream_output, args=(backend_process, "BACKEND"), daemon=True).start()
threading.Thread(target=stream_output, args=(frontend_process, "FRONTEND"), daemon=True).start()

backend_process.wait()
frontend_process.wait()
