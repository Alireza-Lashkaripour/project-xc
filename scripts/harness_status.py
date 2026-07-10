#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
queue=json.load(open(ROOT/"harness/queues/bootstrap-tasks.json", encoding="utf-8"))
valid={"queued","in_progress","blocked","done","cancelled"}
errors=[]
for t in queue.get("tasks",[]):
    for k in ["id","lane","status","title","inputs","outputs","gates"]:
        if k not in t: errors.append(f"{t.get('id','<missing>')} missing {k}")
    if t.get("status") not in valid: errors.append(f"{t.get('id')} bad status {t.get('status')}")
    if not t.get("gates"): errors.append(f"{t.get('id')} has no gates")
if errors:
    print("Project XC harness status FAILED")
    print("\n".join(f"- {e}" for e in errors))
    sys.exit(1)
counts={}
for t in queue.get("tasks",[]): counts[t["status"]]=counts.get(t["status"],0)+1
print("Project XC harness status OK")
print(f"- tasks: {len(queue.get('tasks',[]))}")
for k in sorted(counts): print(f"- {k}: {counts[k]}")
