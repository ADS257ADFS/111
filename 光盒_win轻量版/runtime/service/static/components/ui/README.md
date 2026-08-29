# components/ui

This folder holds **vanilla CSS ports** of shadcn-style UI for the 光盒 WebView2 shell.

## Why this is not a React / shadcn / Tailwind tree

The desktop app serves static HTML/CSS/JS inside WebView2. There is no Vite/Next
app, no `tsconfig` path aliases (`@/…`), and no Tailwind build. Scaffolding a full
shadcn CLI project here would not load in the dock iframe.

If you ever spin up a separate React app:

```bash
npx shadcn@latest init
npx shadcn@latest add avatar
npm i ai @radix-ui/react-avatar
```

Put components under that app’s `components/ui` (default). Keep this folder as the
runtime port for the shell.

## Message (dock chat body fills)

Source intent: shadcn `MessageContent`

| Role | Tailwind intent | Shell mapping |
|------|-----------------|---------------|
| user | `bg-primary` / `text-primary-foreground` | `--ui-accent` / `--ui-text-on-accent` |
| assistant | `bg-secondary` / `text-foreground` | `#2a2a2a` (dark) / `--ui-surface-elevated` (light) |

Applied on existing `.bubble.user` / `.bubble.assistant` nodes in the right-rail
gpt-dock chat. See `message.css` and the late lock in `css/minimax-visual.css`.
