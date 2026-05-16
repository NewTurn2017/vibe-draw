# vibe-draw UI Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** frontend의 모든 DOM UI를 Notion · Soft Modern 톤(웜 라이트 + 오렌지)으로 리뉴얼 — 인라인 스타일 ~34곳 제거, Tailwind + shadcn/ui 디자인 시스템 도입, lucide-react 아이콘 정렬.

**Architecture:** Tailwind v3 + shadcn/ui를 단일 PR로 도입. `tailwind.config.ts`에 디자인 토큰 박고 `globals.css`에 CSS 변수 미러. shadcn 4개 컴포넌트(button, toggle, tabs, tooltip)만 가져와 베이스로 쓰고, 도메인 컴포넌트(Vibe3DCodeButton 등)는 컴포넌트 경계 유지하면서 내부만 갈아끼움. Tldraw CSS와의 충돌은 `corePlugins.preflight: false`로 회피.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS v3.4, shadcn/ui, lucide-react, Radix UI primitives, pnpm.

**Reference:** spec `docs/superpowers/specs/2026-05-16-ui-renewal-design.md`.

---

## File Structure

**Create (10 files):**
- `frontend/tailwind.config.ts` — 디자인 토큰 (colors, radius, shadow, font)
- `frontend/postcss.config.js` — Tailwind/autoprefixer 파이프
- `frontend/components.json` — shadcn config
- `frontend/app/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `frontend/app/components/ui/button.tsx` — shadcn Button
- `frontend/app/components/ui/toggle.tsx` — shadcn Toggle
- `frontend/app/components/ui/tabs.tsx` — shadcn Tabs
- `frontend/app/components/ui/tooltip.tsx` — shadcn Tooltip
- `frontend/app/components/TabGroup.tsx` — 추출된 2D/3D 탭 컴포넌트
- `frontend/app/components/icons.tsx` — Brain/Cube 그라데이션 아이콘 단일 정의

**Modify (10 files):**
- `frontend/app/globals.css` — Tailwind directives + CSS 변수 토큰, legacy 클래스 정리
- `frontend/app/page.tsx` — TabGroup 분리, SharePanel children 단순화
- `frontend/app/components/Vibe3DCodeButton.tsx` — 인라인 → Tailwind + shadcn Button/Toggle/Tooltip
- `frontend/app/components/ImproveDrawingButton.tsx` — 동일 패턴
- `frontend/app/components/AutoDrawButton.tsx` — 동일 패턴
- `frontend/app/components/TldrawLogo.tsx` — Tailwind class
- `frontend/app/PreviewShape/PreviewShape.tsx` — 인라인 → Tailwind class
- `frontend/app/PreviewShape/Model3DPreviewShape.tsx` — 인라인 → Tailwind class
- `frontend/app/tldraw.css` — Tldraw 토스트/패널 톤 오버라이드
- `frontend/package.json` — Tailwind/shadcn 관련 deps 추가

**Out of scope (손대지 않음):**
- `frontend/app/components/TestAddCodeButton.tsx` — dead code (별도 cleanup PR로 분리)
- `frontend/app/components/three/*.tsx` — Three.js scene primitives, DOM 스타일 없음
- `frontend/app/store/*`, `frontend/app/lib/*` (utils.ts 추가 외) — 비즈니스 로직, 톤과 무관

---

## Verification Approach

본 프로젝트는 jest/playwright 셋업이 없음. 자동 테스트는 신설하지 않고, **각 task 끝에 빌드 + 수동 골든패스** 조합으로 검증.

- **Build gate**: `pnpm build` 통과 (TS 에러 0, Next 빌드 클린).
- **Dev gate**: `pnpm dev` → 콘솔 에러/경고 0.
- **수동 골든패스** (필요 시): 페이지 진입, 2D↔3D 탭 토글, 액션 버튼 hover/click, Tldraw 좌측 툴바 동작.

---

## Task 1: Tailwind 설치 + 기본 셋업

**Files:**
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/app/globals.css` (top — directives만 추가, 기존 CSS 그대로 둠)
- Modify: `frontend/package.json` (자동, pnpm add)

- [ ] **Step 1: 디렉터리 진입 + Tailwind/관련 deps 설치**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm add -D tailwindcss@^3.4.0 postcss@^8 autoprefixer@^10
```

Expected: `package.json` devDependencies에 3개 추가, pnpm-lock.yaml 업데이트.

- [ ] **Step 2: `postcss.config.js` 생성**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: `tailwind.config.ts` 최소 셋업 생성** (토큰은 다음 task에서)

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
  ],
  corePlugins: {
    // Tldraw가 button/input 등의 default style을 가정. preflight 끄고 우리 스타일만 추가.
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

- [ ] **Step 4: `globals.css` 최상단에 Tailwind directives 추가**

기존 globals.css 맨 위에 다음 4줄 추가 (기존 CSS는 건드리지 않음):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: dev 서버에서 기존 화면 깨지지 않는지 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm dev
```

브라우저 `http://localhost:3000` 열고:
- 페이지 로드 OK (콘솔 에러 0)
- TabGroup, 액션 버튼, Tldraw 좌측 툴바 — **여전히 기존 모습 그대로** (Tailwind class 안 썼으니까 변화 없어야 정상)
- 어딘가 화면이 깨졌으면 preflight: false가 빠진 거.

- [ ] **Step 6: 커밋**

```bash
cd /Users/genie/dev/lab/vibe-draw
git add frontend/package.json frontend/pnpm-lock.yaml frontend/tailwind.config.ts frontend/postcss.config.js frontend/app/globals.css
git commit -m "chore(frontend): set up Tailwind v3 with preflight disabled"
```

---

## Task 2: 디자인 토큰 박기 (tailwind.config + CSS 변수)

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: `tailwind.config.ts`의 `theme.extend`를 spec 토큰으로 채우기**

`extend: {}` 를 다음으로 교체:

```ts
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--vd-background))',
        surface:    'hsl(var(--vd-surface))',
        border:     'hsl(var(--vd-border))',
        muted:      'hsl(var(--vd-muted))',
        foreground: 'hsl(var(--vd-foreground))',
        subtle:     'hsl(var(--vd-subtle))',
        faint:      'hsl(var(--vd-faint))',
        accent: {
          DEFAULT: 'hsl(var(--vd-accent))',
          light:   'hsl(var(--vd-accent-light))',
          dark:    'hsl(var(--vd-accent-dark))',
        },
        danger:  'hsl(var(--vd-danger))',
        success: 'hsl(var(--vd-success))',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        card:   '0 1px 2px rgba(0,0,0,0.04)',
        pop:    '0 2px 6px rgba(0,0,0,0.06)',
        hover:  '0 4px 14px rgba(0,0,0,0.08)',
        accent: '0 2px 6px rgba(255,120,75,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
```

- [ ] **Step 2: `globals.css`의 Tailwind directives 바로 아래에 `:root` CSS 변수 추가**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* vibe-draw design tokens — Notion · Soft Modern */
  --vd-background:    36 30% 96%;   /* #f7f5f1 warm light */
  --vd-surface:       0 0% 100%;    /* #ffffff */
  --vd-border:        36 20% 89%;   /* #e8e4dc */
  --vd-muted:         36 22% 91%;   /* #ede9e1 */
  --vd-foreground:    36 6% 16%;    /* #2b2a26 */
  --vd-subtle:        36 6% 39%;    /* #6b6760 */
  --vd-faint:         36 5% 52%;    /* #8c887e */
  --vd-accent:        16 100% 61%;  /* #ff7038 orange */
  --vd-accent-light:  18 100% 68%;  /* #ff8a5b */
  --vd-accent-dark:   16 80% 51%;   /* #e85a20 */
  --vd-danger:        0 72% 51%;    /* #dc2626 */
  --vd-success:       142 71% 35%;  /* #16a34a */
}
```

- [ ] **Step 3: Inter 폰트 CSS 변수 연결 — `app/layout.tsx`에 variable 추가**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Vibe Draw',
  description: 'draw a 3d model and make it real',
  manifest: '/manifest.json',
  icons: [{ rel: 'icon', url: '/icon.jpeg' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: 토큰 작동 확인 — 임시 검증 element 한 줄 추가 후 제거**

`page.tsx` return 안에 일시적으로 `<div className="hidden bg-accent text-foreground rounded-lg shadow-card font-sans">probe</div>` 추가 → `pnpm dev` 콘솔에 unknown class 경고 없으면 OK → 추가한 줄 제거.

- [ ] **Step 5: 커밋**

```bash
git add frontend/tailwind.config.ts frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat(frontend): wire design tokens via tailwind config + CSS variables"
```

---

## Task 3: shadcn init + cn() helper

**Files:**
- Create: `frontend/components.json`
- Create: `frontend/app/lib/utils.ts`
- Modify: `frontend/package.json` (자동)

- [ ] **Step 1: shadcn 관련 deps 설치**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm add clsx tailwind-merge class-variance-authority
```

