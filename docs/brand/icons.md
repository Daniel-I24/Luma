# Icons

One set for the whole app: **Lucide** (https://lucide.dev), outline, 24×24
grid, 2 px round stroke, the same size scale (`LumaIcon` sizes `sm`, `md`,
`lg`, `xl`). Only the icons the app uses are copied, as path data, into
`src/app/design-system/icon/luma-icons.ts` (no npm dependency, nothing else
reaches the bundle). Source: `lucide-static` 0.468.0; circles, lines and
rects were converted to paths without changing the drawing.

The only exception is `luma-ai`, Luma's own mark.

To add an icon: take its SVG from the same Lucide version, copy the path
data in the same style and add a row below.

| Name in Luma | Lucide icon |
| --- | --- |
| `alert` | `circle-alert` |
| `bread` | `croissant` |
| `burger` | `sandwich` |
| `arrow-left` | `arrow-left` |
| `arrow-up` | `arrow-up` |
| `arrow-down` | `arrow-down` |
| `grip` | `grip-vertical` |
| `check` | `check` |
| `chevron-down` | `chevron-down` |
| `chevron-up` | `chevron-up` |
| `clock` | `clock` |
| `close` | `x` |
| `coffee` | `coffee` |
| `help` | `circle-help` |
| `compass` | `compass` |
| `globe` | `globe` |
| `heart` | `heart` |
| `info` | `info` |
| `locate` | `locate-fixed` |
| `map` | `map` |
| `minus` | `minus` |
| `palette` | `palette` |
| `phone` | `phone` |
| `pin` | `map-pin` |
| `pizza` | `pizza` |
| `plus` | `plus` |
| `receipt` | `receipt` |
| `search` | `search` |
| `star` | `star` |
| `store` | `store` |
| `tag` | `tag` |
| `utensils` | `utensils` |
| `user` | `user` |
| `edit` | `pencil` |
| `trash` | `trash-2` |
| `bell` | `bell` |
| `image` | `image` |
| `filter` | `filter` |
| `eye` | `eye` |
| `eye-off` | `eye-off` |
| `calendar` | `calendar` |
| `luma-ai` | (Luma's own mark) |

## Licence (ISC)

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
