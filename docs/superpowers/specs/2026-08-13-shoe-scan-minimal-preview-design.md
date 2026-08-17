# Shoe Scan Minimal Preview Design

## Scope

Simplify only the visual preview rail inside the `/shoes` image-import modal. Preserve the modal layout, image selection, scan request, quota states, recognition results, duplicate handling, localization, themes, and responsive behavior.

## Design

Use a flat warm paper surface with a 1px Profile border and a restrained 16px radius. Keep the existing scan label above the preview as plain editorial metadata. Inside the empty preview, show one compact image-search icon, the existing scan title at normal card-heading scale, and the existing supporting copy at readable body scale.

Remove the corner brackets, animated scan line, and duplicate scan-limit status chip. Keep the working preview file input as a small rectangular action at the lower-right edge. When a preview image exists, retain it and keep the same action available above the image.

## States And Verification

The processing, quota, failure, and result states continue in the functional panel. A source smoke test must guard the removal of decorative markup and the minimal CSS contract. Production build, lint, modal smoke tests, and frontend runtime sync remain the proof gates.
