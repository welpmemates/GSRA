import requests
import json
import os

os.makedirs("data/raw", exist_ok=True)

API_KEY = "f9cb80f086028c7465523db86d2a3b51c73e4f6e1d3986a59d4e7954e11e5feb"  # get from https://explore.openaq.org

url = "https://api.openaq.org/v3/locations"

params = {
    "country": "IN",
    "bbox": "68.2,20.1,74.5,24.7",
    "limit": 200
}

headers = {
    "X-API-Key": API_KEY
}

resp = requests.get(url, params=params, headers=headers)

data = resp.json()["results"]

with open("../../data/raw/gujarat_aq_stations.json", "w") as f:
    json.dump(data, f, indent=2)

print(f"Saved {len(data)} AQ stations")
