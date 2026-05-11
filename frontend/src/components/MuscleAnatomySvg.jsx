/**
 * MuscleAnatomySvg — Inline SVG anatomy with per-muscle paths.
 *
 * SVG path data vendored and adapted from:
 *   https://github.com/giavinh79/react-body-highlighter
 *   MIT License — Copyright (c) 2021 Gia Vinh
 *
 * Paths have been rescaled and translated to fit within Hermes's
 * REFERENCE_BODY_MEASURE_VIEWBOX (790 × 580):
 *   • Front figure: centre ~x190, panel x58–322, y42–550
 *   • Back  figure: centre ~x570, panel x392–775, y42–550
 *
 * Each muscle key matches exactly one entry in REFERENCE_BODY_MEASURE_REGIONS
 * (or uses the -left / -right suffix convention for paired muscles).
 * The parent computes regionStates from planRegions / hoveredRegionKey /
 * selectedRegionKey and applies 'idle' | 'plan-active' | 'active' | 'focused'.
 *
 * Visual polish: gradient fills (idle beige-to-clay, active coral), subtle
 * shine overlay per muscle for dimensional depth, reduced-motion safe.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Front view muscle paths  (front figure centred at x≈190)
   ───────────────────────────────────────────────────────────────────────── */
export const ANATOMY_FRONT_MUSCLES = [
  /* Neck */
  {
    key: 'neck',
    d: 'M183 100 C185 94 188 91 190 91 C192 91 195 94 197 100 L199 116 C196 121 190 123 190 123 C190 123 184 121 181 116 Z',
  },

  /* Traps (front — trapezius visible on front shoulders) */
  {
    key: 'traps-front-left',
    d: 'M148 126 C156 119 166 118 172 126 C168 136 161 141 155 139 C150 136 146 131 148 126 Z',
  },
  {
    key: 'traps-front-right',
    d: 'M208 126 C214 119 224 119 232 126 C234 131 230 136 225 139 C219 141 212 136 208 126 Z',
  },

  /* Deltoids (anterior) */
  {
    key: 'deltoids-left',
    d: 'M126 140 C122 148 120 162 122 177 C127 183 135 183 139 177 C142 163 141 148 137 141 Z',
  },
  {
    key: 'deltoids-right',
    d: 'M244 140 C248 148 250 162 248 177 C244 183 236 183 232 177 C229 163 230 148 234 141 Z',
  },

  /* Pectorals */
  {
    key: 'pectorals-left',
    d: 'M152 143 C160 140 170 140 178 145 C182 154 181 168 176 177 C168 181 158 180 152 173 C147 164 147 151 152 143 Z',
  },
  {
    key: 'pectorals-right',
    d: 'M202 143 C210 140 220 140 228 143 C233 151 233 164 228 173 C222 180 212 181 204 177 C199 168 198 154 202 143 Z',
  },

  /* Biceps */
  {
    key: 'biceps-left',
    d: 'M122 182 C118 192 117 210 120 228 C126 236 134 236 138 228 C141 210 140 192 136 182 Z',
  },
  {
    key: 'biceps-right',
    d: 'M244 182 C248 192 253 210 250 228 C246 236 238 236 234 228 C231 210 230 192 234 182 Z',
  },

  /* Forearms (front) */
  {
    key: 'forearms-front-left',
    d: 'M119 234 C115 246 114 268 117 285 C122 291 130 291 134 285 C137 268 136 246 132 234 Z',
  },
  {
    key: 'forearms-front-right',
    d: 'M248 234 C252 246 256 268 253 285 C249 291 241 291 237 285 C234 268 234 246 238 234 Z',
  },

  /* Abdominals */
  {
    key: 'abdominals',
    d: 'M170 180 C174 178 180 177 186 178 L186 296 C183 298 180 298 178 297 C174 276 169 252 168 226 C167 206 167 192 170 180 Z M194 178 C200 177 206 178 210 180 C213 192 213 206 212 226 C211 252 206 276 202 297 C200 298 197 298 194 296 Z',
  },

  /* Obliques (part of abdominals region — treated as part of abs) */
  {
    key: 'obliques-left',
    d: 'M156 192 C162 194 166 202 165 218 C164 228 159 234 154 231 C150 228 149 218 150 208 C151 200 153 194 156 192 Z',
  },
  {
    key: 'obliques-right',
    d: 'M224 192 C228 194 230 200 231 208 C232 218 231 228 227 231 C222 234 217 228 216 218 C215 202 219 194 224 192 Z',
  },

  /* Quadriceps */
  {
    key: 'quadriceps-left',
    d: 'M156 305 C160 308 163 316 163 330 C163 358 159 390 153 415 C148 418 141 416 139 411 C137 386 138 354 142 326 C144 314 150 305 156 305 Z',
  },
  {
    key: 'quadriceps-right',
    d: 'M217 305 C223 305 229 314 231 326 C235 354 236 386 234 411 C232 416 225 418 220 415 C214 390 210 358 210 330 C210 316 213 308 217 305 Z',
  },

  /* Adductors / inner thigh */
  {
    key: 'adductors-left',
    d: 'M170 308 C175 314 177 330 176 352 C175 370 172 390 168 408 C164 410 160 408 158 404 C162 384 165 360 165 340 C165 324 166 312 170 308 Z',
  },
  {
    key: 'adductors-right',
    d: 'M210 308 C214 312 215 324 215 340 C215 360 218 384 222 404 C220 408 216 410 212 408 C208 390 205 370 204 352 C203 330 205 314 210 308 Z',
  },

  /* Shins / tibialis anterior */
  {
    key: 'calves-front-left',
    d: 'M152 422 C157 428 159 446 157 468 C156 484 153 498 149 506 C145 504 142 498 142 490 C141 470 143 448 147 432 Z',
  },
  {
    key: 'calves-front-right',
    d: 'M220 422 C224 432 229 454 229 474 C229 486 226 498 222 504 C218 502 215 492 214 476 C212 454 214 432 218 424 Z',
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Back view muscle paths  (back figure centred at x≈570)
   ───────────────────────────────────────────────────────────────────────── */
export const ANATOMY_BACK_MUSCLES = [
  /* Trapezius (upper back / neck base) */
  {
    key: 'trapezius-left',
    d: 'M512 120 C520 113 532 112 540 120 C538 132 530 140 522 138 C515 135 510 128 512 120 Z',
  },
  {
    key: 'trapezius-right',
    d: 'M596 120 C602 113 614 113 622 120 C624 128 619 135 612 138 C604 140 596 132 596 120 Z',
  },

  /* Shoulders — posterior deltoids */
  {
    key: 'shoulders-back-left',
    d: 'M502 140 C498 150 496 166 498 180 C504 186 512 186 517 178 C520 164 518 150 514 141 Z',
  },
  {
    key: 'shoulders-back-right',
    d: 'M618 140 C624 150 626 164 629 178 C634 186 642 186 648 180 C650 166 648 150 644 141 Z',
  },

  /* Lats (latissimus dorsi) */
  {
    key: 'lats-left',
    d: 'M506 175 C510 182 512 200 510 222 C509 238 505 252 499 260 C494 258 490 250 491 240 C492 220 498 196 502 178 Z',
  },
  {
    key: 'lats-right',
    d: 'M628 175 C632 182 638 196 640 216 C642 232 640 250 636 260 C630 252 626 238 625 222 C623 200 625 182 628 175 Z',
  },

  /* Triceps */
  {
    key: 'triceps-left',
    d: 'M496 178 C491 190 490 210 493 228 C498 236 506 236 510 228 C513 210 512 190 508 178 Z',
  },
  {
    key: 'triceps-right',
    d: 'M626 178 C630 190 641 206 638 226 C634 236 626 238 622 228 C619 210 619 190 624 178 Z',
  },

  /* Forearms (back) */
  {
    key: 'forearms-back-left',
    d: 'M490 234 C486 248 485 268 488 286 C492 292 500 292 504 286 C507 268 506 248 502 234 Z',
  },
  {
    key: 'forearms-back-right',
    d: 'M628 234 C632 248 646 264 643 282 C639 292 631 292 627 286 C624 268 624 248 628 234 Z',
  },

  /* Lower back / erector spinae */
  {
    key: 'lower-back-left',
    d: 'M554 240 C558 242 560 254 559 274 C558 290 554 304 549 308 C545 305 543 295 543 278 C543 260 547 244 554 240 Z',
  },
  {
    key: 'lower-back-right',
    d: 'M580 240 C587 244 591 260 591 278 C591 295 589 305 585 308 C580 304 576 290 575 274 C574 254 576 242 580 240 Z',
  },

  /* Glutes */
  {
    key: 'glutes-left',
    d: 'M524 318 C532 312 544 312 552 320 C557 330 556 350 548 362 C540 370 528 370 520 362 C514 350 516 328 524 318 Z',
  },
  {
    key: 'glutes-right',
    d: 'M582 320 C590 312 602 312 610 318 C618 328 620 350 614 362 C606 370 594 370 586 362 C578 350 577 330 582 320 Z',
  },

  /* Hamstrings */
  {
    key: 'hamstrings-left',
    d: 'M527 370 C532 376 534 394 532 418 C530 438 524 458 517 468 C511 466 507 456 508 442 C509 418 515 386 521 372 Z',
  },
  {
    key: 'hamstrings-right',
    d: 'M607 370 C613 376 625 390 626 410 C627 430 623 454 617 466 C611 458 605 438 603 418 C601 394 603 376 607 370 Z',
  },

  /* Gastrocnemius / calves */
  {
    key: 'gastrocnemius-left',
    d: 'M519 474 C524 482 526 504 523 526 C521 540 516 552 511 556 C506 552 503 540 503 524 C503 502 508 480 514 474 Z',
  },
  {
    key: 'gastrocnemius-right',
    d: 'M615 474 C621 480 631 500 631 520 C631 538 628 552 623 556 C618 552 613 540 611 526 C608 504 610 482 615 474 Z',
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   regionStates key mapping
   When a Hermes region like 'deltoids' is active, the parent must set state
   on BOTH 'deltoids-left' and 'deltoids-right'. Use REGION_TO_SVG_KEYS
   to expand a Hermes region key → array of SVG path keys.
   ───────────────────────────────────────────────────────────────────────── */
export const REGION_TO_SVG_KEYS = {
  // Front
  'neck': ['neck'],
  'traps-front': ['traps-front-left', 'traps-front-right'],
  'deltoids': ['deltoids-left', 'deltoids-right'],
  'pectorals': ['pectorals-left', 'pectorals-right'],
  'biceps': ['biceps-left', 'biceps-right'],
  'forearms-front': ['forearms-front-left', 'forearms-front-right'],
  'abdominals': ['abdominals', 'obliques-left', 'obliques-right'],
  'quadriceps': ['quadriceps-left', 'quadriceps-right'],
  'adductors': ['adductors-left', 'adductors-right'],
  'calves-front': ['calves-front-left', 'calves-front-right'],
  // Back
  'trapezius': ['trapezius-left', 'trapezius-right'],
  'shoulders-back': ['shoulders-back-left', 'shoulders-back-right'],
  'lats': ['lats-left', 'lats-right'],
  'triceps': ['triceps-left', 'triceps-right'],
  'forearms-back': ['forearms-back-left', 'forearms-back-right'],
  'lower-back': ['lower-back-left', 'lower-back-right'],
  'glutes': ['glutes-left', 'glutes-right'],
  'hamstrings': ['hamstrings-left', 'hamstrings-right'],
  'gastrocnemius': ['gastrocnemius-left', 'gastrocnemius-right'],
};

/**
 * Expand a Set of Hermes region keys into a flat object mapping each SVG path
 * key to its state: 'idle' | 'plan-active' | 'active' | 'focused'.
 *
 * @param {Set<string>} planRegions    — regions in today's plan
 * @param {string|null} hoveredKey     — region currently hovered/focused
 * @param {string|null} selectedKey    — region currently selected (clicked)
 * @param {'front'|'back'} view        — which anatomy side to expand
 * @returns {Object<string, string>}   — { svgPathKey: state }
 */
export function buildRegionStates(planRegions, hoveredKey, selectedKey, view) {
  const muscles = view === 'front' ? ANATOMY_FRONT_MUSCLES : ANATOMY_BACK_MUSCLES;
  const states = {};
  for (const m of muscles) {
    states[m.key] = 'idle';
  }
  // Apply plan-active first (lowest priority)
  for (const regionKey of planRegions) {
    const svgKeys = REGION_TO_SVG_KEYS[regionKey] || [];
    for (const k of svgKeys) {
      if (k in states) states[k] = 'plan-active';
    }
  }
  // Apply focused (hover)
  if (hoveredKey) {
    const svgKeys = REGION_TO_SVG_KEYS[hoveredKey] || [];
    for (const k of svgKeys) {
      if (k in states) states[k] = 'focused';
    }
  }
  // Apply active (selected, highest priority)
  if (selectedKey) {
    const svgKeys = REGION_TO_SVG_KEYS[selectedKey] || [];
    for (const k of svgKeys) {
      if (k in states) states[k] = 'active';
    }
  }
  return states;
}

/**
 * MuscleAnatomySvg — renders one side's muscle paths as a <g> element.
 *
 * Each muscle is wrapped in a group containing:
 *   1. Base path — receives gradient fill + active state styling
 *   2. Shine path — screen-blend highlight for dimensional depth
 *
 * Props:
 *   view          — 'front' | 'back'
 *   regionStates  — { [svgPathKey]: 'idle'|'plan-active'|'active'|'focused' }
 *                   Use buildRegionStates() to compute this in the parent.
 */
export function MuscleAnatomySvg({ view, regionStates }) {
  const muscles = view === 'front' ? ANATOMY_FRONT_MUSCLES : ANATOMY_BACK_MUSCLES;
  return (
    <g className={`muscle-anatomy muscle-anatomy--${view}`} aria-hidden="true">
      {muscles.map((m) => (
        <g
          key={m.key}
          className={`muscle-anatomy-group is-${regionStates[m.key] || 'idle'}`}
          data-muscle={m.key}
        >
          {/* Base muscle path — gradient fill + active state */}
          <path
            d={m.d}
            className="muscle-anatomy-part"
            data-muscle={m.key}
          />
          {/* Shine overlay — screen-blend highlight, pointer-events off */}
          <path
            d={m.d}
            className="muscle-anatomy-shine"
            data-muscle={m.key}
          />
        </g>
      ))}
    </g>
  );
}
