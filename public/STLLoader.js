;(function () {
  if (!window.THREE) {
    console.error('THREE must be loaded before STLLoader.')
    return
  }

  const THREE = window.THREE

  function isBinary(data) {
    const reader = new DataView(data)
    const faceCount = reader.getUint32(80, true)
    const expectedLength = 84 + faceCount * 50
    return expectedLength === reader.byteLength
  }

  function parseBinary(data) {
    const reader = new DataView(data)
    const faces = reader.getUint32(80, true)
    const vertices = new Float32Array(faces * 9)

    let offset = 84
    let vertexIndex = 0

    for (let face = 0; face < faces; face++) {
      offset += 12 // skip normal

      for (let i = 0; i < 3; i++) {
        vertices[vertexIndex++] = reader.getFloat32(offset, true)
        vertices[vertexIndex++] = reader.getFloat32(offset + 4, true)
        vertices[vertexIndex++] = reader.getFloat32(offset + 8, true)
        offset += 12
      }

      offset += 2 // attribute byte count
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    return geometry
  }

  function parseASCII(text) {
    const vertexPattern = /vertex\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g
    const vertices = []
    let result

    while ((result = vertexPattern.exec(text)) !== null) {
      vertices.push(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3]))
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return geometry
  }

  class STLLoader {
    parse(data) {
      if (typeof data === 'string') {
        return parseASCII(data)
      }

      if (isBinary(data)) {
        return parseBinary(data)
      }

      const decoder = new TextDecoder()
      return parseASCII(decoder.decode(data))
    }
  }

  window.STLLoader = STLLoader
})()
