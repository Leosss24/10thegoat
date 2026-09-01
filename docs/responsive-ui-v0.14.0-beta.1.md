# Responsive UI · v0.14.0-beta.1

This iteration refines the existing Arena interface without changing translations, game rules, Supabase queries, score storage, data models, or brand assets.

## Scope

- Shared responsive spacing, content gutters, touch targets, focus states, and long-copy wrapping.
- Compact mobile header and language selector with explicit locale labels on larger screens.
- Arena homepage: the panoramic interactive room remains on tablet and desktop; small screens receive an equivalent touch-first game menu that avoids horizontal scrolling.
- Responsive game catalog, legal/Beta pages, and footer.
- Mobile and landscape layouts for Higher or Lower, Guess the Player, and Guess the Badge.
- Wordle keyboard sizing, difficulty controls, result cards, badge autocomplete sizing, suggestions scrolling, player cards, score panels, and error/loading states.
- `prefers-reduced-motion` fallback and live-region semantics for asynchronous and result feedback.

## Validation

- `npm run build`: production build, TypeScript, and 41 statically generated pages pass.
- Browser checks at 360×800, 390×844, 740×420, 768×1024, and 1440×900.
- Spanish, English, and French routes checked, including long French catalog/legal copy.
- No document-level horizontal overflow detected in the tested viewport matrix.
- Primary navigation and language controls meet a 44 px minimum target in the tested layouts.
- Browser console produced no warnings or errors.

Interactive Supabase-backed game rounds require the local public Supabase environment variables. Without `.env.local`, the checks cover their localized error states and the static responsive structure; production data contracts remain unchanged.
