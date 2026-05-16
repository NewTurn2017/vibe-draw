import { Editor, createShapeId, TLShapeId } from '@tldraw/tldraw'
import { getSelectionAsText } from './getSelectionAsText'
import { blobToBase64 } from './blobToBase64'
import { svgElementToPngBlob } from './svgToPng'
import { Model3DPreviewShape } from '../PreviewShape/Model3DPreviewShape'
import { useObjectStore } from '../store/appStore'

export type TrellisQuality = 'fast' | 'high'

const QUALITY_SETTINGS: Record<TrellisQuality, { resolution: number; texture_size: number }> = {
  fast: { resolution: 512, texture_size: 1024 },
  high: { resolution: 1024, texture_size: 2048 },
}

export async function vibe3DCode(
  editor: Editor,
  shapeId: TLShapeId | null = null,
  thinkingMode: boolean = false,
  quality: TrellisQuality = 'fast'
) {
  // Get the selected shapes (we need at least one)
  const selectedShapes = editor.getSelectedShapes()

  if (selectedShapes.length === 0) throw Error('먼저 3D로 만들 도형을 선택하세요.')

  // Create the preview shape for the 3D model
  if (!shapeId) {
    const { maxX, midY } = editor.getSelectionPageBounds()!
    shapeId = createShapeId()
    editor.createShape<Model3DPreviewShape>({
      id: shapeId,
      type: 'model3d',
      x: maxX + 60, // to the right of the selection
      y: midY - (540 * 2) / 3 / 2, // half the height of the preview's initial shape
      props: { 
        threeJsCode: '', 
        selectedShapes: selectedShapes,
        gltfUrl: '' // Initialize gltfUrl property
      },
    })
  }

  const selectedShapesWithoutModel3d = selectedShapes.filter((shape) => shape.type !== 'model3d')

  // Get an SVG based on the selected shapes
  const svg = await editor.getSvg(selectedShapesWithoutModel3d, {
    scale: 1,
    background: true,
  })

  if (!svg) {
    return
  }

  // Turn the SVG into a DataUrl
  const blob = await svgElementToPngBlob(svg, 1)
  const dataUrl = await blobToBase64(blob)

  // Get the text from the selection
  const selectionText = getSelectionAsText(editor)

  try {
    if (thinkingMode) {
      const response = await fetch('http://localhost:8000/api/trellis/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "Qubico/trellis",
          task_type: "image-to-3d",
          input: {
            image: dataUrl,
            seed: 0,
            // 20 steps = TRELLIS.2 recommended default; ~2x faster than 50
            // with negligible quality loss for sketches.
            ss_sampling_steps: 20,
            slat_sampling_steps: 20,
            ss_guidance_strength: 7.5,
            slat_guidance_strength: 3,
            ...QUALITY_SETTINGS[quality],
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json()
        throw Error(`API 오류: ${errorData.detail || response.statusText}`)
      }

      const jsonResponse = await response.json()
      
      console.log("jsonResponse", jsonResponse)
      
      console.log("jsonResponse.data", jsonResponse.data)

      const taskId = jsonResponse.data.task_id;

      console.log("Task ID:", taskId)

      // wait for websocket to send back the task result
      const gltfUrl = await waitForTaskResult(taskId);

      console.log("GLTF URL received:", gltfUrl)

      // Update the shape with the new props including the gltf URL
      editor.updateShape<Model3DPreviewShape>({
        id: shapeId,
        type: 'model3d',
        props: {
          gltfUrl,
          isGltf: true, // Add flag to indicate this is a GLTF model
        },
      })

      /* 
      // Automatic GLTF loading is now handled by the plus button instead
      try {
        // Since we can't use hooks directly in this file, we'll use a custom event
        window.dispatchEvent(new CustomEvent('add-gltf-object', { 
          detail: { url: gltfUrl, shapeId }
        }));
      } catch (error) {
        console.error("Failed to add GLTF to 3D world:", error);
      }
      */

      return;
    } else {
      // Send the image and text to the backend
      const response = await fetch('http://localhost:8000/api/queue/3d', {
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
      
      // Now wait for the completed code via SSE
      const generatedCodeData = await waitForCodeGeneration(jsonResponse.task_id)
      
      if (generatedCodeData && generatedCodeData.content) {
        // Extract the Three.js code from the response
        const threeJsCode = processThreeJsCode(generatedCodeData.content);

        // Make sure we have code
        if (threeJsCode.length < 100) {
          console.warn(generatedCodeData.content)
          throw Error('이 스케치로는 3D 모델을 만들 수 없었어요.')
        }

        // Update the shape with the new props
        editor.updateShape<Model3DPreviewShape>({
          id: shapeId,
          type: 'model3d',
          props: {
            threeJsCode,
            isGltf: false,
          },
        })

        console.log(`Response received from backend`)
      } else {
        throw Error('코드가 생성되지 않았어요.')
      }
    }
  } catch (e) {
    // If anything went wrong, delete the shape
    editor.deleteShape(shapeId)
    throw e
  }
}

// Function to wait for the code generation to complete via SSE
async function waitForCodeGeneration(taskId: string): Promise<{ content: string } | null> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`http://localhost:8000/api/subscribe/${taskId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        
        if (data.status === 'completed') {
          console.log('Code generation completed:', data);
          if (data.content) {
            resolve({ content: data.content });
          } else {
            resolve(null);
          }
          eventSource.close();
        } else if (data.status === 'failed' || data.status === 'error') {
          console.error('Code generation error:', data.message);
          reject(new Error(data.message || 'Error generating code'));
          eventSource.close();
        } else {
          console.log('Code generation status update:', data.message || data.status);
        }
      } catch (error) {
        console.error('Error parsing event data:', error);
        reject(error);
        eventSource.close();
      }
    };
    
    // Keeping these event listeners for backward compatibility
    eventSource.addEventListener('start', (event) => {
      console.log('Code generation started');
    });
    
    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        console.log('Complete event received:', data);
        
        if (data.content) {
          resolve({ content: data.content });
        } else {
          resolve(null);
        }
        eventSource.close();
      } catch (error) {
        console.error('Error parsing complete event:', error);
        reject(error);
        eventSource.close();
      }
    });
    
    eventSource.addEventListener('error', (event) => {
      console.error('SSE error event received');
      try {
        const data = JSON.parse((event as MessageEvent).data);
        reject(new Error(data.error || 'Error generating code'));
      } catch (e) {
        reject(new Error('Unknown error in code generation'));
      } finally {
        eventSource.close();
      }
    });
    
    // Handle general error case
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      reject(new Error('Error with SSE connection'));
      eventSource.close();
    };
    
    // Set a timeout in case the SSE connection doesn't close properly
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        console.warn('Code generation timed out, closing SSE connection');
        eventSource.close();
        reject(new Error('Code generation timed out'));
      }
    }, 300000); // 5 minute timeout
  });
}

async function waitForTaskResult(taskId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const eventSource = new WebSocket(`http://localhost:8000/api/trellis/task/ws/${taskId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      
      if (data.status === 'completed') {
        console.log('3D model ready:', data.data);
        resolve(data.data);
        eventSource.close();
      } else if (data.status === 'failed' || data.status === 'error') {
        console.error('Error:', data.message);
        reject(new Error(data.message || 'Unknown error occurred'));
        eventSource.close();
      } else {
        console.log('Status update:', data.message);
      }
    };

    eventSource.onerror = (event) => {
      console.error('WebSocket connection error:', event);
      reject(new Error('Error with WebSocket connection'));
      eventSource.close();
    };

    eventSource.onopen = () => {
      console.log('WebSocket connection opened');
    };

    eventSource.onclose = () => {
      console.log('WebSocket connection closed');
    };
    
    // Set a timeout in case the WebSocket connection doesn't close properly.
    // First-call cold start (TRELLIS.2 model download into RunPod cache) can
    // take ~5min; warm calls are <30s.
    setTimeout(() => {
      if (eventSource.readyState !== WebSocket.CLOSED) {
        console.warn('Task timed out, closing WebSocket connection');
        eventSource.close();
        reject(new Error('Task timed out'));
      }
    }, 600000); // 10 minute timeout (covers first-time model download)
  });
}


