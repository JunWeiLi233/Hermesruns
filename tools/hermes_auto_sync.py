import json
import hashlib
import shutil
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = Path(__file__).with_name("hermes_sync_config.json")
DEFAULT_STATE_PATH = Path(__file__).with_name("hermes_sync_state.json")
DEFAULT_LOG_PATH = Path(__file__).with_name("hermes_sync.log")
SUPPORTED_EXTENSIONS = {".gpx", ".tcx", ".fit", ".zip"}


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default


def save_json(path, payload):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2)


def append_log(log_path, message):
    timestamp = datetime.now().isoformat(timespec="seconds")
    line = f"{timestamp} {message}"
    print(line)
    Path(log_path).parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def trim_log(log_path, max_lines):
    if max_lines <= 0 or not Path(log_path).exists():
        return
    with open(log_path, "r", encoding="utf-8") as handle:
        lines = handle.readlines()
    if len(lines) <= max_lines:
        return
    with open(log_path, "w", encoding="utf-8") as handle:
        handle.writelines(lines[-max_lines:])


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def request_json(url, method="GET", headers=None, body=None, timeout=20):
    request = urllib.request.Request(url, method=method, headers=headers or {}, data=body)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
        if not payload:
            return {}
        return json.loads(payload.decode("utf-8"))


def auth_is_configured(auth):
    """Return True if the watcher has real credentials (not placeholders)."""
    if not auth or not isinstance(auth, dict):
        return False
    token = (auth.get("token") or "").strip()
    if token:
        return True
    email = (auth.get("email") or "").strip()
    password = (auth.get("password") or "").strip()
    if not email or not password:
        return False
    if password.lower() in ("replace-with-your-password", "changeme"):
        return False
    return True


def authenticate(base_url, auth_config):
    token = auth_config.get("token")
    if token:
        return token

    email = auth_config.get("email")
    password = auth_config.get("password")
    if not email or not password:
        raise RuntimeError("Watcher config needs either auth.token or auth.email/auth.password.")

    payload = json.dumps({"email": email, "password": password}).encode("utf-8")
    response = request_json(
        f"{base_url}/api/auth/login",
        method="POST",
        headers={"Content-Type": "application/json"},
        body=payload,
    )
    token = response.get("token")
    if not token:
        raise RuntimeError("Login succeeded without a session token.")
    return token


def multipart_body(fields, file_path):
    boundary = f"----HermesBoundary{int(time.time() * 1000)}"
    chunks = []

    for key, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )

    mime_type = "application/zip" if file_path.suffix.lower() == ".zip" else "application/octet-stream"
    with open(file_path, "rb") as handle:
        file_bytes = handle.read()

    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'.encode("utf-8"),
            f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    return boundary, b"".join(chunks)


