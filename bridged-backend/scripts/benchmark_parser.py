import os
import time
import requests
import json
from concurrent.futures import ThreadPoolExecutor

# Configuration
BASE_URL = "http://127.0.0.1:8000/api"
RESUME_DIR = r"c:\Users\New User\Documents\Resume Parsing Implementations\Resume Parsing Implementations\bridged-backend\test_data\resumes"
EMAIL = "s.komaiya@alustudent.com"
PASSWORD = "passme1$"


def login():
    print(f"Logging in as {EMAIL}...")
    url = f"{BASE_URL}/auth/login"
    payload = {"email": EMAIL, "password": PASSWORD}
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json()["tokens"]["access"]
    else:
        print(f"Login failed: {response.text}")
        return None


def upload_resume(token, file_path):
    print(f"Uploading {os.path.basename(file_path)}...")
    url = f"{BASE_URL}/resumes/upload"
    headers = {"Authorization": f"Bearer {token}"}
    start_time = time.time()

    with open(file_path, "rb") as f:
        files = {"file": f}
        response = requests.post(url, headers=headers, files=files)

    if response.status_code == 201:
        resume_id = response.json()["resume_id"]
        return resume_id, start_time
    else:
        print(f"Upload failed for {file_path}: {response.text}")
        return None, None


def poll_status(token, resume_id, start_time):
    url = f"{BASE_URL}/resumes/{resume_id}"
    headers = {"Authorization": f"Bearer {token}"}

    while True:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            if status == "completed":
                end_time = time.time()
                duration = end_time - start_time
                print(f"Resume {resume_id} processed in {duration:.2f}s")
                return duration
            elif status == "failed":
                print(f"Resume {resume_id} failed: {data.get('parsing_error')}")
                return None
        else:
            print(f"Polling failed for {resume_id}: {response.text}")
            return None
        time.sleep(1)


def benchmark():
    token = login()
    if not token:
        return

    resumes = [
        os.path.join(RESUME_DIR, f)
        for f in os.listdir(RESUME_DIR)
        if f.endswith((".pdf", ".docx", ".txt"))
    ]
    if not resumes:
        print("No resumes found in directory.")
        return

    print(f"Found {len(resumes)} resumes. Starting benchmark...")

    results = []

    for resume_path in resumes[:5]:  # Testing with 5 resumes first
        resume_id, start_time = upload_resume(token, resume_path)
        if resume_id:
            duration = poll_status(token, resume_id, start_time)
            if duration:
                results.append(duration)

    if results:
        avg = sum(results) / len(results)
        print("\n" + "=" * 30)
        print("BENCHMARK RESULTS SUMMARY")
        print("=" * 30)
        print(f"Total resumes processed: {len(results)}")
        print(f"Average total time:     {avg:.2f}s")
        print(f"Minimum time:           {min(results):.2f}s")
        print(f"Maximum time:           {max(results):.2f}s")
        print("=" * 30)
        print("\nNote: Check the backend server logs for internal [PERF] metrics.")
    else:
        print("No successful processing to report.")


if __name__ == "__main__":
    benchmark()
