import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

export const AtmosphereMaterial = shaderMaterial(
  {
    atmosphereColor: new THREE.Color('#38bdf8'),
  },
  // Vertex Shader
  `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader
  `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 atmosphereColor;
    void main() {
      // Glow intensity based on Fresnel angle
      float intensity = pow(0.6 - dot(vNormal, vViewDir), 2.0);
      gl_FragColor = vec4(atmosphereColor, 1.0) * intensity;
    }
  `
);
