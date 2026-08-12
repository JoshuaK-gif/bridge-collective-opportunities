import json, urllib.request, ssl

ctx = ssl._create_unverified_context()
data = json.dumps({"title": "Software Engineer", "existingSkills": ["JavaScript", "React"]}).encode()

for url in [
    "http://localhost:3000/api/ai/suggest-skills",
    "https://bridgecollectiveopport.org/api/ai/suggest-skills"
]:
    try:
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, context=ctx if url.startswith("https") else None)
        print(f"{url}: {resp.status}")
        print(resp.read().decode()[:200])
    except Exception as e:
        print(f"{url}: ERROR {e}")
