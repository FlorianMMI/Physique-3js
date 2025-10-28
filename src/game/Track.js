import * as THREE from 'three';

/**
 * Track - Manages the racing track generation and rendering
 * Uses a skeleton-based approach: first generate a path of points,
 * then build the track geometry around those points
 */
export class Track {
    constructor(scene) {
        this.scene = scene;
        
        // Track configuration
        this.trackWidth = 10; // Width of the racing track
        this.wallHeight = 2; // Height of the track walls
        this.skeletonPoints = []; // Array of Vector3 points defining the centerline
        
        // Track meshes
        this.trackMesh = null;
        this.innerWall = null;
        this.outerWall = null;
        this.finishLineMesh = null;
        
        // Checkpoints for lap validation
        this.checkpoints = []; // Array of checkpoint data
        this.numCheckpoints = 4; // Number of validation checkpoints (excluding finish line)
        
        // Generate the track
        this._generateSkeleton();
        this._buildTrack();
        this._buildWalls();
        this._createCheckpoints();
        this._createFinishLine();
    }

    /**
     * Generate the skeleton path for the track
     * For now, creates a simple circle
     */
    _generateSkeleton() {
        this.skeletonPoints = [];
        
        const radius = 50; // Radius of the circular track
        const segments = 64; // Number of points in the circle
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            this.skeletonPoints.push(new THREE.Vector3(x, 0, z));
        }
        
