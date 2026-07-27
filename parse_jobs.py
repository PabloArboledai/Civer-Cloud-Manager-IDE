import json
with open('jobs.json') as f:
    d = json.load(f)
for j in d.get("jobs", []):
    if j.get("conclusion") == "failure":
        print(f"Job: {j.get('name')}")
        for s in j.get("steps", []):
            if s.get("conclusion") == "failure":
                print(f"  Step: {s.get('name')}")
