import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TabKey = 'generate' | 'viewer'

type PolygonStructure = {
  type: 'Polygon'
  coordinates: number[][][]
}

type ApiPayload = {
  footprint?: PolygonStructure
  geometry?: PolygonStructure
  lotFootprint?: PolygonStructure
  type?: string
  coordinates?: unknown
}

declare global {
  interface Window {
    THREE?: unknown
  }
}

type Vector3Like = {
  x: number
  y: number
  z: number
  copy: (vector: Vector3Like) => Vector3Like
  project: (camera: unknown) => Vector3Like
}

type ThreeRuntime = {
  Scene: new () => {
    background: unknown
    add: (...objects: unknown[]) => void
  }
  Color: new (color: string) => unknown
  PerspectiveCamera: new (
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) => {
    aspect: number
    position: { set: (x: number, y: number, z: number) => void }
    lookAt: (x: number, y: number, z: number) => void
    updateProjectionMatrix: () => void
  }
  WebGLRenderer: new (opts: { antialias: boolean }) => {
    domElement: HTMLCanvasElement
    setPixelRatio: (ratio: number) => void
    setSize: (w: number, h: number) => void
    render: (scene: unknown, camera: unknown) => void
    dispose: () => void
  }
  AmbientLight: new (color: number, intensity: number) => unknown
  DirectionalLight: new (color: number, intensity: number) => {
    position: { set: (x: number, y: number, z: number) => void }
  }
  Vector2: new (x: number, y: number) => unknown
  Shape: new (points: unknown[]) => unknown
  ExtrudeGeometry: new (
    shape: unknown,
    opts: { depth: number; bevelEnabled: boolean },
  ) => { center: () => void; dispose: () => void }
  MeshStandardMaterial: new (opts: {
    color: string
    metalness: number
    roughness: number
  }) => { dispose: () => void }
  Mesh: new (
    geometry: { center: () => void; dispose: () => void },
    material: { dispose: () => void },
  ) => unknown
  LineBasicMaterial: new (opts: { color: number }) => { dispose: () => void }
  Vector3: new (x?: number, y?: number, z?: number) => Vector3Like
  BufferGeometry: new () => {
    setFromPoints: (points: unknown[]) => { center: () => void }
  }
  Line: new (
    geometry: { center: () => void },
    material: { dispose: () => void },
  ) => unknown
  Box3: new () => {
    setFromObject: (object: unknown) => {
      getSize: (target: Vector3Like) => Vector3Like
    }
  }
}

const defaultApiJson = JSON.stringify(
  {
    lotFootprint: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [28, 0],
          [30, 12],
          [18, 22],
          [0, 18],
          [0, 0],
        ],
      ],
    },
  },
  null,
  2,
)

function isFiniteCoordinate(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  )
}

