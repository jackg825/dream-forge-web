---
name: dream-forge-create-3d-model
description: Guide a user through creating and downloading a 3D model from one reference photo in Dream Forge.
---

# Dream Forge Create 3D Model

Use this skill when helping a user create a 3D model from one clear reference photo with Dream Forge.

## Flow

1. Send the user to the localized create flow:
   - Traditional Chinese: `https://dreamforge.app/zh-TW/generate/`
   - English: `https://dreamforge.app/en/generate/`
2. If the user is not signed in, direct them to the localized auth page and resume after sign-in.
3. Ask the user to upload one clear, well-lit photo of a single object. The app analyzes it and generates front, back, left, and right supporting views.
4. Help them choose a style: none, bobblehead, chibi, cartoon, or emoji.
5. Help them choose the available image model and 3D provider based on account tier and credit balance.
6. After generation, direct them to inspect the browser preview and download the available GLB file.

## Notes

- User dashboards and generated assets are private to authenticated users.
- Protected actions require Firebase Authentication in the web app.
- New accounts receive 3 starter credits. Self-service credit purchases and account upgrades are not available yet.
- Physical print ordering is planned but not yet available.
- For API metadata, start at `https://dreamforge.app/.well-known/api-catalog`.
