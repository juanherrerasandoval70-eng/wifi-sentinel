# DESIGN.md — WiFi Sentinel (Apple Monochrome Edition)

## Visual World & Aesthetic Direction
- **Style:** Apple Minimalist Monochrome (Cupertino Precision / Swiss Editorial Black & White).
- **Mode:** Operate (High-precision network utility where clarity, hierarchy, native touch ergonomics, and speed lead).
- **Theme Polarity:** Pure Daylight White (`#FFFFFF`) primary default with high-contrast Pure Ink Black (`#000000`) typography and active states, plus instant toggle to Pure OLED Dark Monochrome (`#000000` / `#0A0A0A`).

## Color Tokens
- `--bg-primary`: `#FFFFFF` (Light) / `#000000` (Dark)
- `--bg-secondary`: `#F5F5F7` (Light) / `#111113` (Dark)
- `--bg-inverted`: `#000000` (Light) / `#FFFFFF` (Dark)
- `--text-primary`: `#000000` (Light) / `#FFFFFF` (Dark)
- `--text-secondary`: `#3F3F46` (Light, contrast 10.4:1) / `#A1A1AA` (Dark, contrast 7.8:1)
- `--text-muted`: `#52525B` (Light, contrast 7.2:1) / `#8E8E93` (Dark, contrast 5.1:1)
- `--border-hairline`: `#E4E4E7` (Light) / `#27272A` (Dark)
- `--border-strong`: `#000000` (Light) / `#FFFFFF` (Dark)

## Typography
- **UI & Headings:** `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, sans-serif. Sentence case headings with `-0.025em` tracking. No tracked-out uppercase eyebrows.
- **Technical Data & Telemetry:** `JetBrains Mono` with `font-variant-numeric: tabular-nums` strictly for IP addresses, MAC addresses, latency (`ms`), signal (`dBm`), and port numbers.

## Structural & Craft Rules
1. **No SaaS card grids:** Use architectural hairline-divided lists (`1px solid var(--border-hairline)`) and clean split sections instead of repeated floating cards.
2. **Inline expansion over modals:** Selecting a device expands its full diagnostic and action drawer inline within the list or below the radar, avoiding disruptive modal overlays.
3. **Zero neon halos or gradients:** Elevation is declared once via crisp `1px` structural borders. Active controls invert cleanly (`background: var(--bg-inverted); color: var(--bg-primary)`).
4. **Touch targets:** Minimum `44px × 44px` on all interactive buttons, tabs, and rows.
5. **Vector iconography:** Consistent `1.75px` stroke monochrome SVGs. Zero emojis.
