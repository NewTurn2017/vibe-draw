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
            2D 캔버스
          </TabsTrigger>
          <TabsTrigger value="threejs">
            <Box className="h-3.5 w-3.5" />
            3D 월드
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