- [ ] **Step 2: `components.json` 생성** (shadcn init 결과 수동 작성 — CLI는 interactive)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": false,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

(`cssVariables: false` 이유 — 우리는 자체 `--vd-*` 변수를 쓰고, shadcn 컴포넌트 안에서는 Tailwind class 직접 사용. shadcn 기본 변수 셋을 중복으로 박지 않음.)

- [ ] **Step 3: `app/lib/utils.ts` 생성**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: import 동작 확인**

`pnpm dev` 띄운 상태에서 콘솔 에러 0 / TS 에러 0 확인. 또는:

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/components.json frontend/app/lib/utils.ts
git commit -m "chore(frontend): shadcn init + cn() helper"
```

---

## Task 4: shadcn 4개 컴포넌트 추가 (Button / Toggle / Tabs / Tooltip)

**Files:**
- Create: `frontend/app/components/ui/button.tsx`
- Create: `frontend/app/components/ui/toggle.tsx`
- Create: `frontend/app/components/ui/tabs.tsx`
- Create: `frontend/app/components/ui/tooltip.tsx`
- Modify: `frontend/package.json` (radix deps)

- [ ] **Step 1: shadcn CLI로 4개 추가**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm dlx shadcn@latest add button toggle tabs tooltip
```

Expected: `app/components/ui/{button,toggle,tabs,tooltip}.tsx` 생성, `@radix-ui/react-toggle`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-slot` 자동 설치.

- [ ] **Step 2: Button variant를 우리 톤에 맞게 수정**

`app/components/ui/button.tsx` 안의 `buttonVariants`를 다음으로 교체 (변형: default / outline / ghost / accent / icon):

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground border border-border shadow-card hover:shadow-hover hover:border-faint/40",
        outline: "bg-transparent text-foreground border border-border hover:bg-muted",
        ghost:   "bg-transparent text-subtle hover:bg-muted hover:text-foreground",
        accent:  "bg-accent text-white shadow-accent hover:bg-accent-dark",
        icon:    "bg-surface text-subtle border border-border shadow-card hover:text-foreground hover:shadow-hover",
      },
      size: {
        default: "h-9 px-3 text-sm",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-4 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

(나머지 Button forwardRef wrapper는 shadcn 기본 그대로 둠.)

- [ ] **Step 3: Toggle/Tabs/Tooltip은 shadcn 기본 그대로 두되, 우리 토큰 사용하도록 className 미세 조정**

`app/components/ui/toggle.tsx`의 `toggleVariants`에서 색 부분만 우리 토큰으로:

```ts
// before: "bg-transparent hover:bg-muted hover:text-muted-foreground ..."
// after:
const toggleVariants = cva(
  "inline-flex items-center justify-center rounded text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-muted data-[state=on]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent hover:bg-muted",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2",
        lg: "h-10 px-3",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

`app/components/ui/tabs.tsx`의 `TabsList` / `TabsTrigger` className을:

```ts
const TabsList = React.forwardRef<...>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-pop",
      className
    )}
    {...props}
  />
))

const TabsTrigger = React.forwardRef<...>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-subtle transition-all hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-muted data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
))
```

`app/components/ui/tooltip.tsx`의 `TooltipContent` className을:

```ts
const TooltipContent = React.forwardRef<...>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-[9999999] overflow-hidden rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-pop animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
))
```

- [ ] **Step 4: 빌드 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
git add frontend/app/components/ui/ frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(frontend): add shadcn primitives (Button/Toggle/Tabs/Tooltip) themed to vd tokens"
```

---

## Task 5: 공용 아이콘 모듈 (`icons.tsx`) — Cube / Brain 그라데이션 추출

**Files:**
- Create: `frontend/app/components/icons.tsx`

기존 `Vibe3DCodeButton.tsx`의 인라인 SVG (CubeIcon, BrainIcon, ToggleSwitch)를 재사용 가능한 컴포넌트로 분리. 다른 곳에서도 재사용 가능 + Button JSX가 가벼워짐.

- [ ] **Step 1: `icons.tsx` 생성**

```tsx
import { type SVGProps } from 'react'

/** 3D cube — thinking mode일 때 보라/시안 그라데이션 stroke */
export function CubeIcon({ gradient = false, ...props }: SVGProps<SVGSVGElement> & { gradient?: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={gradient ? 'url(#vd-cube-gradient)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      {...props}
    >
      <defs>
        <linearGradient id="vd-cube-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

/** Brain — thinking mode 그라데이션 표시용 */
export function BrainIcon({ gradient = false, ...props }: SVGProps<SVGSVGElement> & { gradient?: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={gradient ? 'url(#vd-brain-gradient)' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      {...props}
    >
      <defs>
        <linearGradient id="vd-brain-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff80ff" />
          <stop offset="100%" stopColor="#80ffff" />
        </linearGradient>
      </defs>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.04Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.04Z"/>
    </svg>
  )
}
```

- [ ] **Step 2: 빌드 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend && pnpm tsc --noEmit
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add frontend/app/components/icons.tsx
git commit -m "feat(frontend): extract Cube/Brain gradient icons into shared module"
```

---

## Task 6: TabGroup 추출 + 리스타일

**Files:**
- Create: `frontend/app/components/TabGroup.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: `TabGroup.tsx` 생성**

```tsx
'use client'

import { Square, Box } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type TabType = 'tldraw' | 'threejs'

interface TabGroupProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

export function TabGroup({ activeTab, setActiveTab }: TabGroupProps) {
  return (
    <div className="fixed top-5 left-1/2 z-[9999999] -translate-x-1/2">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="tldraw">
            <Square className="h-3.5 w-3.5" />
            2D Canvas
          </TabsTrigger>
          <TabsTrigger value="threejs">
            <Box className="h-3.5 w-3.5" />
            3D World
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: `page.tsx`에서 inline TabGroup 제거 + 새 컴포넌트 import**

`page.tsx` 전체를 다음으로 교체:

```tsx
'use client'

import dynamic from 'next/dynamic'
import './tldraw.css'
import { Vibe3DCodeButton } from './components/Vibe3DCodeButton'
import { AutoDrawButton } from './components/AutoDrawButton'
import { ImproveDrawingButton } from './components/ImproveDrawingButton'
import { PreviewShapeUtil } from './PreviewShape/PreviewShape'
import { Model3DPreviewShapeUtil } from './PreviewShape/Model3DPreviewShape'
import { TabGroup } from './components/TabGroup'
import { TldrawLogo } from './components/TldrawLogo'
import { useTabStore } from './store/appStore'
import TestAddCodeButton from './components/TestAddCodeButton'

const ThreeJSCanvas = dynamic(() => import('./components/three/canvas'), { ssr: false })
const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, { ssr: false })

const shapeUtils = [PreviewShapeUtil, Model3DPreviewShapeUtil]

export default function App() {
  const { activeTab, setActiveTab } = useTabStore()

  return (
    <>
      <TabGroup activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="editor">
        <div
          className="absolute h-full w-full"
          style={{
            visibility: activeTab === 'tldraw' ? 'visible' : 'hidden',
            zIndex: activeTab === 'tldraw' ? 2 : 1,
          }}
        >
          <Tldraw
            persistenceKey="vibe-3d-code"
            components={{
              SharePanel: () => (
                <div className="flex items-center gap-2 p-3">
                  <ImproveDrawingButton />
                  <AutoDrawButton />
                  <Vibe3DCodeButton />
                </div>
              ),
            }}
            shapeUtils={shapeUtils}
          >
            <TldrawLogo />
          </Tldraw>
        </div>
        <ThreeJSCanvas visible={activeTab === 'threejs'} />
      </div>
      <TestAddCodeButton activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  )
}
```

(visibility/zIndex는 React-state-driven이라 inline 유지가 명확. h/w는 Tailwind class로.)

- [ ] **Step 3: dev 서버에서 시각 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend && pnpm dev
```

브라우저에서:
- TabGroup이 상단 중앙에 작은 흰 카드로 표시 (Square / Box 아이콘 + 라벨)
- 활성 탭은 muted 배경 (#ede9e1)
- 클릭 → 2D ↔ 3D 전환 동작
- Tldraw / Three.js 캔버스 정상 렌더

- [ ] **Step 4: 커밋**

```bash
cd /Users/genie/dev/lab/vibe-draw
git add frontend/app/components/TabGroup.tsx frontend/app/page.tsx
git commit -m "feat(frontend): extract TabGroup and restyle with shadcn Tabs"
```

---

## Task 7: ImproveDrawingButton 마이그레이션

**Files:**
- Modify: `frontend/app/components/ImproveDrawingButton.tsx`

- [ ] **Step 1: 현재 파일 구조 확인**

```bash
cat /Users/genie/dev/lab/vibe-draw/frontend/app/components/ImproveDrawingButton.tsx
```

핸들러 로직 (useCallback / improveDrawing 호출 / addToast)은 그대로 유지하고 JSX/스타일만 갈아끼움.

- [ ] **Step 2: 파일 전체를 다음으로 교체**

```tsx
'use client'

import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { improveDrawing } from '../lib/improveDrawing'

export function ImproveDrawingButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = useCallback(async () => {
    if (isProcessing) return
    try {
      setIsProcessing(true)
      await improveDrawing(editor)
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [editor, addToast, isProcessing])

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="default"
            onClick={handleClick}
            disabled={isProcessing}
            aria-label="Improve drawing"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent" />
            )}
            {isProcessing ? 'Improving…' : 'Improve'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refine selection into a clean illustration</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

- [ ] **Step 3: 시각 + 동작 검증**

`pnpm dev` 띄운 상태에서:
- 우상단에 흰 카드 버튼 "Improve" + Sparkles 아이콘 (오렌지) 표시
- hover 시 그림자 진해짐
- Tldraw에서 도형 선택 → 클릭 → 로딩 spinner → 결과 이미지가 캔버스에 추가
- 도형 미선택 클릭 → "First select something to improve." 토스트

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/components/ImproveDrawingButton.tsx
git commit -m "feat(frontend): migrate ImproveDrawingButton to shadcn Button + lucide"
```

---

## Task 8: AutoDrawButton 마이그레이션

**Files:**
- Modify: `frontend/app/components/AutoDrawButton.tsx`

- [ ] **Step 1: 현재 파일 확인 (핸들러 로직 보존용)**

```bash
cat /Users/genie/dev/lab/vibe-draw/frontend/app/components/AutoDrawButton.tsx
```

- [ ] **Step 2: 파일 전체 교체 — 기존 핸들러 함수명/import 그대로 유지하고 JSX만 갈아끼움**

```tsx
'use client'

import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState } from 'react'
import { Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function AutoDrawButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = useCallback(async () => {
    if (isProcessing) return
    try {
      setIsProcessing(true)
      // NOTE: 기존 핸들러 로직을 그대로 호출. import 경로/함수명은 기존 파일 참조.
      // (구현 단계에서 기존 파일의 onClick 본문을 이 자리에 그대로 옮긴다.)
      await new Promise<void>((resolve) => resolve())
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [editor, addToast, isProcessing])

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="default"
            onClick={handleClick}
            disabled={isProcessing}
            aria-label="Auto draw"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 text-accent" />
            )}
            {isProcessing ? 'Drawing…' : 'Auto Draw'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Generate a drawing from a text prompt</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

**중요**: Step 2의 `await new Promise(...)` placeholder는 기존 파일의 onClick 본문(prompt 받기, AI 호출, shape 추가 등)으로 **그대로 교체**해야 한다. 기존 파일을 읽어서 핸들러 본문을 이 위치로 1:1 복사.

- [ ] **Step 3: 시각 + 동작 검증**

`pnpm dev`:
- "Auto Draw" 버튼 + Wand2 아이콘 (오렌지) 표시
- 클릭 시 기존과 동일한 동작 (prompt 입력 → AI 드로잉 생성)

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/components/AutoDrawButton.tsx
git commit -m "feat(frontend): migrate AutoDrawButton to shadcn Button + lucide"
```

---

## Task 9: Vibe3DCodeButton 마이그레이션 (가장 복잡)

**Files:**
- Modify: `frontend/app/components/Vibe3DCodeButton.tsx`

기존 파일이 인라인 8 블록 + Cube/Brain 그라데이션 SVG + ToggleSwitch + dual-mode (Make 3D vs Edit 3D) + 처리 중 spinner를 모두 직접 만든 형태. 이걸 분해해서:
- 그라데이션 아이콘 → `icons.tsx` 사용 (Task 5 결과)
- Toggle → shadcn Toggle
- Spinner → lucide `Loader2`
- 버튼 → shadcn Button (variant: `default`)

- [ ] **Step 1: 기존 파일 백업 메모용 출력**

```bash
cat /Users/genie/dev/lab/vibe-draw/frontend/app/components/Vibe3DCodeButton.tsx | wc -l
```

(원본 라인 수 기록 — 마이그레이션 후 절반 이하가 되어야 정상.)

- [ ] **Step 2: 파일 전체 교체**

```tsx
'use client'

import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CubeIcon, BrainIcon } from './icons'
import { vibe3DCode } from '../lib/vibe3DCode'
import { edit3DCode } from '../lib/edit3DCode'
import type { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [is3DModelSelected, setIs3DModelSelected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)

  useEffect(() => {
    const handleSelectionChange = () => {
      const selected = editor.getSelectedShapes()
      setIs3DModelSelected(selected.some((s) => s.type === 'model3d'))
    }
    handleSelectionChange()
    editor.addListener('change', handleSelectionChange)
    return () => {
      editor.removeListener('change', handleSelectionChange)
    }
  }, [editor])

  const handleClick = useCallback(async () => {
    if (isProcessing) return
    try {
      setIsProcessing(true)
      if (is3DModelSelected) {
        const selected = editor.getSelectedShapes()
        const model3d = selected.find((s) => s.type === 'model3d') as Model3DPreviewShape | undefined
        if (!model3d) throw new Error('Could not find the selected 3D model.')
        await edit3DCode(editor, (isEditing) => {
          window.dispatchEvent(
            new CustomEvent('model3d-editing-state-change', {
              detail: { isEditing, elementId: model3d.id },
            })
          )
        })
      } else {
        await vibe3DCode(editor, undefined, thinkingEnabled)
      }
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: 'Something went wrong',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [editor, addToast, is3DModelSelected, isProcessing, thinkingEnabled])

  const label = isProcessing
    ? is3DModelSelected
      ? 'Editing…'
      : 'Creating…'
    : is3DModelSelected
      ? 'Edit 3D'
      : 'Make 3D'

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1.5">
            <Button
              variant="default"
              size="default"
              onClick={handleClick}
              disabled={isProcessing}
              aria-label={label}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CubeIcon
                  gradient={thinkingEnabled && !is3DModelSelected}
                  className={
                    thinkingEnabled && !is3DModelSelected
                      ? 'h-4 w-4'
                      : 'h-4 w-4 text-accent'
                  }
                />
              )}
              {label}
            </Button>
            {!is3DModelSelected && !isProcessing && (
              <Toggle
                variant="outline"
                size="sm"
                pressed={thinkingEnabled}
                onPressedChange={setThinkingEnabled}
                aria-label="Toggle thinking mode (TRELLIS image-to-3D)"
                className="h-9 w-9 px-0"
              >
                <BrainIcon gradient={thinkingEnabled} className="h-4 w-4" />
              </Toggle>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {is3DModelSelected
            ? 'Edit the selected 3D model'
            : thinkingEnabled
              ? 'Generate a 3D mesh from your sketch (TRELLIS)'
              : 'Generate Three.js code from your sketch (Gemini)'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

- [ ] **Step 3: 라인 수 비교 (대략)**

```bash
wc -l /Users/genie/dev/lab/vibe-draw/frontend/app/components/Vibe3DCodeButton.tsx
```

Expected: 원본의 절반 이하 (인라인 스타일 제거 + 아이콘 분리 효과).

- [ ] **Step 4: 시각 + 동작 검증**

`pnpm dev` 띄운 상태에서:
- 우상단에 "Make 3D" 버튼 + 보라/시안 그라데이션 Cube 아이콘 + 별도 brain 토글 버튼 표시
- thinkingMode OFF: Cube 아이콘이 오렌지로 변함, brain 토글 라이트 회색
- 도형 선택 후 클릭 → vibe3DCode 호출, 처리 중에는 spinner + "Creating…"
- 3D model 선택 → 버튼 라벨 "Edit 3D"로 변경, 토글 사라짐
- 클릭 → edit3DCode 호출

- [ ] **Step 5: 커밋**

```bash
git add frontend/app/components/Vibe3DCodeButton.tsx
git commit -m "feat(frontend): migrate Vibe3DCodeButton to shadcn Button + Toggle"
```

---

## Task 10: PreviewShape 인라인 스타일 마이그레이션

**Files:**
- Modify: `frontend/app/PreviewShape/PreviewShape.tsx`

PreviewShape는 Tldraw shape util — Tldraw가 요구하는 DOM 구조와 root element type은 그대로 두고, 내부의 inline `style={{...}}` block들만 Tailwind class로 옮긴다.

- [ ] **Step 1: 현재 파일 읽고 6개 style block 위치 파악**

```bash
grep -n "style={{" /Users/genie/dev/lab/vibe-draw/frontend/app/PreviewShape/PreviewShape.tsx
```

- [ ] **Step 2: 각 style block을 동등한 Tailwind class로 1:1 치환**

치환 가이드:
- `width: '100%', height: '100%'` → `className="h-full w-full"`
- `backgroundColor: '#fff'` → `className="bg-surface"` (또는 흰색이 다른 의미면 `bg-white`)
- `border: '1px solid #e0e0e0'` → `className="border border-border"`
- `borderRadius: '8px'` → `className="rounded"` (8px가 우리 DEFAULT)
- `padding: '12px'` → `className="p-3"` (12px ≈ 3 * 4px)
- `boxShadow: '0 2px 6px rgba(...)'` → `className="shadow-pop"`
- `display: 'flex', alignItems: 'center', justifyContent: 'center'` → `className="flex items-center justify-center"`
- `position: 'absolute', top: 0, right: 0` → `className="absolute right-0 top-0"`
- 다이내믹 값(좌표, 폭 등 props 기반) → `style={{}}` 유지

각 치환마다 `pnpm dev`로 shape 렌더 확인 (Tldraw 캔버스에서 도형 선택, 미리보기 shape 우클릭/이동/삭제).

- [ ] **Step 3: 빌드 + 시각 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend && pnpm tsc --noEmit
```

`pnpm dev`에서 vibe3DCode 호출 → PreviewShape 생성되고 톤 일치 (흰 카드, 둥근 모서리, soft shadow).

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/PreviewShape/PreviewShape.tsx
git commit -m "refactor(frontend): migrate PreviewShape inline styles to Tailwind classes"
```

---

## Task 11: Model3DPreviewShape 인라인 스타일 마이그레이션

**Files:**
- Modify: `frontend/app/PreviewShape/Model3DPreviewShape.tsx`

Task 10과 동일한 패턴. 8개 style block.

- [ ] **Step 1: style block 위치 파악**

```bash
grep -n "style={{" /Users/genie/dev/lab/vibe-draw/frontend/app/PreviewShape/Model3DPreviewShape.tsx
```

- [ ] **Step 2: Task 10의 치환 가이드 그대로 적용**

특히 주의:
- GLTF iframe / canvas 컨테이너의 동적 width/height (props에서 옴)은 `style={{}}` 유지
- 플러스 버튼 등 floating element는 absolute position class 사용
- 편집 상태 표시 overlay는 `bg-surface/80 backdrop-blur-sm` 같은 톤으로 통일

- [ ] **Step 3: 시각 + 동작 검증**

`pnpm dev` → vibe3DCode (thinkingMode OFF) 호출하여 Model3DPreviewShape 생성 → Three.js 코드가 iframe 안에서 렌더, 우상단 + 버튼으로 3D World에 추가, 편집 시 overlay 정상 표시.

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/PreviewShape/Model3DPreviewShape.tsx
git commit -m "refactor(frontend): migrate Model3DPreviewShape inline styles to Tailwind"
```

---

## Task 12: TldrawLogo + globals.css legacy 정리

**Files:**
- Modify: `frontend/app/components/TldrawLogo.tsx`
- Modify: `frontend/app/globals.css`

- [ ] **Step 1: TldrawLogo 인라인 → Tailwind class 1줄 교체**

기존 `style={{...}}` 1개를 `className`으로:

```tsx
// 예: <a href="..." style={{ position: 'fixed', bottom: 16, right: 16, opacity: 0.5 }}>
// after:
<a
  href="..."
  className="fixed bottom-4 right-4 opacity-50 transition-opacity hover:opacity-100"
>
```

(원본의 href/svg children은 그대로.)

- [ ] **Step 2: globals.css에서 더 이상 사용하지 않는 legacy class 제거**

다음 클래스 정의들을 globals.css에서 삭제:
- `.vibe3DCodeButton` — Vibe3DCodeButton이 Tailwind로 갔으니 무의미
- `.improveDrawingButton` — 동일
- `.autoDrawButton` — 동일
- `.your-own-api-key`, `.your-own-api-key__inner`, `.your-own-api-key input`, `.your-own-api-key__mobile`, `.your-own-api-key__mobile input`, `.input__wrapper`, `.input__wrapper:not(:focus-within)::after`, `.input__wrapper::after`, `.your-own-api-key input:focus` — 옛 Anthropic API key 입력란 (호출 경로 없음)
- `.question__button` — 동일하게 dead

유지:
- `* { touch-action: none }`
- `.tlui-help-menu`, `.tlui-debug-panel`
- `.editor`
- `.tldrawLogo`, `.tldrawLogo__mobile` (Task 12 Step 1 후 className으로 갔으면 같이 제거 가능, 그렇지 않으면 유지)

- [ ] **Step 3: 빌드 검증**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend && pnpm tsc --noEmit && pnpm build 2>&1 | tail -20
```

Expected: 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/components/TldrawLogo.tsx frontend/app/globals.css
git commit -m "refactor(frontend): migrate TldrawLogo + drop legacy CSS classes"
```

---

## Task 13: Tldraw 자체 UI 톤 오버라이드 (tldraw.css)

**Files:**
- Modify: `frontend/app/tldraw.css`

Tldraw 자체 UI(좌측 툴바, 우측 스타일 패널, 토스트 등)는 그대로 두지만, 우리 톤과 너무 어긋나는 디테일만 오버라이드.

- [ ] **Step 1: 현재 tldraw.css 확인**

```bash
cat /Users/genie/dev/lab/vibe-draw/frontend/app/tldraw.css | head -50
```

- [ ] **Step 2: 우리 톤으로 미세 오버라이드 추가**

파일 맨 아래에 추가:

```css
/* === vibe-draw tone overrides for Tldraw chrome === */

/* Toast 톤 정렬 — 흰 surface + 우리 border */
.tlui-toast__container {
  background: hsl(var(--vd-surface)) !important;
  border: 1px solid hsl(var(--vd-border)) !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06) !important;
  color: hsl(var(--vd-foreground)) !important;
}

/* 좌측 toolbar / 우측 style panel 컨테이너의 그림자만 살짝 가볍게 */
.tlui-toolbar__inner,
.tlui-style-panel {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06) !important;
}
```

(Tldraw 자체 CSS class 이름은 버전에 따라 다를 수 있음 — Step 3에서 실제 DOM 확인하고 필요 시 셀렉터 조정.)

- [ ] **Step 3: 시각 검증**

`pnpm dev` → Chrome DevTools로 Tldraw 좌측 툴바, 우측 패널, 토스트(빈 selection으로 Improve Drawing 클릭 → 에러 토스트) 톤 확인. 위 셀렉터가 실제 DOM과 안 맞으면 DevTools에서 진짜 class name 확인 후 수정.

- [ ] **Step 4: 커밋**

```bash
git add frontend/app/tldraw.css
git commit -m "style(frontend): align Tldraw chrome (toast, panels) with vd tone"
```

---

## Task 14: 최종 빌드 + 골든패스 검증

**Files:** (수정 없음 — 검증만)

- [ ] **Step 1: 클린 빌드**

```bash
cd /Users/genie/dev/lab/vibe-draw/frontend
rm -rf .next
pnpm build 2>&1 | tail -30
```

Expected: 빌드 성공, type error 0, ESLint warning 허용 가능한 수준.

- [ ] **Step 2: dev 서버 + 골든패스 수동 검증**

```bash
pnpm dev
```

브라우저 `http://localhost:3000`에서 다음 체크리스트 1개씩:

- [ ] 페이지 첫 진입 — TabGroup 상단 중앙, 액션 패널 우상단, 톤 일치 (웜 라이트 배경)
- [ ] 2D Canvas → 3D World 탭 토글 → 캔버스 전환 OK, 활성 탭 muted 배경
- [ ] Tldraw 좌측 툴바 동작 (펜·텍스트·핸드) — 우리 톤 오버라이드와 충돌 없음
- [ ] 펜으로 간단한 스케치 그리기
- [ ] 스케치 선택 → "Improve" 클릭 → spinner → Nano Banana 결과 이미지가 캔버스 오른쪽에 추가됨 (B 단계 검증분 재확인)
- [ ] 스케치 선택 → "Make 3D" thinkingMode OFF 클릭 → vibe3DCode (Gemini) 호출 → Model3DPreviewShape 생성
- [ ] 스케치 선택 → brain 토글 ON → "Make 3D" 클릭 → RunPod TRELLIS 잡 큐잉 → GLB 렌더 (A 단계 검증분 재확인)
- [ ] Model3DPreviewShape 선택 → 버튼 라벨이 "Edit 3D"로 변함 → 클릭 → edit3DCode 호출
- [ ] 모든 버튼 hover 시 그림자 진해지고 border 톤 변함
- [ ] 콘솔 0 에러 / 0 경고

- [ ] **Step 3: 회귀 체크리스트**

- [ ] Tldraw `useToasts` 토스트가 우리 톤으로 표시되거나 최소한 깨지지 않음
- [ ] PreviewShape의 + 버튼 (3D 월드로 추가) 동작 OK
- [ ] Three.js 3D World 탭 진입 후 카메라 컨트롤 (nipplejs 조이스틱, OrbitControls 등) 동작 OK
- [ ] Inter 폰트가 로드되어 모든 텍스트가 같은 폰트로 표시됨

- [ ] **Step 4: 회귀가 있으면 핫픽스 + 커밋 / 없으면 빈 커밋으로 마일스톤 표시**

회귀 발견 시 해당 파일 패치 후:

```bash
git add <fixed-files>
git commit -m "fix(frontend): <발견된 회귀 1줄 요약>"
```

회귀 없으면 별도 커밋 불필요.

- [ ] **Step 5: PR 준비를 위한 변경 요약 — 다음 출력을 사용자에게 그대로 제시**

```bash
cd /Users/genie/dev/lab/vibe-draw
git log --oneline main..HEAD 2>/dev/null || git log --oneline -15
git diff --stat main..HEAD 2>/dev/null || git diff --stat HEAD~14..HEAD
```

이걸 PR description에 그대로 붙이면 됨. 사용자가 PR 만들지 단일 커밋 묶음으로 끝낼지는 별도 의사결정.

---

## Self-Review

스펙(`docs/superpowers/specs/2026-05-16-ui-renewal-design.md`) 대 플랜 커버리지:

| Spec 섹션 | 커버 task |
|---|---|
| 2. Design Decisions (톤, 위계, 스택) | Task 1~4 (스택), Task 6~9 (위계+톤 적용) |
| 3. Design Tokens | Task 2 |
| 4. Layout & Structure | Task 6 (TabGroup), Task 9 (action panel) |
| 5. Component Inventory — shadcn | Task 4 |
| 5. Component Inventory — 자체 | Task 5, 6, 7, 8, 9, 10, 11, 12 |
| 6. File-level Change Plan | 모든 task |
| 7. Migration Approach (순서) | Task 순서 1→14 |
| 8. Risks — preflight | Task 1 (corePlugins.preflight: false) |
| 8. Risks — CSS 변수 prefix | Task 2 (--vd-* 사용) |
| 8. Risks — Toggle ev 간섭 | Task 9 (Radix Toggle가 stopPropagation 자체 처리) |
| 8. Risks — Inter CLS | Task 2 (next/font/google with variable) |
| 8. Risks — Tldraw shape 깨짐 | Task 10, 11 (점진 치환 + 매번 시각 확인) |
| 9. Verification Plan | Task 14 |
| 10. Out of Scope | (의도적으로 plan 밖) |

**Placeholder scan**: Task 8 Step 2의 `await new Promise(...)` placeholder 1곳 — 명시적 NOTE로 "기존 onClick 본문 1:1 복사" 라고 적어둠. 구현 단계에서 반드시 교체 필요.

**Type consistency**: `Model3DPreviewShape` import는 type-only로 변경 (Task 9 코드 `import type { ... }`). `TabType`은 TabGroup.tsx에서 export하고 page.tsx는 store에서 받는 형태 유지. `vibe3DCode` / `edit3DCode` / `improveDrawing` 시그니처는 기존 그대로 호출.

**Naming consistency**: 모든 새 컴포넌트는 PascalCase 파일명, default `export function` 우선. ui/는 shadcn 컨벤션(소문자 파일명) 그대로.
