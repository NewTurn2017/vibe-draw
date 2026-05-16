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
      // Get the selected shapes to track them during improvement
      const selectedShapes = editor.getSelectedShapes()
      if (selectedShapes.length === 0) {
        addToast({
          icon: 'cross-2',
          title: 'Select something first',
          description: 'Please select a shape to improve',
        })
        return
      }

      // Filter out non-drawable shapes if needed
      const drawableShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')

      if (drawableShapes.length === 0) {
        addToast({
          icon: 'cross-2',
          title: 'No drawable shapes',
          description: 'Select shapes that can be improved (not 3D models)',
        })
        return
      }

      setIsProcessing(true)

      // Call actual improve drawing function
      await improveDrawing(editor)
    } catch (e) {
      console.error('Error in improve drawing workflow:', e)
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
