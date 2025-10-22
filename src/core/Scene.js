import * as THREE from 'three';

/**
 * SceneManager - Manages the Three.js scene and all static environment objects
 */
export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        
        this.platformRadius = 40;
        this.platform = null;
        this.edge = null;
        
        this._setupPlatform();
        this._setupLights();
    }

    _setupPlatform() {
        // Create circular platform
        const platformGeometry = new THREE.CylinderGeometry(
            this.platformRadius, 
            this.platformRadius, 
            2, 
            32
        );
        const platformMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4a4a4a,
            roughness: 0.7,
            metalness: 0.3
        });
        this.platform = new THREE.Mesh(platformGeometry, platformMaterial);
        this.platform.position.y = -1;
        this.scene.add(this.platform);

        // Platform edge (red glowing border)
        const edgeGeometry = new THREE.TorusGeometry(this.platformRadius, 0.3, 16, 100);
        const edgeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        this.edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        this.edge.rotation.x = Math.PI / 2;
        this.edge.position.y = 0;
        this.scene.add(this.edge);
    }

    _setupLights() {
        // Hemisphere light
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        hemi.position.set(0, 20, 0);
        this.scene.add(hemi);

        // Directional light
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 30, 10);
        dirLight.castShadow = false;
        this.scene.add(dirLight);

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }

    getPlatformRadius() {
        return this.platformRadius;
    }

    getScene() {
        return this.scene;
    }
}
