import * as THREE from 'three';

/**
 * RendererManager - Manages the Three.js WebGL renderer
 */
export class RendererManager {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        // This will be called by the camera manager
        // which has access to the camera
    }

    render(scene, camera) {
        this.renderer.render(scene, camera);
    }

    setSize(width, height) {
        this.renderer.setSize(width, height);
    }

    getRenderer() {
        return this.renderer;
    }
}
