'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditor, useToasts, TLShapeId } from '@tldraw/tldraw'
import { vibe3DCode } from '../lib/vibe3DCode'
import { Wand2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function AutoDrawButton() {
  const editor = useEditor()
  const { addToast } = useToasts()
  const [enabled, setEnabled] = useState(false)

  // Toggle auto-drawing feature
  const handleClick = useCallback(() => {
    setEnabled(prev => !prev)
  }, [])

  // Listen for drawing events and auto-generate 3D models after a 3-second pause
  useEffect(() => {
    if (!enabled || !editor) return

    // Create an array to store shape IDs and a ref for the timeout
    const drawingShapes: TLShapeId[] = []
    let timeout: NodeJS.Timeout | null = null

    // Add initial toast notification
    addToast({
      title: '자동 3D 켜짐',
      description: '뭔가 그린 다음 3초 멈추면 자동으로 3D 모델이 생성돼요',
      icon: 'check',
    })

    // Function to generate 3D model when drawing pauses
    const generate3DModel = async () => {
      if (drawingShapes.length === 0) return

      try {
        // Select all the shapes we've tracked
        editor.selectNone()
        drawingShapes.forEach(id => {
          const shape = editor.getShape(id)
          if (shape) {
            editor.select(id)
          }
        })

        // Show a toast while generating
        addToast({
          id: 'generating-3d',
          title: '3D 모델 생성 중',
          description: '그림에서 3D 모델을 만드는 중이에요…',
          icon: 'external-link',
        })

        // Call the vibe3DCode function
        try {
          await vibe3DCode(editor)
        } catch (e) {
          console.error(e)
          addToast({
            icon: 'cross-2',
            title: '문제가 발생했어요',
            description: (e as Error).message.slice(0, 100),
          })
        }

        // Success toast
        addToast({
          title: '완성!',
          description: '3D 모델이 생성됐어요',
          icon: 'check',
        })

        // Clear the tracked shapes
        drawingShapes.length = 0
      } catch (error: any) {
        console.error('Error generating 3D model:', error)

        // Error toast
        addToast({
          title: '오류',
          description: error.message || '3D 모델 생성에 실패했어요',
          icon: 'cross-2',
        })
      }
    }

    // Listen for drawing events
    const handleChangeEvent = (change: any) => {
      // Handle shape updates
      if (change.changes?.updated) {
        for (const entry of Object.values(change.changes.updated)) {
          const [from, to] = Array.isArray(entry) ? entry : [null, null]

          if (
            from &&
            to &&
            'typeName' in from &&
            'typeName' in to &&
            from.typeName === 'shape' &&
            to.typeName === 'shape' &&
            'type' in to &&
            to.type === 'draw' &&
            'id' in to
          ) {
            // Track the shape ID
            const shapeId = to.id as TLShapeId
            if (!drawingShapes.includes(shapeId)) {
              drawingShapes.push(shapeId)
            }

            // Reset the timeout
            if (timeout) {
              clearTimeout(timeout)
            }

            // Set a new timeout
            timeout = setTimeout(generate3DModel, 3000)
          }
        }
      }

      // Handle new shapes
      if (change.changes?.added) {
        for (const record of Object.values(change.changes.added)) {
          if (
            record &&
            typeof record === 'object' &&
            'typeName' in record &&
            record.typeName === 'shape' &&
            'type' in record &&
            record.type === 'draw' &&
            'id' in record
          ) {
            // Track the shape ID
            const shapeId = record.id as TLShapeId
            if (!drawingShapes.includes(shapeId)) {
              drawingShapes.push(shapeId)
            }

            // Reset the timeout
            if (timeout) {
              clearTimeout(timeout)
            }

            // Set a new timeout
            timeout = setTimeout(generate3DModel, 3000)
          }
        }
      }

      // Handle removed shapes (erased or deleted)
      if (change.changes?.removed) {
        let removedShapes = false

        for (const record of Object.values(change.changes.removed)) {
          if (
            record &&
            typeof record === 'object' &&
            'typeName' in record &&
            record.typeName === 'shape' &&
            'id' in record
          ) {
            const shapeId = record.id as TLShapeId
            const index = drawingShapes.indexOf(shapeId)

            if (index !== -1) {
              // Remove the shape ID from our tracking array
              drawingShapes.splice(index, 1)
              removedShapes = true
            }
          }
        }

        // If shapes were removed and we still have some left, reset the timeout
        if (removedShapes && drawingShapes.length > 0) {
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(generate3DModel, 3000)
        }
      }

      // Check for potentially removed shapes (like after undo)
      const stillExists = drawingShapes.filter(id => !!editor.getShape(id))

      // If we lost some shapes, update our tracking array
      if (stillExists.length !== drawingShapes.length) {
        // Replace the array contents with only shapes that still exist
        drawingShapes.length = 0
        stillExists.forEach(id => drawingShapes.push(id))

        // Reset the timeout if we still have shapes
        if (drawingShapes.length > 0) {
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(generate3DModel, 3000)
        }
      }
    }

    // Register the event listener
    const cleanup = editor.store.listen(handleChangeEvent, { source: 'user', scope: 'all' })

    // Return cleanup function
    return () => {
      cleanup()
      if (timeout) {
        clearTimeout(timeout)
      }

      addToast({
        title: '자동 3D 꺼짐',
        description: '자동 3D 모델 생성이 꺼졌어요',
        icon: 'cross-2',
      })
    }
  }, [enabled, editor, addToast])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="default"
          onClick={handleClick}
          aria-label="자동 3D 생성"
        >
          {enabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4 text-accent" />
          )}
          자동 3D {enabled ? '(켜짐)' : '(꺼짐)'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>그림을 멈추면 자동으로 3D 모델 생성</TooltipContent>
    </Tooltip>
  )
}