def upload_file(base_url, token, provider, file_path):
    boundary, body = multipart_body({"provider": provider}, file_path)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    request = urllib.request.Request(
        f"{base_url}/api/import/files",
        method="POST",
        headers=headers,
        data=body,
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def move_to_archive(file_path, archive_root, provider):
    timestamp = datetime.now().strftime("%Y%m%d")
    target_dir = archive_root / provider.lower() / timestamp
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / file_path.name

    counter = 1
    while target_path.exists():
        target_path = target_dir / f"{file_path.stem}_{counter}{file_path.suffix}"
        counter += 1

    shutil.move(str(file_path), str(target_path))
    return target_path


def scan_files(directory):
    if not directory.exists():
        directory.mkdir(parents=True, exist_ok=True)
        return []
    return sorted(
        [path for path in directory.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS],
        key=lambda path: path.stat().st_mtime,
    )


def record_state_entry(state, checksum, provider, file_name, archived_path, result, status):
    state.setdefault("processed", {})[checksum] = {
        "provider": provider,
        "original_name": file_name,
        "archived_path": str(archived_path),
        "processed_at": datetime.now().isoformat(timespec="seconds"),
        "result": result,
        "status": status,
    }


def record_failure(state, checksum, provider, file_name, error_message):
    failures = state.setdefault("failures", {})
    entry = failures.get(checksum, {
        "provider": provider,
        "original_name": file_name,
        "first_failed_at": datetime.now().isoformat(timespec="seconds"),
        "attempts": 0,
    })
    entry["attempts"] = int(entry.get("attempts", 0)) + 1
    entry["last_failed_at"] = datetime.now().isoformat(timespec="seconds")
    entry["last_error"] = error_message
    failures[checksum] = entry


def clear_failure(state, checksum):
    if "failures" in state:
        state["failures"].pop(checksum, None)


def upload_with_retry(base_url, token, provider, file_path, retries, retry_delay_seconds, log_path):
    attempt = 0
    while True:
        attempt += 1
        try:
            return upload_file(base_url, token, provider, file_path)
        except urllib.error.HTTPError as error:
            error_body = error.read().decode("utf-8", errors="ignore")
            message = f"HTTP {error.code} {error_body}".strip()
            if error.code < 500 or attempt > retries:
                raise RuntimeError(message) from error
            append_log(log_path, f"[Hermes Sync] Retry {attempt}/{retries} for {file_path.name} after server error: {message}")
        except Exception as error:
            if attempt > retries:
                raise RuntimeError(str(error)) from error
            append_log(log_path, f"[Hermes Sync] Retry {attempt}/{retries} for {file_path.name} after error: {error}")
        time.sleep(retry_delay_seconds)


def process_provider(base_url, token, provider, source_dir, archive_root, state, retries, retry_delay_seconds, log_path):
    files = scan_files(source_dir)
    if not files:
        return

    for file_path in files:
        checksum = file_sha256(file_path)
        if checksum in state.get("processed", {}):
            try:
                archived_path = move_to_archive(file_path, archive_root, provider)
                append_log(log_path, f"[Hermes Sync] Archived already-known file {file_path.name} -> {archived_path}")
            except OSError as error:
                append_log(log_path, f"[Hermes Sync] Could not archive already-known file {file_path.name}: {error}")
            continue

        append_log(log_path, f"[Hermes Sync] Importing {provider} file: {file_path.name}")
        try:
            result = upload_with_retry(base_url, token, provider, file_path, retries, retry_delay_seconds, log_path)
            archived_path = move_to_archive(file_path, archive_root, provider)
            record_state_entry(state, checksum, provider, file_path.name, archived_path, result, "IMPORTED")
            clear_failure(state, checksum)
            save_json(DEFAULT_STATE_PATH, state)
            append_log(log_path, f"[Hermes Sync] Imported {file_path.name}: {result.get('message', 'OK')}")
        except Exception as error:
            record_failure(state, checksum, provider, file_path.name, str(error))
            save_json(DEFAULT_STATE_PATH, state)
            append_log(log_path, f"[Hermes Sync] Upload failed for {file_path.name}: {error}")


def main():
    config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONFIG_PATH
    config = load_json(config_path, None)
    if not config:
        print(f"[Hermes Sync] Missing config: {config_path}")
        return 1

    auth_cfg = config.get("auth", {})
    if not auth_is_configured(auth_cfg):
        print("[Hermes Sync] Auth is not configured yet.")
        print("  Edit this file and set auth.email + auth.password (Hermes login), or auth.token.")
        print(f"  File: {config_path.resolve()}")
        print("  See README: Garmin / COROS Auto-Import.")
        return 1

    base_url = config.get("base_url", "http://localhost:8080").rstrip("/")
    poll_seconds = max(5, int(config.get("poll_seconds", 30)))
    retries = max(0, int(config.get("retry_count", 2)))
    retry_delay_seconds = max(1, int(config.get("retry_delay_seconds", 8)))
    log_path = Path(config.get("log_path", DEFAULT_LOG_PATH))
    max_log_lines = max(200, int(config.get("max_log_lines", 4000)))
    archive_root = Path(config.get("archive_dir", ROOT / "imports" / "processed"))
    provider_dirs = {
        "GARMIN": Path(config.get("garmin_dir", ROOT / "imports" / "garmin")),
        "COROS": Path(config.get("coros_dir", ROOT / "imports" / "coros")),
        "HUAWEI": Path(config.get("huawei_dir", ROOT / "imports" / "huawei")),
    }

    state = load_json(DEFAULT_STATE_PATH, {"processed": {}, "failures": {}})

    append_log(log_path, "[Hermes Sync] Starting local auto-import watcher")
    append_log(log_path, f"[Hermes Sync] Garmin dir: {provider_dirs['GARMIN']}")
    append_log(log_path, f"[Hermes Sync] COROS dir: {provider_dirs['COROS']}")
    append_log(log_path, f"[Hermes Sync] Huawei dir: {provider_dirs['HUAWEI']}")
    append_log(log_path, f"[Hermes Sync] Poll interval: {poll_seconds}s")
    append_log(log_path, f"[Hermes Sync] Retry policy: {retries} retries with {retry_delay_seconds}s delay")

    while True:
        try:
            token = authenticate(base_url, config.get("auth", {}))
            for provider, source_dir in provider_dirs.items():
                process_provider(
                    base_url,
                    token,
                    provider,
                    source_dir,
                    archive_root,
                    state,
                    retries,
                    retry_delay_seconds,
                    log_path,
                )
        except Exception as error:
            append_log(log_path, f"[Hermes Sync] Watcher cycle failed: {error}")

        trim_log(log_path, max_log_lines)
        time.sleep(poll_seconds)


if __name__ == "__main__":
    raise SystemExit(main())
