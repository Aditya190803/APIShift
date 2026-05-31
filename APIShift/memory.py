import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional


class JsonMemoryStore:
    """Small dependency-free persistent memory backend.

    The store uses JSON Lines so writes are append-only and resilient enough for
    local CLI/server use. It persists canonical conversation messages and summary
    snapshots; vector indexes remain optional/runtime-only.
    """

    def __init__(self, path: str):
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)

    def append_message(self, message: Dict[str, str]) -> None:
        self._append({"type": "message", "message": message})

    def append_summary(self, summary: str) -> None:
        self._append({"type": "summary", "summary": summary})

    def load_messages(self) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []
        for record in self._iter_records():
            if record.get("type") == "message" and isinstance(record.get("message"), dict):
                message = record["message"]
                if "role" in message and "content" in message:
                    messages.append({"role": str(message["role"]), "content": str(message["content"])})
        return messages

    def load_summary(self) -> str:
        summary = ""
        for record in self._iter_records():
            if record.get("type") == "summary":
                summary = str(record.get("summary", ""))
        return summary

    def clear(self) -> None:
        self.path.write_text("", encoding="utf-8")

    def _append(self, record: Dict[str, object]) -> None:
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    def _iter_records(self) -> Iterable[Dict[str, object]]:
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(record, dict):
                    yield record
