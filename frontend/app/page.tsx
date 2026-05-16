'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import './tldraw.css'
import { Vibe3DCodeButton } from './components/Vibe3DCodeButton'
import { AutoDrawButton } from './components/AutoDrawButton'
import { ImproveDrawingButton } from './components/ImproveDrawingButton'
import { PreviewShapeUtil } from './PreviewShape/PreviewShape'
import { Model3DPreviewShapeUtil } from './PreviewShape/Model3DPreviewShape'
import { TabGroup } from './components/TabGroup'
import { TldrawLogo } from './components/TldrawLogo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTabStore } from './store/appStore'
import TestAddCodeButton from './components/TestAddCodeButton'

const ThreeJSCanvas = dynamic(() => import('./components/three/canvas'), { ssr: false })
const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, { ssr: false })

const shapeUtils = [PreviewShapeUtil, Model3DPreviewShapeUtil]

export default function App() {
  const { activeTab, setActiveTab } = useTabStore()

  // Force tldraw's built-in UI (toolbar, menus, style panel) to Korean.
  // tldraw 2.4 supports locale="ko-kr" via user preferences (persisted to
  // localStorage), so this only needs to run once per browser.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { getUserPreferences, setUserPreferences } = await import('@tldraw/tldraw')
      if (cancelled) return
      const current = getUserPreferences()
      if (current.locale !== 'ko-kr') {
        setUserPreferences({ ...current, locale: 'ko-kr' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
                <TooltipProvider delayDuration={300}>
                  <div className="pointer-events-auto flex items-center gap-2 p-3">
                    <ImproveDrawingButton />
                    <AutoDrawButton />
                    <Vibe3DCodeButton />
                  </div>
                </TooltipProvider>
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
