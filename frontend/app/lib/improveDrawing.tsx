import { Editor, createShapeId, TLImageShape, AssetRecordType } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { blobToBase64 } from './blobToBase64'
import { svgElementToPngBlob } from './svgToPng'

export async function improveDrawing(editor: Editor) {
  // Get the selected shapes (we need at least one)
  const selectedShapes = editor.getSelectedShapes()
  if (selectedShapes.length === 0) throw Error('먼저 다듬을 도형을 선택하세요.')

  // Filter out non-drawable shapes if needed
  const drawableShapes = selectedShapes.filter((shape) => shape.type !== 'model3d')

  if (drawableShapes.length === 0) throw Error('다듬을 수 있는 도형이 없어요.')

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(drawableShapes, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    throw Error('선택한 도형에서 SVG를 만들 수 없었어요.')
  }

  // Turn the SVG into a DataUrl
  const blob = await svgElementToPngBlob(svg, 1)
  const dataUrl = await blobToBase64(blob)

  // Get any text from the selection
  const selectionText = getSelectionAsText(editor)

  try {
    // Send the image and text to the backend
    const response = await fetch('http://localhost:8000/api/queue/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: selectionText,
        image_base64: dataUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw Error(`API 오류: ${errorData.detail || response.statusText}`)
    }

    // Get the response with task ID
    const jsonResponse = await response.json()
    
    // Now wait for the completed image via SSE
    const generatedImageData = await waitForImageGeneration(jsonResponse.task_id)
    
    // If we have an image, create a new TLDraw image shape
    if (generatedImageData) {
      // Get the selection bounds - handle the case when it's null
      const selectionBounds = editor.getSelectionPageBounds()
      
      if (!selectionBounds) {
        throw Error('선택 영역을 계산할 수 없었어요.')
      }
      
      const { maxX, maxY } = selectionBounds
      const newShapeId = createShapeId()
      
      // Create an asset first
      const assetId = AssetRecordType.createId()
      
      // Use the dimensions from the generated image
      const imageWidth = generatedImageData.width
      const imageHeight = generatedImageData.height
      
      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'improved-drawing.png',
            src: `data:image/png;base64,${generatedImageData.image}`,
            w: imageWidth,
            h: imageHeight,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {},
        },
      ])
      
      // Create a new Image element in TLDraw that references the asset
      editor.createShape<TLImageShape>({
        id: newShapeId,
        type: 'image',
        x: maxX + 60, // Place to the right of selection
        y: maxY - 300, // Adjust as needed
        props: {
          assetId: assetId,
          w: imageWidth,
          h: imageHeight,
        },
      })
      
      // Select the new image
      editor.select(newShapeId)
      
      return newShapeId
    } else {
      throw Error('이미지가 생성되지 않았어요.')
    }
  } catch (e) {
    console.error('Error in improveDrawing:', e)
    throw e
  }
}

// Function to wait for the image generation to complete via SSE
async function waitForImageGeneration(taskId: string): Promise<{ image: string, width: number, height: number } | null> {
  return new Promise((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null;
    
    try {
      const eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`)
      
      // Set a timeout in case the SSE connection doesn't close properly
      timeout = setTimeout(() => {
        console.warn('Image generation timed out, closing SSE connection')
        eventSource.close()
        reject(new Error('Image generation timed out'))
      }, 120000) // 2 minute timeout
      
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        eventSource.close()
      }
      
      eventSource.addEventListener('start', (event) => {
        console.log('Image generation started')
      })
      
      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          console.log('Complete event received:', data)
          
          if (data.images && data.images.length > 0) {
            // Return the first generated image with its dimensions
            const imageData = data.images[0]
            resolve({
              image: imageData.image_base64,
              width: imageData.width || 500, // Default width if not provided
              height: imageData.height || 500 // Default height if not provided
            })
          } else {
            // If there's content but no images, log it
            if (data.content) {
              console.log('Response content:', data.content)
            }
            resolve(null)
          }
        } catch (error) {
          console.error('Error parsing complete event:', error)
          reject(error)
        } finally {
          cleanup()
        }
      })
      
      eventSource.addEventListener('error', (event) => {
        console.error('SSE error event received')
        try {
          const data = JSON.parse((event as MessageEvent).data)
          reject(new Error(data.error || 'Error generating image'))
        } catch (e) {
          reject(new Error('Unknown error in image generation'))
        } finally {
          cleanup()
        }
      })
      
      // Handle general error case
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        reject(new Error('Error with SSE connection'))
        cleanup()
      }
    } catch (err) {
      console.error('Error setting up SSE connection:', err)
      if (timeout) clearTimeout(timeout)
      reject(err)
    }
  })
} 