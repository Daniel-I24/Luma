# Motion

Motion in Luma explains what happened (a dish went into the cart, the order
moved on, the payment went through); it is never decoration for its own sake.
Tokens live in `src/styles/scale.css`, utilities and keyframes in
`src/styles/motion.css`.

## Principles

1. **One curve to enter, one to leave.** `--ease-enter`
   (`cubic-bezier(0.2, 0, 0, 1)`, fast start, soft landing) for anything that
   appears or responds; `--ease-exit` (`cubic-bezier(0.4, 0, 1, 1)`) for
   anything that leaves. No springs, overshoot, bounce or pulsing.
2. **Short.** Controls 120–220 ms, screens 340 ms. Leaving is faster than
   entering.
3. **Cheap.** Only `transform` and `opacity` are animated (panels expand with
   `grid-template-rows`), so motion stays at 60 fps on low-end Android.
4. **Physical where it is touched.** A bottom sheet released with a fling
   closes at the speed of the finger (`flingDurationMs`, 120–340 ms).
5. **Reduced motion.** With `prefers-reduced-motion: reduce`, `base.css`
   removes animations and transitions, press scales are disabled, list
   stagger is off, the drawn check appears complete and the cart flight does
   not run. Nothing depends on an animation to be understood.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--duration-instant` | 120 ms | Press feedback |
| `--duration-fast` | 160 ms | Colour, icons, fades of small pieces |
| `--duration-theme` | 200 ms | Theme crossfade |
| `--duration-normal` | 220 ms | Sheets returning, toasts, panels |
| `--duration-slow` | 340 ms | Route transitions, sheets opening, micro-interactions |
| `--duration-shimmer` | 1.6 s | Skeletons only |
| `--duration-stagger` | 40 ms | Between list items (first 4 only) |
| `--motion-press-scale` | 0.97 | Pressed controls |

## Utilities

| Utility | What it does |
| --- | --- |
| `pressable` | Scale 0.97 on press plus colour transitions |
| `motion-stagger` | List entrance fade, `--stagger-index` capped at 3 |
| `motion-pop` | Favourite marked, short scale without overshoot |
| `motion-shake` | A change was reverted (saving failed) |
| `motion-enter-fade`, `motion-leave-fade`, `motion-enter-down`, `motion-leave-up` | Angular `animate.enter` / `animate.leave` |
| `motion-draw` | An SVG stroke draws itself (`pathLength="1"`) |
| `motion-advance` | A filled bar grows to its new length |

## Micro-interactions with meaning

| Moment | Implementation |
| --- | --- |
| A dish goes into the cart | `CartFlight` (`shared/cart/cart-flight.service.ts`): a brand dot flies from "Agregar" to the cart bar with WAAPI, `--duration-slow`, `--ease-enter`; skipped when the bar is hidden |
| The order moves on | `OrderTimeline`: the line under each finished step fills downwards (`motion-advance`, `scaleY`) |
| A payment is approved | `LumaCheckmark` (`design-system/checkmark`): the check draws itself (`motion-draw`) |
| Opening a business | View Transitions: the logo keeps its place from the card to the profile (`BusinessTransition.logoName(id)`) |
| Changing tabs and routes | View Transitions, 340 ms fade |
| Theme change | 200 ms colour crossfade, only while `ThemeService` sets the class |

## Rules for new motion

- Use the tokens; never a literal duration or curve in a component.
- Animate the thing that changed, from where it was to where it went.
- Haptics (`NativeHaptics`) accompany adding to the cart and confirmations,
  not every tap.
- If an animation could delay an action or hide content, remove it.
