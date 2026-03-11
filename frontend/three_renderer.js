/**
 * Specula - 3D Heatmap Renderer
 * =================================
 * Uses Three.js to render 2D base64 heatmaps as interactive 3D topographic surfaces.
 */

// Store active renderers to clean them up if new analyses are run
window.activeThreeScenes = {};

/**
 * Render a base64 image as a 3D topographic terrain inside a container.
 * 
 * @param {string} containerId - The DOM ID of the container (e.g., 'cnn-gradcam')
 * @param {string} base64Image - The raw base64 string (without data:image/png;base64 prefix)
 * @param {string} tintHex - Optional hex color to tint the material (e.g. 0x32ade6)
 */
window.render3DHeatmap = function(containerId, base64Image, tintHex = 0xffffff) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Clean up existing scene if it exists in this container
    if (window.activeThreeScenes[containerId]) {
        const oldScene = window.activeThreeScenes[containerId];
        cancelAnimationFrame(oldScene.animationId);
        oldScene.renderer.dispose();
        container.innerHTML = "";
    }

    // Initialize dimensions
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    // 2. Setup Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // Position camera at an angle looking down at the map
    camera.position.set(0, -4, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Add canvas toDOM
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Provide some instructions to the user via a subtle overlay
    const overlay = document.createElement("div");
    overlay.className = "three-instruction-overlay";
    overlay.innerText = "Drag to Rotate";
    overlay.style.position = "absolute";
    overlay.style.bottom = "8px";
    overlay.style.width = "100%";
    overlay.style.textAlign = "center";
    overlay.style.fontSize = "0.7rem";
    overlay.style.color = "var(--text-muted)";
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "0.7";
    container.appendChild(overlay);

    // 3. Orbit Controls for interactivity
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.maxPolarAngle = Math.PI / 2.1; // Don't let them go below the floor
    
    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // 5. Load Texture
    const textureLoader = new THREE.TextureLoader();
    const dataUri = `data:image/png;base64,${base64Image}`;
    
    textureLoader.load(dataUri, (texture) => {
        // Calculate aspect ratio of the image to scale the plane correctly
        const imgAspect = texture.image.width / texture.image.height;
        const planeWidth = 5;
        const planeHeight = 5 / imgAspect;

        // Create high-density plane geometry for smooth displacement
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 256, 256);

        // Create material using the heatmap for BOTH color and displacement height
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            displacementMap: texture,
            displacementScale: 1.2, // Maximum height of the peaks
            color: tintHex,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        const plane = new THREE.Mesh(geometry, material);
        // Plane is created standing up, lay it flat on the 'table'
        plane.rotation.x = -Math.PI / 2;
        scene.add(plane);

        // 6. Animation Loop
        let animationId;
        const animate = function () {
            animationId = requestAnimationFrame(animate);
            
            // Slowly auto-rotate the mesh if user isn't actively dragging
            if (!controls.state && plane) {
                plane.rotation.z += 0.002;
            }
            
            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        // 7. Store reference for cleanup later
        window.activeThreeScenes[containerId] = {
            scene, camera, renderer, animationId
        };
    });

    // Handle Window Resizing smoothly
    const resizeObserver = new ResizeObserver(() => {
        if (!container || !renderer) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if (newW > 0 && newH > 0) {
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        }
    });
    resizeObserver.observe(container);
};
