# GAITSENSE Frontend

React and Vite frontend for the GAITSENSE radar gait-recognition interface.

## Online site

After the GitHub Pages workflow completes, the public site is available at:

https://obsessionyou.github.io/GAITSENSE/

First-time repository setup:

1. Open `Settings` > `Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Save, then rerun the `Deploy GitHub Pages` workflow or push a new commit.

## Local development

```powershell
npm ci
npm run dev
```

## Deployment boundary

This repository contains frontend code only. GitHub Pages publishes the interface, but real-time recognition, personnel management, and server-backed statistics require a separately deployed backend. The frontend uses `VITE_RADAR_API_BASE` when it is provided; otherwise it connects to `http://127.0.0.1:18788` for local development.
