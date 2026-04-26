---
name: dream-forge-create-3d-model
description: Guide a user through creating a textured 3D model from photos in Dream Forge.
---

# Dream Forge Create 3D Model

Use this skill when helping a user create a 3D model from one or more photos with Dream Forge.

## Flow

1. Send the user to the localized create flow:
   - Traditional Chinese: `https://dreamforge.app/zh-TW/generate/`
   - English: `https://dreamforge.app/en/generate/`
2. If the user is not signed in, direct them to the localized auth page and resume after sign-in.
3. Ask the user whether they have one image, multiple views, or want AI-generated supporting views.
4. Help them choose a style: none, bobblehead, chibi, cartoon, or emoji.
5. Help them choose quality/provider options based on account tier.
6. After generation, direct them to preview the model, download files, or continue to print ordering.

## Notes

- User dashboards and generated assets are private to authenticated users.
- Protected actions require Firebase Authentication in the web app.
- For API metadata, start at `https://dreamforge.app/.well-known/api-catalog`.
