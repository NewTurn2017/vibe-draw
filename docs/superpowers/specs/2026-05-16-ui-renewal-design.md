# vibe-draw UI Renewal — Design Spec

**작성일**: 2026-05-16
**Scope**: `frontend/` 전체 DOM UI (Tldraw 캔버스 + Three.js 캔버스 외곽의 모든 React DOM 컴포넌트)
**상태**: 브레인스토밍 합의 완료, 구현 직전

## 1. Goal

현재 `frontend/`의 DOM UI는 모든 스타일이 인라인이고 (8 파일 × ~34 style block), 색·모서리·아이콘 사이즈에 일관성이 없어 "라이브러리 불일치 + 20년 전 디자인" 인상을 준다. 이를 **디자인 토큰 + 컴포넌트 라이브러리** 기반의 현대적·세련된 UI로 전환한다.

### Non-goals

- **기능 변경 X**: 버튼 동작, 흐름, 캔버스 인터랙션은 모두 그대로.
- **Three.js 3D 씬 내부 렌더링은 손대지 않음**: `components/three/*.tsx`는 Three.js primitive(Mesh, Material 등)라 DOM 스타일 없음. 본 spec 대상 외.
- **Tldraw 캔버스 내부 UI 손대지 않음**: 좌측 툴바, 우측 스타일 패널 등은 Tldraw가 자체 관리. 우리 코드(SharePanel 슬롯에 넣은 액션 버튼)만 다룬다.
- **새 기능 추가 X**: 키보드 단축키, 다크 모드 토글, 설정 패널 등 신규 기능은 본 spec 밖.

## 2. Design Decisions (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 디자인 톤 | **Notion · Soft Modern** (웜 라이트 베이스 + 오렌지 액센트, 둥근 모서리, soft shadow, friendly typography) |
| 버튼 위계 | **동등한 위계** — Make 3D / Improve Drawing / Auto Draw 셋 다 같은 흰 카드 버튼. 오렌지 액센트는 hover, 탭 active, 로딩, brain-thinking 그라데이션 등 보조 자리로만. |
| 기술 스택 | **Tailwind CSS v3 + shadcn/ui** — 디자인 토큰을 `tailwind.config.ts`에 박고, 필요한 컴포넌트만 `npx shadcn add`로 가져옴. lucide-react는 이미 deps. |

## 3. Design Tokens

`tailwind.config.ts`의 `theme.extend`에 박는다. `globals.css`에 `:root` CSS 변수로도 미러링 (shadcn 컨벤션).

```ts
colors: {
  // 베이스
  background: '#f7f5f1',        // 캔버스 외곽 배경 (웜 라이트)
  surface:    '#ffffff',        // 카드/버튼 표면
  border:     '#e8e4dc',        // hairline border
  muted:      '#ede9e1',        // 보조 표면 (탭 active 배경)
  // 텍스트
  foreground: '#2b2a26',        // primary text
  subtle:     '#6b6760',        // secondary text
  faint:      '#8c887e',        // tertiary / placeholder
  // 액센트 (오렌지)
  accent:     { DEFAULT: '#ff7038', light: '#ff8a5b', dark: '#e85a20' },
  // 시멘틱
  danger:     '#dc2626',
  success:    '#16a34a',
},
borderRadius: { sm: '6px', DEFAULT: '8px', lg: '10px', xl: '14px' },
boxShadow: {
  card: '0 1px 2px rgba(0,0,0,0.04)',
  pop:  '0 2px 6px rgba(0,0,0,0.06)',
  hover:'0 4px 14px rgba(0,0,0,0.08)',
  accent:'0 2px 6px rgba(255,120,75,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
},
fontFamily: {
  sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
},
```

**Brain-thinking 그라데이션** (Vibe3DCodeButton의 thinkingMode ON 상태에서 brain 아이콘에 적용): `linear-gradient(135deg, #ff80ff, #80ffff)` — 현재 코드에 이미 있는 시그니처 컬러, 그대로 유지.

## 4. Layout & Structure (변경 없음)

