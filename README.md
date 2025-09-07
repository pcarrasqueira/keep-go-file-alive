# Keep GoFile Alive 

[![Keep Gofile Alive](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml/badge.svg?branch=main)](https://github.com/pcarrasqueira/keep-go-file-alive/actions/workflows/keep-file-alive.yml)


This repository contains a GitHub Action that periodically pings GoFile download links to keep them alive and prevent expiration.

## Usage

1. Fork this repository or copy the workflow to your own repo.
2. Set a repository secret named `GOFILE_URLS` with the URLs to ping, separated by newlines (e.g., one URL per line).
3. The action will run automatically every 5 days at 7:00 AM UTC, or manually via workflow dispatch.

The action uses Playwright to navigate to the URLs, detect download links, and ping them with a HEAD request.
