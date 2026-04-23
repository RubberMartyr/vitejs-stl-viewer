import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

type ThreeLike = {
  Scene: new () => {
    background: unknown
    add: (...objects: unknown[]) => void
    remove: (...objects: unknown[]) => void
  }
  Color: new (color: string) => unknown
  PerspectiveCamera: new (
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) => {
    position: { set: (x: number, y: number, z: number) => void }
    aspect: number
    updateProjectionMatrix: () => void
  }
  WebGLRenderer: new (opts: { antialias: boolean }) => {
    domElement: HTMLCanvasElement
    setPixelRatio: (ratio: number) => void
    setSize: (width: number, height: number) => void
    render: (scene: unknown, camera: unknown) => void
    dispose: () => void
  }
  AmbientLight: new (color: number, intensity: number) => unknown
  DirectionalLight: new (color: number, intensity: number) => {
    position: { set: (x: number, y: number, z: number) => void }
  }
  MeshStandardMaterial: new (opts: {
    color: string
    metalness: number
    roughness: number
  }) => { dispose: () => void }
  Mesh: new (
    geometry: STLGeometry,
    material: { dispose: () => void },
  ) => {
    geometry: STLGeometry
    material: { dispose: () => void }
    rotation: { y: number }
  }
}

type STLGeometry = {
  computeBoundingBox: () => void
  computeVertexNormals: () => void
  center: () => void
  dispose: () => void
}

type STLLoaderLike = new () => { parse: (data: ArrayBuffer) => STLGeometry }

declare global {
  interface Window {
    THREE?: ThreeLike
    STLLoader?: STLLoaderLike
  }
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<{
    background: unknown
    add: (...objects: unknown[]) => void
    remove: (...objects: unknown[]) => void
  } | null>(null)
  const meshRef = useRef<{
    geometry: STLGeometry
    material: { dispose: () => void }
    rotation: { y: number }
  } | null>(null)
  const [status, setStatus] = useState('Upload an STL file to preview it.')

  useEffect(() => {
    const mount = mountRef.current
    const THREE = window.THREE
    const STLLoader = window.STLLoader

    if (!mount || !THREE || !STLLoader) {
      const timeoutId = window.setTimeout(() => {
        setStatus(
          'Viewer libraries are not ready yet. Refresh and try uploading again.',
        )
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0f172a')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    )
    camera.position.set(0, 0, 140)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25)
    keyLight.position.set(1, 1, 2)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.75)
    fillLight.position.set(-1, -0.5, -2)
    scene.add(fillLight)

    let animationId = 0
    const animate = () => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.01
      }
      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }

    const onResize = () => {
      if (!mountRef.current) return
      const { clientWidth, clientHeight } = mountRef.current
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(clientWidth, clientHeight)
    }

    animationId = requestAnimationFrame(animate)
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animationId)

      if (meshRef.current) {
        scene.remove(meshRef.current)
        meshRef.current.geometry.dispose()
        meshRef.current.material.dispose()
        meshRef.current = null
      }

      sceneRef.current = null
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const scene = sceneRef.current
    const THREE = window.THREE
    const STLLoader = window.STLLoader

    if (!file) return

    if (!scene || !THREE || !STLLoader) {
      setStatus(
        'Viewer libraries are not ready yet. Refresh and try uploading again.',
      )
      return
    }

    const loader = new STLLoader()
    const reader = new FileReader()

    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result
      if (!(result instanceof ArrayBuffer)) {
        setStatus('Could not read STL file.')
        return
      }

      const geometry = loader.parse(result)
      geometry.computeBoundingBox()
      geometry.computeVertexNormals()
      geometry.center()

      const material = new THREE.MeshStandardMaterial({
        color: '#60a5fa',
        metalness: 0.1,
        roughness: 0.35,
      })
      const mesh = new THREE.Mesh(geometry, material)

      if (meshRef.current) {
        scene.remove(meshRef.current)
        meshRef.current.geometry.dispose()
        meshRef.current.material.dispose()
      }

      meshRef.current = mesh
      scene.add(mesh)
      setStatus(`Loaded: ${file.name}`)
    }

    reader.onerror = () => setStatus('Failed to load STL file.')
    reader.readAsArrayBuffer(file)
  }

  return (
    <main className="app">
      <section className="controls">
        <h1>STL Viewer</h1>
        <p>Upload an STL file to inspect it in Three.js.</p>
        <label htmlFor="stl-file" className="upload-label">
          Choose STL file
        </label>
        <input
          id="stl-file"
          className="file-input"
          type="file"
          accept=".stl"
          onChange={handleFileUpload}
        />
        <p className="status">{status}</p>
      </section>
      <section className="viewer" ref={mountRef} aria-label="3D STL preview" />
    </main>
  )
}

export default App