| 영역 | 위치 | 현재 → 변경 후 |
|---|---|---|
| Tab Switcher (2D Canvas / 3D World) | top center fixed | 흰 카드 컨테이너 + 활성 탭 muted 배경 + 아이콘(lucide `Square` / `Box`) + 라벨 |
| Action Panel (3개 버튼) | top right (Tldraw `SharePanel` 슬롯) | 흰 카드 버튼 3개 가로 배치, gap 8px |
| Tldraw 캔버스 | 전체 영역 | 손대지 않음 |
| Three.js 3D World 캔버스 | 전체 영역 (탭 전환 시) | 손대지 않음 |
| Tldraw Logo | bottom left | 자리/기능 유지, opacity·spacing 조정 정도 |
| TestAddCodeButton | 우하단 fixed | **본 spec에서 손대지 않음** — 버튼 JSX가 통째 주석 처리됐고 toast div도 호출 경로 없음(dead code). UI 리뉴얼 scope 밖. 별도 cleanup 작업으로 분리. |

## 5. Component Inventory

### shadcn 컴포넌트 (가져오기)

- `Button` — 액션 패널 3개 버튼의 베이스 (variant: `outline`)
- `Toggle` — Vibe3DCodeButton 내부 brain-thinking 토글
- `Tabs` — 2D Canvas / 3D World 탭 (또는 자체 Pill 컴포넌트 — Tabs가 무거우면 자체로)
- `Tooltip` — 모든 액션 버튼 hover hint
- `Toast` — Tldraw의 `useToasts`를 계속 쓰므로 shadcn Toast는 생략 (Tldraw 토스트 톤만 globals.css에서 오버라이드)

### 자체 컴포넌트 (`frontend/app/components/ui/`)

shadcn 외 우리 도메인 컴포넌트는 **시각만 갈아끼우고 컴포넌트 경계는 유지**:

- `Vibe3DCodeButton.tsx` — shadcn Button + Toggle 사용. brain 그라데이션 SVG는 그대로.
- `ImproveDrawingButton.tsx` — shadcn Button + lucide `Sparkles`.
- `AutoDrawButton.tsx` — shadcn Button + lucide `Wand2`.
- `TabGroup` (page.tsx 안의 inline 컴포넌트) — 별도 파일 `components/TabGroup.tsx`로 추출 + shadcn 토큰 적용.
- `TldrawLogo.tsx` — 그대로, opacity·hover만 토큰화.
- `TestAddCodeButton.tsx` — shadcn Button로 단순화.
- `PreviewShape/PreviewShape.tsx`, `PreviewShape/Model3DPreviewShape.tsx` — 인라인 스타일 → Tailwind class. 단, Tldraw의 ShapeUtil이 요구하는 DOM 구조는 그대로.

## 6. File-level Change Plan

### 신규

- `frontend/tailwind.config.ts` — 디자인 토큰
- `frontend/postcss.config.js` — Tailwind 파이프
- `frontend/components.json` — shadcn config (path: `app/components/ui`)
- `frontend/app/components/ui/button.tsx` — `npx shadcn add button`
- `frontend/app/components/ui/toggle.tsx` — `npx shadcn add toggle`
- `frontend/app/components/ui/tooltip.tsx` — `npx shadcn add tooltip`
- `frontend/app/components/ui/tabs.tsx` — `npx shadcn add tabs` (또는 자체 Pill로 대체)
- `frontend/app/components/TabGroup.tsx` — 추출 + 리스타일
- `frontend/lib/utils.ts` — shadcn의 `cn()` helper (clsx + tailwind-merge)

### 수정

- `frontend/app/globals.css` — Tailwind directives + `:root` CSS 변수 (디자인 토큰 미러)
- `frontend/app/layout.tsx` — Inter 폰트 next/font 로딩
- `frontend/app/page.tsx` — TabGroup 분리, SharePanel children 단순화
- `frontend/app/components/Vibe3DCodeButton.tsx` — 인라인 → Button + Toggle + Tooltip
- `frontend/app/components/ImproveDrawingButton.tsx` — 인라인 → Button + lucide
- `frontend/app/components/AutoDrawButton.tsx` — 인라인 → Button + lucide
- `frontend/app/components/TldrawLogo.tsx` — Tailwind class
- `frontend/app/PreviewShape/PreviewShape.tsx` — 인라인 → Tailwind class
- `frontend/app/PreviewShape/Model3DPreviewShape.tsx` — 인라인 → Tailwind class
- `frontend/app/tldraw.css` — Tldraw 토스트/패널 톤 오버라이드 (필요한 만큼만)
- `frontend/next.config.js` — 변경 없음 추정
- `frontend/tsconfig.json` — `paths` alias 확인 (shadcn `@/`)
- `frontend/package.json` — `tailwindcss`, `postcss`, `autoprefixer`, `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-toggle`, `@radix-ui/react-tooltip` 추가

