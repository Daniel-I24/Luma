# Button semantics

One variant per function, the same for `LumaButton` and `LumaIconButton`
(`src/app/design-system/`). A variant says what the button does, not how
loud it should look; the screen uses the variant of the function.

| Variant | Function | Examples |
| --- | --- | --- |
| `primary` | The main action of the screen (one per screen) | Pedir, Pagar, Guardar, Enviar a revisión, Continuar |
| `confirm` | Accept or finish something | Aceptar pedido, Preparando, Listo, Entregado, Aprobar negocio, Reanudar pedidos, Marcar reembolsado |
| `secondary` | An alternative to the main action | Pedir de nuevo, Elegir foto, Conciliar ahora, options of a choice |
| `ghost` | Low emphasis, leaving or dismissing | Volver, Mantener, Ahora no, Omitir, Limpiar filtros |
| `danger` | Cancel, reject, delete, remove, discard, void | Cancelar pedido, Rechazar, No llegó, Eliminar plato, Quitar foto, Terminar promoción, Anular en Wompi, Vaciar el carrito, Eliminar cuenta |
| `warning` | Pause or suspend, reversible but with consequences | Pausar pedidos (15-120 min), Suspender negocio, Guardar y volver a revisión |
| `link` | An action that reads as text inside content | Cambiar municipio, Cambiar correo |

`LumaIconButton` also has `surface` for buttons that float over the map.

## States

Every variant has rest, hover (pointer devices only), pressed (scale
`--motion-press-scale`), visible focus (2 px `--color-border-focus` ring),
disabled (45 % opacity, not clickable) and loading (`[loading]="true"`:
`aria-busy`, three dots that fade, not clickable; under reduced motion the
dots are still). Sizes `sm`, `md`, `lg`; every size keeps the 44 px touch
target.

## Colours (tokens, AA in every theme)

`primary` uses `--color-primary`; `confirm` `--color-confirm` (cilantro);
`danger` `--color-danger` (crimson); `warning` `--color-warning-strong`
(maize, dark text `--color-warning-fg-on`); `link` `--color-fg-accent`.
`npm run check:contrast` covers each pair.

## Enforcement

`npm run check:buttons` (`scripts/check-destructive-buttons.mjs`, in CI)
fails when a button whose label is a destructive action (cancel an order,
reject, delete, remove, discard, end, void, "No llegó", empty the cart,
delete the account) does not use `danger`, including the owner's order
actions and buttons whose variant is bound at run time.

The review of round 2 changed: accept/preparing/ready/delivered to
`confirm`; reject, cancel and "No llegó" to `danger`; the pause options to
`warning` and "Reanudar" to `confirm`; the admin decisions to `confirm`,
`danger` and `warning`; removing a cart line, a photo, an image, a dish or
a review, ending a promotion, discarding a scan and replacing the cart to
`danger`; "Cambiar" links to `link`. `accent` and `danger-outline` no longer
exist.
