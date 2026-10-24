# Install and run Yggdrasil-ft locally

Yggdrasil-ft is offline-first. All data stays in your browser (localStorage). You can download and run it on your own machine without sharing family data online.

## Requirements
- Node.js 18+ (recommended 20+)
- npm (or pnpm/yarn)

## Download
Option 1: Download ZIP from GitHub (if published) or copy the project folder.
Option 2: Clone with git
```bash
git clone https://github.com/rur1k1d/yggdrasil-ft.git
cd yggdrasil-ft
```

## Install dependencies
```bash
npm install
```

## Run in development (local)
```bash
npm run dev
```
Open the URL shown (usually http://localhost:5173)

## Build and run as static site (offline-capable)
```bash
npm run build
npm run preview
```
Open the URL shown. The app includes a service worker for offline use.

## Windows notes
- Use PowerShell or Terminal
- If you see execution policy errors, use `npm install --force` or adjust policy as needed
- Node.js from nodejs.org is fine

## Linux notes
- Use your package manager for Node.js or nvm
- All commands above work in bash/zsh

## Privacy
- No external network requests required for core functionality
- Data is stored in localStorage only
- Intro animation can be skipped with Enter/Space
