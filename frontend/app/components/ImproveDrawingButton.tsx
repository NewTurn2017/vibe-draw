'use client'

import { useEditor, useToasts } from '@tldraw/tldraw'
import { useCallback, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
          title: '먼저 선택해 주세요',
          description: '다듬을 도형을 캔버스에서 선택하세요',
        })
        return
      }

      // Filter out non-drawable shapes if needed
      const drawableShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')

      if (drawableShapes.length === 0) {
        addToast({
          icon: 'cross-2',
          title: '다듬을 수 있는 도형이 없어요',
          description: '3D 모델 말고 다듬을 수 있는 도형을 선택해 주세요',
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
        title: '문제가 발생했어요',
        description: (e as Error).message.slice(0, 100),
      })
    } finally {
      setIsProcessing(false)
    }
  }, [editor, addToast, isProcessing])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="default"
          size="default"
          onClick={handleClick}
          disabled={isProcessing}
          aria-label="스케치 다듬기"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-accent" />
          )}
          {isProcessing ? '다듬는 중…' : '다듬기'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>선택한 스케치를 깔끔한 일러스트로 정리</TooltipContent>
    </Tooltip>
  )
}
