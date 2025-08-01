import React, { useMemo } from 'react';
// import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BookmarkGeometry } from '../../types';

interface BookmarkMeshProps {
  geometry: BookmarkGeometry;
  renderMode: 'solid' | 'wireframe' | 'x-ray';
  layerVisibility: Map<number, boolean>;
  onError: (error: Error) => void;
}

interface LayerMeshProps {
  layer: BookmarkGeometry['layers'][0];
  index: number;
  renderMode: 'solid' | 'wireframe' | 'x-ray';
  visible: boolean;
}

const LayerMesh: React.FC<LayerMeshProps> = ({ layer, index, renderMode, visible }) => {
  const material = useMemo(() => {
    const color = new THREE.Color(
      layer.color.r / 255,
      layer.color.g / 255,
      layer.color.b / 255
    );

    switch (renderMode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
        });
      case 'x-ray':
        return new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      case 'solid':
      default:
        return new THREE.MeshStandardMaterial({
          color,
          metalness: 0.1,
          roughness: 0.8,
        });
    }
  }, [layer.color, renderMode]);

  return (
    <mesh
      geometry={layer.geometry}
      material={material}
      position={[0, layer.height, 0]}
      visible={visible}
      castShadow
      receiveShadow
      name={`bookmark-layer-${index}`}
    />
  );
};

export const BookmarkMesh: React.FC<BookmarkMeshProps> = ({
  geometry,
  renderMode,
  layerVisibility,
  onError,
}) => {
  // Error boundary for individual layers
  const safeRenderLayer = (layer: BookmarkGeometry['layers'][0], index: number) => {
    try {
      const visible = layerVisibility.get(index) ?? true;
      return (
        <LayerMesh
          key={`layer-${index}`}
          layer={layer}
          index={index}
          renderMode={renderMode}
          visible={visible}
        />
      );
    } catch (error) {
      console.error(`Error rendering layer ${index}:`, error);
      onError(error instanceof Error ? error : new Error(`Layer ${index} render error`));
      return null;
    }
  };

  // Center the geometry based on its bounding box
  const groupPosition = useMemo((): [number, number, number] => {
    if (!geometry.boundingBox) return [0, 0, 0];
    
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    return [-center.x, -center.y, -center.z];
  }, [geometry.boundingBox]);

  return (
    <group position={groupPosition}>
      {geometry.layers.map((layer, index) => safeRenderLayer(layer, index))}
      
      {/* Ground plane for shadows */}
      <mesh
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.3} />
      </mesh>
    </group>
  );
};