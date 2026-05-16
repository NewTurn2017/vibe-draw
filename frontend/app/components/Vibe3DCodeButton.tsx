'use client'

import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CubeIcon, BrainIcon } from './icons'
import { vibe3DCode, type TrellisQuality } from '../lib/vibe3DCode'
import { edit3DCode } from '../lib/edit3DCode'
import type { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'

export function Vibe3DCodeButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [is3DModelSelected, setIs3DModelSelected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [highQuality, setHighQuality] = useState(false)

  // Update state whenever selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selectedShapes = editor.getSelectedShapes()
      const has3DModel = selectedShapes.some((shape) => shape.type === 'model3d')
      setIs3DModelSelected(has3DModel)
    }

    // Check initially
    handleSelectionChange()

    // Subscribe to selection changes
    editor.addListener('change', handleSelectionChange)

    // Cleanup
    return () => {
      editor.removeListener('change', handleSelectionChange)
    }
  }, [editor])

  const handleClick = useCallback(async () => {
    if (isProcessing) return // Prevent multiple clicks

    try {
      setIsProcessing(true)

      if (is3DModelSelected) {
        // First get the 3D model shape
        const selectedShapes = editor.getSelectedShapes()
        const model3dShape = selectedShapes.find(
          (shape) => shape.type === 'model3d'
        ) as Model3DPreviewShape | undefined

        if (!model3dShape) {
          throw Error('Could not find the selected 3D model.')
        }

        // Use edit3DCode with loading state via custom event
        await edit3DCode(editor, (isEditing) => {
          const elementId = model3dShape.id

          // Dispatch a custom event to communicate with the component
          const event = new CustomEvent('model3d-editing-state-change', {
            detail: { isEditing, elementId },
          })
          window.dispatchEvent(event)
        })
      } else {
        // Otherwise, use vibe3DCode to create a new 3D model
        const quality: TrellisQuality = highQuality ? 'high' : 'fast'
        await vibe3DCode(editor, undefined, thinkingEnabled, quality)
      }
    } catch (e) {
      console.error(e)
      addToast({
        icon: 'cross-2',
        title: '문제가 발생했어요',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [editor, addToast, is3DModelSelected, isProcessing, thinkingEnabled, highQuality])

  const label = isProcessing
    ? is3DModelSelected
      ? '편집 중…'
      : '만드는 중…'
    : is3DModelSelected
      ? '3D 편집'
      : '3D 만들기'

  return (
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
                className="h-4 w-4"
              />
            )}
            {label}
          </Button>
          {!is3DModelSelected && !isProcessing && (
            <>
              <Toggle
                variant="outline"
                size="sm"
                pressed={thinkingEnabled}
                onPressedChange={setThinkingEnabled}
                aria-label="고품질 모드 전환 (TRELLIS 이미지-3D)"
                className="h-9 w-9 px-0"
              >
                <BrainIcon gradient={thinkingEnabled} className="h-4 w-4" />
              </Toggle>
              {thinkingEnabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      variant="outline"
                      size="sm"
                      pressed={highQuality}
                      onPressedChange={setHighQuality}
                      aria-label="고화질 전환 (1024 vs 512)"
                      className="h-9 w-9 px-0"
                    >
                      <Sparkles
                        className={
                          highQuality
                            ? 'h-4 w-4 text-accent'
                            : 'h-4 w-4 text-muted-foreground'
                        }
                      />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>
                    {highQuality
                      ? '고화질 (1024³, 느림)'
                      : '빠른 화질 (512³, 권장)'}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {is3DModelSelected
          ? '선택한 3D 모델 편집'
          : thinkingEnabled
            ? `스케치에서 3D 메시 생성 (TRELLIS · ${highQuality ? '고화질' : '빠름'})`
            : '스케치에서 Three.js 코드 생성 (Gemini)'}
      </TooltipContent>
    </Tooltip>
  )
}
