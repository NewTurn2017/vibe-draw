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
      ? 'Editing...'
      : 'Creating...'
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
                  className="h-4 w-4"
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