function processThreeJsCode(code: string): string {
  let processedCode = code;
  
  // Extract code from markdown code blocks if present
  const jsPattern = /```javascript\s*\n([\s\S]*?)```/;
  const jsMatch = processedCode.match(jsPattern);
  
  if (jsMatch && jsMatch[1]) {
    processedCode = jsMatch[1];
  } else {
    // Try to find any code block with or without language specification
    const codePattern = /```(?:\w*\s*)?\n([\s\S]*?)```/;
    const codeMatch = processedCode.match(codePattern);
    if (codeMatch && codeMatch[1]) {
      processedCode = codeMatch[1];
    } else {
      // If no markdown code blocks found, try to find script tags
      const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/;
      const scriptMatch = processedCode.match(scriptPattern);
      if (scriptMatch && scriptMatch[1]) {
        processedCode = scriptMatch[1];
      }
    }
  }
  
  // Process the code to adapt to the non-ES modules environment
  processedCode = processedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+\*\s+as\s+.*?\s+from\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
  processedCode = processedCode.replace(/^const\s+.*?\s*=\s*require\(['"].*?['"]\);?\s*$/gm, '');
  
  processedCode = processedCode.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*OrbitControls\s*}\s+from\s+['"]three\/addons\/controls\/OrbitControls\.js['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+{\s*[^}]*\s*}\s+from\s+['"]three['"];?\s*/g, '');
  processedCode = processedCode.replace(/import\s+THREE\s+from\s+['"]three['"];?\s*/g, '');
  
  processedCode = processedCode.replace(/THREE\.OrbitControls/g, 'OrbitControls');
  
  return processedCode;
}