        console.log(`Track skeleton generated with ${this.skeletonPoints.length} points`);
    }

    /**
     * Build the 3D track geometry from the skeleton points
     * Creates a path with width following the skeleton
     */
    _buildTrack() {
        if (this.skeletonPoints.length < 2) {
            console.error('Not enough skeleton points to build track');
            return;
        }

        // For now, create a simple tube-like track using THREE.TubeGeometry
        // First, create a curve from our skeleton points
        const curvePoints = [...this.skeletonPoints];
        // Close the loop by adding the first point at the end
        curvePoints.push(this.skeletonPoints[0].clone());
        
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;
        
        // Create tube geometry along the curve
        const tubeGeometry = new THREE.TubeGeometry(
            curve,
            this.skeletonPoints.length, // tubular segments
            this.trackWidth / 2, // radius (half width for circular cross-section)
            8, // radial segments
            true // closed
        );
        
        // Create a flattened version for the actual track surface
        // We'll use a custom approach to create a flat ribbon
        const trackGeometry = this._createFlatRibbon(curve);
        
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        this.trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
        this.scene.add(this.trackMesh);
        
        console.log('Track geometry created');
    }

    /**
     * Create a flat ribbon geometry following the curve
     * This gives us a proper flat racing surface
     */
    _createFlatRibbon(curve) {
        const segments = this.skeletonPoints.length;
        const halfWidth = this.trackWidth / 2;
        
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        // Generate vertices along the curve
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Calculate perpendicular vector (for width)
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Create left and right edge points
            const leftPoint = point.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
            const rightPoint = point.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
            
            vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);
            vertices.push(rightPoint.x, rightPoint.y, rightPoint.z);
            
            // UV coordinates
            uvs.push(0, t);
            uvs.push(1, t);
            
            // Create triangles (except for the last iteration)
            if (i < segments) {
                const baseIndex = i * 2;
                // First triangle
                indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
                // Second triangle
                indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }

    /**
     * Build walls along the inner and outer edges of the track
     */
    _buildWalls() {
        if (this.skeletonPoints.length < 2) {
            console.error('Not enough skeleton points to build walls');
            return;
        }

        const halfWidth = this.trackWidth / 2;
        const wallThickness = 0.3;
        
        // Create curve from skeleton
        const curvePoints = [...this.skeletonPoints];
        curvePoints.push(this.skeletonPoints[0].clone());
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;

        // Build inner wall
        this.innerWall = this._createWall(curve, halfWidth, wallThickness, true);
        this.scene.add(this.innerWall);

        // Build outer wall
        this.outerWall = this._createWall(curve, halfWidth, wallThickness, false);
        this.scene.add(this.outerWall);

        console.log('Track walls created');
    }

    /**
     * Create a single wall (inner or outer)
     */
    _createWall(curve, halfWidth, wallThickness, isInner) {
        const segments = this.skeletonPoints.length;
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        // Determine wall offset direction
        const offsetDistance = isInner ? -(halfWidth + wallThickness/2) : (halfWidth + wallThickness/2);
        
        // Generate wall vertices
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = curve.getPoint(t);
            const tangent = curve.getTangent(t);
            
            // Calculate perpendicular vector (for width)
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Calculate wall position
            const wallCenter = point.clone().add(perpendicular.clone().multiplyScalar(offsetDistance));
            
            // Create inner and outer edge of the wall
            const innerEdge = wallCenter.clone().add(perpendicular.clone().multiplyScalar(-wallThickness/2));
            const outerEdge = wallCenter.clone().add(perpendicular.clone().multiplyScalar(wallThickness/2));
            
            // Bottom vertices
            vertices.push(innerEdge.x, innerEdge.y, innerEdge.z);
            vertices.push(outerEdge.x, outerEdge.y, outerEdge.z);
            
            // Top vertices
            vertices.push(innerEdge.x, innerEdge.y + this.wallHeight, innerEdge.z);
            vertices.push(outerEdge.x, outerEdge.y + this.wallHeight, outerEdge.z);
            
            // UV coordinates
            const uCoord = t;
            uvs.push(0, 0);
            uvs.push(1, 0);
            uvs.push(0, 1);
            uvs.push(1, 1);
            
            // Create triangles for the wall faces
            if (i < segments) {
                const baseIndex = i * 4;
                
                // Inner face (facing track)
                indices.push(baseIndex, baseIndex + 2, baseIndex + 4);
                indices.push(baseIndex + 2, baseIndex + 6, baseIndex + 4);
                
                // Outer face
                indices.push(baseIndex + 1, baseIndex + 5, baseIndex + 3);
                indices.push(baseIndex + 3, baseIndex + 5, baseIndex + 7);
                
                // Top face
                indices.push(baseIndex + 2, baseIndex + 3, baseIndex + 6);
                indices.push(baseIndex + 3, baseIndex + 7, baseIndex + 6);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        // Wall material - red with some glow
        const material = new THREE.MeshStandardMaterial({
            color: 0xcc0000,
            roughness: 0.6,
            metalness: 0.3,
            emissive: 0x660000,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        return new THREE.Mesh(geometry, material);
    }

    /**
     * Create invisible checkpoints along the track for lap validation
     */
    _createCheckpoints() {
        this.checkpoints = [];
        
        if (this.skeletonPoints.length < 2) {
            return;
        }

        // Create evenly spaced checkpoints around the track (excluding start/finish)
        for (let i = 0; i < this.numCheckpoints; i++) {
            // Space checkpoints evenly, starting after the finish line
            const index = Math.floor((i + 1) * this.skeletonPoints.length / (this.numCheckpoints + 1));
            const nextIndex = (index + 1) % this.skeletonPoints.length;
            
            const point = this.skeletonPoints[index];
            const nextPoint = this.skeletonPoints[nextIndex];
            
            // Calculate perpendicular vector for checkpoint width
            const tangent = new THREE.Vector3().subVectors(nextPoint, point).normalize();
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            const halfWidth = this.trackWidth / 2;
            
            this.checkpoints.push({
                id: i,
                position: point.clone(),
                leftEdge: point.clone().add(perpendicular.clone().multiplyScalar(halfWidth)),
                rightEdge: point.clone().add(perpendicular.clone().multiplyScalar(-halfWidth)),
                direction: tangent.clone(),
                perpendicular: perpendicular.clone()
            });
        }
        
        console.log(`Created ${this.checkpoints.length} checkpoints`);
    }

    /**
     * Create visual finish line at the track start
     */
    _createFinishLine() {
        if (this.skeletonPoints.length < 2) {
            return;
        }

        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        // Calculate perpendicular vector
        const tangent = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
        const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        const halfWidth = this.trackWidth / 2;
        
        // Create checkered pattern finish line
        const lineGeometry = new THREE.PlaneGeometry(this.trackWidth, 1);
        
        // Create a canvas texture for checkered pattern
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Draw checkered pattern (black and white squares)
        const squareSize = 64;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 1; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#000000';
                ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const lineMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        
        this.finishLineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
        
        // Position the finish line
        this.finishLineMesh.position.copy(startPoint);
        this.finishLineMesh.position.y = 0.05; // Slightly above ground
        
        // Rotate to lay flat on the ground and align with track direction
        this.finishLineMesh.rotation.x = -Math.PI / 2; // Lay flat
        this.finishLineMesh.rotation.z = Math.atan2(tangent.x, tangent.z); // Align with track
        
        this.scene.add(this.finishLineMesh);
        
        console.log('Finish line created');
    }

    /**
     * Check if a position crosses a checkpoint
     * Returns checkpoint info if crossed, null otherwise
     */
    checkCheckpoint(oldPos, newPos, checkpointId) {
        if (checkpointId >= this.checkpoints.length) {
            return null;
        }
        
        const checkpoint = this.checkpoints[checkpointId];
        
        // Check if the line from oldPos to newPos crosses the checkpoint line
        // using 2D line intersection (ignoring Y)
        const crossed = this._linesCross2D(
            oldPos, newPos,
            checkpoint.leftEdge, checkpoint.rightEdge
        );
        
        return crossed ? checkpoint : null;
    }

    /**
     * Check if a position crosses the finish line
     */
    checkFinishLine(oldPos, newPos) {
        if (this.skeletonPoints.length < 2) {
            return false;
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        const tangent = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();
        const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const halfWidth = this.trackWidth / 2;
        
        const leftEdge = startPoint.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
        const rightEdge = startPoint.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
        
        return this._linesCross2D(oldPos, newPos, leftEdge, rightEdge);
    }

    /**
     * Check if two 2D line segments intersect (helper function)
     */
    _linesCross2D(a1, a2, b1, b2) {
        // Using 2D coordinates only (x, z)
        const x1 = a1.x, z1 = a1.z;
        const x2 = a2.x, z2 = a2.z;
        const x3 = b1.x, z3 = b1.z;
        const x4 = b2.x, z4 = b2.z;
        
        const denom = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
        
        if (Math.abs(denom) < 0.0001) {
            return false; // Parallel or coincident
        }
        
        const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (z1 - z3) - (z1 - z2) * (x1 - x3)) / denom;
        
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    /**
     * Get the starting position and rotation for spawning players
     * Returns the first point on the track
     */
    getStartPosition() {
        if (this.skeletonPoints.length === 0) {
            return { x: 0, y: 0.2, z: 0, rotY: 0 };
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1] || startPoint;
        
        // Calculate rotation to face along the track
        const direction = new THREE.Vector3()
            .subVectors(nextPoint, startPoint)
            .normalize();
        const rotY = Math.atan2(direction.x, direction.z);
        
        return {
            x: startPoint.x,
            y: 0.2,
            z: startPoint.z,
            rotY: rotY
        };
    }

    /**
     * Get a spawn position offset from the start
     * Useful for multiple players at the starting line
     */
    getStartPositionOffset(lateralOffset = 0, longitudinalOffset = 0) {
        if (this.skeletonPoints.length < 2) {
            return this.getStartPosition();
        }
        
        const startPoint = this.skeletonPoints[0];
        const nextPoint = this.skeletonPoints[1];
        
        // Calculate forward direction
        const forward = new THREE.Vector3()
            .subVectors(nextPoint, startPoint)
            .normalize();
        
        // Calculate perpendicular (lateral) direction
        const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        
        // Calculate position with offsets
        const position = startPoint.clone()
            .add(lateral.multiplyScalar(lateralOffset))
            .add(forward.multiplyScalar(longitudinalOffset));
        
        const rotY = Math.atan2(forward.x, forward.z);
        
        return {
            x: position.x,
            y: 0.2,
            z: position.z,
            rotY: rotY
        };
    }

    /**
     * Check if a position is outside the track boundaries
     * Returns an object with collision info if outside, null if inside
     */
    checkWallCollision(position) {
        if (this.skeletonPoints.length < 2) {
            return null;
        }

        // Find the closest point on the track skeleton
        let closestDistance = Infinity;
        let closestSegmentIndex = 0;
        let closestT = 0;

        // Check each segment of the track
        for (let i = 0; i < this.skeletonPoints.length; i++) {
            const p1 = this.skeletonPoints[i];
            const p2 = this.skeletonPoints[(i + 1) % this.skeletonPoints.length];
            
            // Project point onto line segment
            const lineVec = new THREE.Vector3().subVectors(p2, p1);
            const pointVec = new THREE.Vector3().subVectors(position, p1);
            
            const lineLength = lineVec.length();
            if (lineLength === 0) continue;
            
            const t = Math.max(0, Math.min(1, pointVec.dot(lineVec) / (lineLength * lineLength)));
            const projection = p1.clone().add(lineVec.multiplyScalar(t));
            
            const distance = new THREE.Vector2(
                position.x - projection.x,
                position.z - projection.z
            ).length();
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestSegmentIndex = i;
                closestT = t;
            }
        }

        // Calculate the closest point on the track centerline
        const p1 = this.skeletonPoints[closestSegmentIndex];
        const p2 = this.skeletonPoints[(closestSegmentIndex + 1) % this.skeletonPoints.length];
        const lineVec = new THREE.Vector3().subVectors(p2, p1);
        const closestPoint = p1.clone().add(lineVec.multiplyScalar(closestT));

        // Calculate distance from track center
        const halfWidth = this.trackWidth / 2;
        const maxDistance = halfWidth - 0.5; // Leave some margin from the wall

        if (closestDistance > maxDistance) {
            // Outside track boundaries
            // Calculate correction vector (push toward track center)
            const toCenter = new THREE.Vector3()
                .subVectors(closestPoint, position);
            toCenter.y = 0; // Keep on same y level
            toCenter.normalize();

            return {
                isColliding: true,
                correctionVector: toCenter,
                penetrationDepth: closestDistance - maxDistance,
                closestPoint: closestPoint
            };
        }

        return null; // Inside track
    }

    /**
     * Get the track normal (perpendicular direction) at a given position
     * Useful for calculating bounce direction
     */
    getTrackNormalAt(position) {
        if (this.skeletonPoints.length < 2) {
            return new THREE.Vector3(0, 0, 1);
        }

        // Find closest segment
        let closestDistance = Infinity;
        let closestSegmentIndex = 0;

        for (let i = 0; i < this.skeletonPoints.length; i++) {
            const p = this.skeletonPoints[i];
            const dist = new THREE.Vector2(
                position.x - p.x,
                position.z - p.z
            ).length();
            
            if (dist < closestDistance) {
                closestDistance = dist;
                closestSegmentIndex = i;
            }
        }

        // Get tangent of the track at this point
        const p1 = this.skeletonPoints[closestSegmentIndex];
        const p2 = this.skeletonPoints[(closestSegmentIndex + 1) % this.skeletonPoints.length];
        const tangent = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Normal is perpendicular to tangent
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        
        return normal;
    }

    /**
     * Cleanup - remove track from scene
     */
    destroy() {
        if (this.trackMesh) {
            this.scene.remove(this.trackMesh);
            this.trackMesh.geometry.dispose();
            this.trackMesh.material.dispose();
        }
        if (this.innerWall) {
            this.scene.remove(this.innerWall);
            this.innerWall.geometry.dispose();
            this.innerWall.material.dispose();
        }
        if (this.outerWall) {
            this.scene.remove(this.outerWall);
            this.outerWall.geometry.dispose();
            this.outerWall.material.dispose();
        }
        if (this.finishLineMesh) {
            this.scene.remove(this.finishLineMesh);
            this.finishLineMesh.geometry.dispose();
            this.finishLineMesh.material.dispose();
        }
    }
}
