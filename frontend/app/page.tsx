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