function normalizePolygon(input: unknown): PolygonStructure | null {
  if (!input || typeof input !== 'object') return null

  const candidate = input as ApiPayload
  const polygonCandidate =
    candidate.type === 'Polygon'
      ? candidate
      : candidate.footprint ?? candidate.geometry ?? candidate.lotFootprint

  if (!polygonCandidate || polygonCandidate.type !== 'Polygon') return null

  if (!Array.isArray(polygonCandidate.coordinates) || polygonCandidate.coordinates.length === 0) {
    return null
  }

  const shell = polygonCandidate.coordinates[0]
  if (!Array.isArray(shell) || shell.length < 4) return null

  const cleanedRing = shell.filter(isFiniteCoordinate).map(([x, y]) => [x, y])
  if (cleanedRing.length < 4) return null

  const [startX, startY] = cleanedRing[0]
  const [endX, endY] = cleanedRing[cleanedRing.length - 1]
  if (startX !== endX || startY !== endY) {
    cleanedRing.push([startX, startY])
  }

  return {
    type: 'Polygon',
    coordinates: [cleanedRing],
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('generate')
  const [rawApiInput, setRawApiInput] = useState(defaultApiJson)
  const [polygon, setPolygon] = useState<PolygonStructure | null>(null)
  const [status, setStatus] = useState('Extract the lot footprint polygon from the API payload.')

  const mountRef = useRef<HTMLDivElement | null>(null)
  const labelLayerRef = useRef<HTMLDivElement | null>(null)

  const polygonRing = useMemo(() => polygon?.coordinates[0] ?? null, [polygon])

  const extractPolygonFromApi = () => {
    try {
      const parsed = JSON.parse(rawApiInput)
      const extractedPolygon = normalizePolygon(parsed)

      if (!extractedPolygon) {
        setStatus('Could not find a valid Polygon in the payload. Keep the footprint as a polygon object.')
        return
      }

      setPolygon(extractedPolygon)
      setStatus('Polygon extracted successfully. Open the 3D Lot Footprint Viewer tab to inspect it.')
    } catch {
      setStatus('Invalid JSON. Please provide a valid API response payload.')
    }
  }

  useEffect(() => {
    if (activeTab !== 'viewer') return

    const mount = mountRef.current
    const labelLayer = labelLayerRef.current
    const THREE = window.THREE as ThreeRuntime | undefined

    if (!mount || !labelLayer || !THREE) {
      return
    }

    if (!polygonRing) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1020')

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000,
    )

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.innerHTML = ''
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1)
    keyLight.position.set(2, 3, 3)
    scene.add(keyLight)

    const ringPoints2D = polygonRing.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))
    const shape = new THREE.Shape(ringPoints2D)
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 8,
      bevelEnabled: false,
    })
    geometry.center()

    const material = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      metalness: 0.1,
      roughness: 0.45,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xfacc15 })
    const edgeLabels: Array<{ element: HTMLDivElement; midpoint: Vector3Like; text: string }> = []

    for (let i = 0; i < polygonRing.length - 1; i += 1) {
      const [x1, y1] = polygonRing[i]
      const [x2, y2] = polygonRing[i + 1]
      const p1 = new THREE.Vector3(x1, y1, 8)
      const p2 = new THREE.Vector3(x2, y2, 8)

      const edgeGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
      edgeGeometry.center()
      const edgeLine = new THREE.Line(edgeGeometry, lineMaterial)
      scene.add(edgeLine)

      const midpoint = new THREE.Vector3(
        (p1.x + p2.x) / 2,
        (p1.y + p2.y) / 2,
        (p1.z + p2.z) / 2,
      )

      const label = document.createElement('div')
      label.className = 'edge-label'
      const length = Math.hypot(x2 - x1, y2 - y1)
      label.textContent = `${length.toFixed(2)}m`
      labelLayer.appendChild(label)

      edgeLabels.push({ element: label, midpoint, text: label.textContent })
    }

    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    let theta = Math.PI / 5
    let phi = Math.PI / 3
    const radius = Math.max(45, maxDim * 2.4)

    const updateCameraPosition = () => {
      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)
      camera.position.set(x, y, z)
      camera.lookAt(0, 0, 0)
    }

    updateCameraPosition()

    let isDragging = false
    let lastX = 0
    let lastY = 0

    const onMouseDown = (event: MouseEvent) => {
      isDragging = true
      lastX = event.clientX
      lastY = event.clientY
    }

    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging) return
      const deltaX = event.clientX - lastX
      const deltaY = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY

      theta -= deltaX * 0.01
      phi = Math.min(Math.PI - 0.2, Math.max(0.2, phi + deltaY * 0.01))
      updateCameraPosition()
    }

    const onMouseUp = () => {
      isDragging = false
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    const onResize = () => {
      const container = mountRef.current
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    window.addEventListener('resize', onResize)

    let animationId = 0
    const projected = new THREE.Vector3()

    const animate = () => {
      animationId = window.requestAnimationFrame(animate)
      renderer.render(scene, camera)

      edgeLabels.forEach(({ element, midpoint, text }) => {
        projected.copy(midpoint).project(camera)
        const hidden = projected.z > 1

        if (hidden) {
          element.style.display = 'none'
          return
        }

        const x = (projected.x * 0.5 + 0.5) * renderer.domElement.clientWidth
        const y = (-projected.y * 0.5 + 0.5) * renderer.domElement.clientHeight

        element.style.display = 'block'
        element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
        element.textContent = text
      })
    }

    animate()

    return () => {
      window.cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      edgeLabels.forEach(({ element }) => element.remove())
      geometry.dispose()
      material.dispose()
      lineMaterial.dispose()
      renderer.dispose()
      mount.innerHTML = ''
    }
  }, [activeTab, polygonRing])

  return (
    <main className="app">
      <section className="controls">
        <h1>Lot Footprint Workflow</h1>
        <p>Keep API-extracted lot footprint geometry as a Polygon and review it in 3D.</p>

        <div className="tabs" role="tablist" aria-label="Lot footprint tabs">
          <button
            type="button"
            className={activeTab === 'generate' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('generate')}
          >
            Lot Footprint Generate
          </button>
          <button
            type="button"
            className={activeTab === 'viewer' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('viewer')}
          >
            3D Lot Footprint Viewer
          </button>
        </div>

        {activeTab === 'generate' ? (
          <div className="panel">
            <label htmlFor="api-json">API response payload</label>
            <textarea
              id="api-json"
              value={rawApiInput}
              onChange={(event) => setRawApiInput(event.target.value)}
              rows={14}
            />
            <button type="button" className="action-button" onClick={extractPolygonFromApi}>
              Extract Polygon
            </button>
            {polygon ? (
              <pre className="polygon-preview">{JSON.stringify(polygon, null, 2)}</pre>
            ) : null}
          </div>
        ) : (
          <div className="panel panel-compact">
            <p>
              Drag inside the viewer with your mouse to orbit around the lot footprint. Each footprint edge
              is labeled with its length.
            </p>
          </div>
        )}

        <p className="status">{status}</p>
      </section>
      <section className="viewer-shell" aria-label="3D lot footprint viewer">
        <div className="viewer" ref={mountRef} />
        <div className="label-layer" ref={labelLayerRef} />
      </section>
    </main>
  )
}

export default App