### 삭제

- 인라인 style block 전수 제거 (~34 곳). 비주얼 동작은 모두 Tailwind class로 옮긴다.

## 7. Migration Approach

**단일 PR / big-bang**. 이유:
- 변경 면이 좁다 (frontend 8 파일).
- Tailwind 도입은 점진 전환이 의미 없음 (한 번에 켜야 함).
- lab 프로젝트라 production 부담 0.

순서:
1. Tailwind/postcss 셋업 + globals.css에 토큰 박기 + dev 서버에서 기존 화면 깨지지 않는지 확인.
2. shadcn init + 4개 컴포넌트(`button`, `toggle`, `tooltip`, `tabs`) 추가.
3. TabGroup 추출 + 새 톤 적용.
4. 액션 버튼 3개 한 번에 마이그레이션.
5. PreviewShape 2개 마이그레이션.
6. TldrawLogo / TestAddCodeButton 정리.
7. tldraw.css 톤 미세 조정.
8. 브라우저 수동 검증 (golden path: 스케치→Make 3D, Improve Drawing, 탭 전환, hover/active 상태).

## 8. Risks & Mitigations

| 리스크 | 대응 |
|---|---|
| **Tailwind preflight × Tldraw CSS 충돌** — Tldraw가 `button`, `input` 등의 기본 스타일을 가정하고 동작 | `tailwind.config.ts`의 `corePlugins.preflight: false` 또는 `important: '.app-root'`로 스코프 한정. 1차 시도 후 깨지면 fallback. |
| **CSS 변수 충돌** — Tldraw도 `--tl-*` prefix CSS 변수 사용 | 우리는 `--vd-*` prefix로 격리. 토큰 이름 충돌 0. |
| **shadcn Toggle가 Tldraw 이벤트와 간섭** | brain 토글은 `e.stopPropagation()` 이미 적용 중. 그대로 유지. |
| **Inter 폰트 로딩 지연 → CLS** | `next/font/google`로 self-host, `display: 'swap'` 명시. |
| **PreviewShape 인라인 스타일 → Tailwind 전환 시 Tldraw shape 렌더 깨짐** | 컨테이너 div 1개씩 점진 교체, 매번 브라우저에서 shape 생성·이동·삭제 확인. |

## 9. Verification Plan

빌드/타입 검증 + 수동 브라우저 검증의 결합. 본 프로젝트에 jest/playwright 셋업이 없으므로 자동 테스트는 신설하지 않는다.

1. `pnpm build` — TS/타입/빌드 클린.
2. `pnpm dev` — 콘솔 0 에러.
3. **수동 골든 패스** (Chrome DevTools MCP로 가능하면 자동화):
   - 페이지 첫 진입 → TabGroup, 액션 패널 톤 일치 확인 (screenshot).
   - 스케치 그리기 → Make 3D thinkingMode ON 클릭 → RunPod TRELLIS 잡 큐잉 → GLB 렌더 (B 단계 인프라 검증분과 결합).
   - Improve Drawing 클릭 → Nano Banana 결과 이미지가 Tldraw 캔버스에 추가됨.
   - 2D ↔ 3D 탭 토글 → 캔버스 전환 OK.
   - 모든 버튼 hover/active 상태가 토큰 컬러로 나옴.
4. **회귀 체크리스트**:
   - Tldraw 좌측 툴바 (펜·텍스트·핸드 등) 동작 ✓
   - 우측 스타일 패널 동작 ✓
   - Three.js 3D World 탭 진입 후 카메라/조이스틱 동작 ✓
   - PreviewShape 우측 상단 + 버튼 (3D 월드로 추가) 동작 ✓

## 10. Out of Scope (다음 작업으로)

- 다크 모드 (시스템/수동 토글)
- 키보드 단축키 오버레이
- 설정 패널 (RunPod / Replicate / 모델 슬러그 인-앱 편집)
- 사용자 작품 갤러리 / 저장 / 공유
- 모바일 반응형 (현재는 desktop 1280+ 가정)
- 다국어 i18n
- e2e 테스트 자동화 (Playwright)

---

**다음 단계**: 이 spec을 사용자가 검토 → 합의 → `writing-plans` 스킬로 구현 플랜 작성 → 구현.
