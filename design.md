# Design System Strategy: The Cinematic Athlete

## 1. Overview & Creative North Star

The Creative North Star for this design system is **"The Digital Pulse."** It is an aesthetic that marries the raw, visceral energy of elite performance with the sophisticated precision of high-end data analytics.

Unlike standard "SaaS-looking" dashboards that rely on rigid grids and excessive borders, this system treats the UI as an editorial experience. We break the template by using **intentional asymmetry**, where data visualizations might bleed off the edge of a container, and **cinematic layering**, where information sits on translucent "sheets" that feel like a high-tech HUD (Heads-Up Display) overlaying a dark track. It is confident, focused, and premium - designed for the athlete who views their data as a competitive edge.

## 2. Colors

Our palette is rooted in the "Deep Dark" philosophy. We don't use flat blacks; we use nuanced, charcoal-inspired tones to create a sense of infinite space.

- **Primary Accent (`#ffb4a7` / `#f07561`):** A warm, energetic coral that evokes a sense of rising heat and "red-lining" during a sprint. Use this sparingly to highlight critical performance metrics and primary calls to action.
- **The "No-Line" Rule:** To maintain a premium feel, **1px solid borders are strictly prohibited** for sectioning. Structural boundaries must be defined through background color shifts. For instance, a `surface-container-low` section should sit directly on a `surface` background to define its edge.
- **Surface Hierarchy & Nesting:** Use the `surface-container` tiers (`Lowest` to `Highest`) to create depth. A typical layout might involve:
  - `surface-dim` (Background)
  - `surface-container-low` (Main content area)
  - `surface-container-high` (Interactive cards or data widgets)
- **The "Glass & Gradient" Rule:** Floating elements, such as navigation bars or quick-action menus, must use **Glassmorphism**. Apply `surface-container` colors with a 60-80% opacity and a `20px` backdrop blur.
- **Signature Textures:** For hero sections or significant performance "milestone" cards, use a subtle linear gradient transitioning from `primary` to `primary-container` at a 45-degree angle to add "soul" and movement.

## 3. Typography

The typography is designed to mimic the high-contrast headlines of a luxury sports magazine.

- **Display & Headlines (Manrope):** This is our "mechanical" voice. Manrope's geometric structure feels engineered and precise. Use `display-lg` for single-word performance metrics (e.g., your Pace or Heart Rate) to give them an authoritative presence.
- **Body & Labels (Inter):** Inter provides maximum legibility at high speeds. It is the "functional" voice that handles the heavy lifting of data descriptions and analytical insights.
- **Editorial Hierarchy:** Use a "Size-as-Weight" strategy. Rather than just bolding text, use significant jumps in the typography scale (e.g., a `display-md` headline followed by a `body-sm` description) to create a sophisticated, editorial rhythm.

## 4. Elevation & Depth

In this design system, depth is a function of light and translucency, not just shadow.

- **The Layering Principle:** Stacking `surface-container` tiers is the primary way to show hierarchy. Placing a `surface-container-lowest` card on a `surface-container-low` background creates a "recessed" look, perfect for secondary data.
- **Ambient Shadows:** For "floating" elements (like a training plan modal), use extra-diffused shadows.
  - *Spec:* `0px 24px 48px rgba(0, 0, 0, 0.4)`.
  - Shadows should never be pure black; they should feel like a deep, tinted occlusion of the background color.
- **The "Ghost Border" Fallback:** If a divider is required for extreme clarity (e.g., in a complex data table), use a "Ghost Border": `outline-variant` at 15% opacity. It should be felt, not seen.
- **Glassmorphism & Depth:** By using `backdrop-blur` (min 16px) on surface-tinted containers, we allow the "pulse" of the background (like a blurred image of a runner) to bleed through. This makes the app feel like a single, cohesive environment rather than a collection of separate boxes.

## 5. Components

Our components are "app-like" - they feature generous touch targets and tactile feedback.

- **Buttons:**
  - *Primary:* `primary-container` background, `on-primary-container` text. Roundedness: `full`.
  - *Secondary:* `surface-container-highest` background, ghost-border outline.
  - *Tertiary:* Text-only using `primary` color, used for "Learn More" or "Cancel."
- **Data Chips:** Use `secondary-container` with `md` (0.75rem) roundedness. These should feel like physical tabs.
- **Input Fields:** Use `surface-container-highest` for the field background. No borders. Use a 2px `primary` bottom-border only when the field is focused to simulate a "gauge" filling up.
- **Cards & Lists:** **Strictly no divider lines.** Use vertical whitespace (e.g., 24px/32px) to separate list items. For cards, use `surface-container-low` with a soft `lg` corner radius.
- **Performance Gauges (Custom Component):** Circular or semi-circular progress indicators using the `primary` to `tertiary` gradient to represent intensity zones.

## 6. Do's and Don'ts

**Do:**

- **Do** use asymmetrical layouts where text is left-aligned and visuals bleed to the right edge.
- **Do** use "Overlapping Elements." Let a floating data chip partially overlap the edge of a chart to create 3D depth.
- **Do** prioritize high-contrast typography for key numbers (Time, Distance, Pace).

**Don't:**

- **Don't** use 1px solid white or grey borders. This immediately breaks the "premium" feel.
- **Don't** use standard "drop shadows." If it doesn't look like ambient light, it's too heavy.
- **Don't** clutter the screen. If a piece of data isn't vital to the "current run," hide it in a sub-layer. Premium design is about what you leave out.
- **Don't** use pure `#000000`. Use the `surface` and `surface-container` tokens to ensure the dark mode has "breathable" air.
