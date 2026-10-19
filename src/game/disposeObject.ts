import * as THREE from 'three';

/** Release GPU resources when procedural objects leave the scene. */
export function disposeObject(root: THREE.Object3D) {
  const resources = new Set<{ dispose: () => void }>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) resources.add(mesh.geometry);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) resources.add(value);
      }
    }
  });
  resources.forEach((resource) => resource.dispose());
}
