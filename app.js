import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class CloakifyApp {
    constructor() {
        // Cache UI Elements
        this.ui = this.cacheUIElements();

        // Core Three.js components
        this.scene = new THREE.Scene();
        this.camera = null;
        this.perspectiveCamera = null;
        this.orthoCamera = null;
        this.renderer = null;
        this.controls = null;

        // Lighting
        this.lights = {};

        // Model components
        this.models = { cape: null, elytra: null };
        this.currentCapeMap = null;
        this.materials = {
            cape: [],
            player: [],
            playerEdgeUniforms: [],
            capeEdgeUniforms: [],
            defaultPlayerMap: null
        };
        this.highlightLines = [];
        this.shadowMesh = null;

        // Startup
        this.init();
    }

    cacheUIElements() {
        return {
            container: document.getElementById('canvas-container'),
            loadSkinBtn: document.getElementById('load-skin-btn'),
            usernameInput: document.getElementById('username-input'),
            dropZone: document.getElementById('drop-zone'),
            texturePreview: document.getElementById('texture-preview'),
            downloadBtn: document.getElementById('download-btn'),
            resetViewBtn: document.getElementById('reset-view-btn'),
            screenshotBtn: document.getElementById('screenshot-btn'),
            orthoToggle: document.getElementById('ortho-toggle'),
            transparentBgToggle: document.getElementById('transparent-bg-toggle'),
            elytraToggle: document.getElementById('elytra-toggle'),
            hqToggle: document.getElementById('hq-toggle'),
            fileInput: document.getElementById('file-input')
        };
    }

    init() {
        this.setupRenderer();
        this.setupCameras();
        this.setupControls();
        this.setupLights();
        this.loadModel();
        this.setupEventListeners();

        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.animate = this.animate.bind(this);
        this.animate();
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        
        const width = this.ui.container ? this.ui.container.clientWidth : window.innerWidth;
        const height = this.ui.container ? this.ui.container.clientHeight : window.innerHeight;
        this.renderer.setSize(width, height);

        const isHQ = this.ui.hqToggle ? this.ui.hqToggle.checked : true;
        this.renderer.setPixelRatio(isHQ ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.0));

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        if (this.ui.container) {
            this.ui.container.appendChild(this.renderer.domElement);
        }
    }

    setupCameras() {
        const width = this.ui.container ? this.ui.container.clientWidth : window.innerWidth;
        const height = this.ui.container ? this.ui.container.clientHeight : window.innerHeight;
        const aspect = width / height;

        // Perspective Camera
        this.perspectiveCamera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
        this.perspectiveCamera.position.set(-1.5, 0.5, 3.5);

        // Orthographic Camera
        const frustumSize = 4.0;
        this.orthoCamera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2, (frustumSize * aspect) / 2,
            frustumSize / 2, frustumSize / -2,
            0.1, 100
        );
        this.orthoCamera.position.set(-1.5, 0.5, 3.5);

        // Default to orthographic
        this.camera = this.orthoCamera;

        this.scene.add(this.perspectiveCamera);
        this.scene.add(this.orthoCamera);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false; // Désactive le déplacement dans l'espace
        this.controls.target.set(-1.5, -0.4, 0); // Point focal fixe sur la figurine
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        this.lights.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.lights.dirLight.position.set(5, 10, 7);

        this.lights.frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.lights.frontLight.position.set(0, 2, 8);

        this.lights.backLight = new THREE.DirectionalLight(0xa8ff78, 0.5);
        this.lights.backLight.position.set(-5, 5, -7);

        this.camera.add(this.lights.dirLight);
        this.camera.add(this.lights.frontLight);
        this.camera.add(this.lights.backLight);
    }

    loadModel() {
        const loader = new GLTFLoader();

        loader.load('./Ressources/cape-display.gltf', (gltf) => {
            this.models.cape = gltf.scene;
            this.processModelMaterials(this.models.cape);

            this.models.cape.position.y = -1.4;
            this.models.cape.position.x = -1.5;
            this.models.cape.rotation.y = Math.PI * 1.8;

            this.scene.add(this.models.cape);
            this.onModelLoaded();
        });

        loader.load('./Ressources/elytra-display.gltf', (gltf) => {
            this.models.elytra = gltf.scene;
            this.processModelMaterials(this.models.elytra);

            this.models.elytra.position.y = -1.4;
            this.models.elytra.position.x = -1.5;
            this.models.elytra.rotation.y = Math.PI * 1.8;
            this.models.elytra.visible = false;

            this.scene.add(this.models.elytra);
            this.onModelLoaded();
        });
    }

    onModelLoaded() {
        if (this.models.cape && this.models.elytra) {
            this.createShadowMesh();
            this.handleUrlParameters();

            if (this.ui.elytraToggle && this.ui.elytraToggle.checked) {
                this.models.cape.visible = false;
                this.models.elytra.visible = true;
            }
        }
    }

    processModelMaterials(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                if (child.material.map) {
                    child.material.map.magFilter = THREE.NearestFilter;
                    child.material.map.minFilter = THREE.NearestFilter;
                }

                if (child.name === '16x' || child.name.includes('wing')) {
                    const mat = child.material;
                    if (child.name.includes('wing')) {
                        mat.transparent = true;
                        mat.alphaTest = 0.1;
                        mat.depthWrite = true;
                        mat.side = THREE.DoubleSide;
                    }
                    this.materials.cape.push(mat);
                } else {
                    // Minecraft outer layer needs transparency
                    const mat = child.material;
                    mat.transparent = true;
                    mat.alphaTest = 0.1; // Threshold for Minecraft pixel art
                    mat.depthWrite = true;

                    this.materials.player.push(mat);
                    if (!this.materials.defaultPlayerMap) {
                        this.materials.defaultPlayerMap = mat.map;
                    }
                }
                if (!child.name.includes('wing')) {
                    const isLayer = child.name.includes('Layer');
                    this.addHighlightEdges(child, isLayer, child.name === '16x');
                }
            }
        });
    }

    addHighlightEdges(mesh, isLayer, isCapeMap) {
        // Ajout d'un liseré blanc sur les arêtes pour l'effet voxel "Highlight"
        const edges = new THREE.EdgesGeometry(mesh.geometry, 30);

        let defines = {};
        let uniforms = {};

        if (isLayer && mesh.material.map && mesh.geometry.attributes.uv) {
            const edgePos = edges.attributes.position;
            const meshPos = mesh.geometry.attributes.position;
            const meshUv = mesh.geometry.attributes.uv;

            const edgeUvsA = new Float32Array(edgePos.count * 2);
            const edgeUvsB = new Float32Array(edgePos.count * 2);

            const isClose = (x1, y1, z1, x2, y2, z2) => {
                return (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2 < 0.0001;
            };

            const isIndexed = mesh.geometry.index !== null;
            const count = isIndexed ? mesh.geometry.index.count : meshPos.count;

            for (let i = 0; i < edgePos.count; i += 2) {
                const ex1 = edgePos.getX(i);
                const ey1 = edgePos.getY(i);
                const ez1 = edgePos.getZ(i);

                const ex2 = edgePos.getX(i + 1);
                const ey2 = edgePos.getY(i + 1);
                const ez2 = edgePos.getZ(i + 1);

                let matchA1 = -1, matchA2 = -1;
                let matchB1 = -1, matchB2 = -1;

                for (let t = 0; t < count; t += 3) {
                    const idx0 = isIndexed ? mesh.geometry.index.getX(t) : t;
                    const idx1 = isIndexed ? mesh.geometry.index.getX(t + 1) : t + 1;
                    const idx2 = isIndexed ? mesh.geometry.index.getX(t + 2) : t + 2;

                    const pts = [idx0, idx1, idx2];
                    let m1 = -1, m2 = -1;

                    for (let p = 0; p < 3; p++) {
                        const vIdx = pts[p];
                        const mx = meshPos.getX(vIdx);
                        const my = meshPos.getY(vIdx);
                        const mz = meshPos.getZ(vIdx);

                        if (m1 === -1 && isClose(ex1, ey1, ez1, mx, my, mz)) {
                            m1 = vIdx;
                        } else if (m2 === -1 && isClose(ex2, ey2, ez2, mx, my, mz)) {
                            m2 = vIdx;
                        }
                    }

                    if (m1 !== -1 && m2 !== -1) {
                        if (matchA1 === -1) {
                            matchA1 = m1; matchA2 = m2;
                        } else if (matchB1 === -1 && (m1 !== matchA1 || m2 !== matchA2)) {
                            matchB1 = m1; matchB2 = m2;
                        }
                    }
                }

                if (matchA1 !== -1) {
                    if (matchB1 === -1) { matchB1 = matchA1; matchB2 = matchA2; }

                    edgeUvsA[i * 2] = meshUv.getX(matchA1);
                    edgeUvsA[i * 2 + 1] = meshUv.getY(matchA1);
                    edgeUvsA[(i + 1) * 2] = meshUv.getX(matchA2);
                    edgeUvsA[(i + 1) * 2 + 1] = meshUv.getY(matchA2);

                    edgeUvsB[i * 2] = meshUv.getX(matchB1);
                    edgeUvsB[i * 2 + 1] = meshUv.getY(matchB1);
                    edgeUvsB[(i + 1) * 2] = meshUv.getX(matchB2);
                    edgeUvsB[(i + 1) * 2 + 1] = meshUv.getY(matchB2);
                }
            }
            edges.setAttribute('uvA', new THREE.BufferAttribute(edgeUvsA, 2));
            edges.setAttribute('uvB', new THREE.BufferAttribute(edgeUvsB, 2));
            defines.USE_MAP = "";
            uniforms.map = { value: mesh.material.map };
            if (isCapeMap) {
                this.materials.capeEdgeUniforms.push(uniforms);
            } else {
                this.materials.playerEdgeUniforms.push(uniforms);
            }
        }

        const edgesMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            defines: defines,
            vertexShader: `
                varying float vDistance;
                ${defines.USE_MAP !== undefined ? 'attribute vec2 uvA; attribute vec2 uvB; varying vec2 vUvA; varying vec2 vUvB;' : ''}
                void main() {
                    ${defines.USE_MAP !== undefined ? 'vUvA = uvA; vUvB = uvB;' : ''}
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vDistance = -mvPosition.z; 
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vDistance;
                ${defines.USE_MAP !== undefined ? 'varying vec2 vUvA; varying vec2 vUvB; uniform sampler2D map;' : ''}
                void main() {
                    ${defines.USE_MAP !== undefined ? 'if (texture2D(map, vUvA).a < 0.1 && texture2D(map, vUvB).a < 0.1) discard;' : ''}
                    float opacity = 1.0 - smoothstep(2.5, 3.5, vDistance);
                    gl_FragColor = vec4(1.0, 1.0, 1.0, opacity * 0.7);
                }
            `,
            transparent: true,
            depthWrite: false,
            linewidth: 3,
            blending: THREE.AdditiveBlending
        });
        const line = new THREE.LineSegments(edges, edgesMaterial);

        if (this.ui.hqToggle && !this.ui.hqToggle.checked) {
            line.visible = false;
        }

        this.highlightLines.push(line);
        mesh.add(line);
    }

    createShadowMesh() {
        // Ajout d'une ombre douce aux pieds
        const sCanvas = document.createElement('canvas');
        sCanvas.width = 128;
        sCanvas.height = 128;
        const sCtx = sCanvas.getContext('2d');

        const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(0,0,0,0.5)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, 128, 128);

        const shadowTex = new THREE.CanvasTexture(sCanvas);
        const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

        this.shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), shadowMat);
        this.shadowMesh.rotation.x = -Math.PI / 2;
        this.shadowMesh.position.set(-1.5, -1.39, 0); // Positionné juste sous le 0 local du modèle

        this.scene.add(this.shadowMesh);
    }

    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const capeData = urlParams.get('data');

        if (capeData) {
            const w = urlParams.get('w') || 22;
            const h = urlParams.get('h') || 17;
            const pal = urlParams.get('pal');
            const canvas = this.decodeCapeStr(pal, capeData, parseInt(w), parseInt(h));
            this.updateCapeTextureCanvas(canvas);
        } else {
            const capeBase64 = urlParams.get('cape');
            if (capeBase64) {
                this.updateCapeTexture(`data:image/png;base64,${capeBase64}`);
            }
        }

        if (this.ui.usernameInput && this.ui.usernameInput.value) {
            this.updatePlayerSkin(this.ui.usernameInput.value);
        }
    }

    setupEventListeners() {
        // UI Actions
        if (this.ui.loadSkinBtn && this.ui.usernameInput) {
            this.ui.loadSkinBtn.addEventListener('click', () => {
                this.updatePlayerSkin(this.ui.usernameInput.value.trim());
            });

            this.ui.usernameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.ui.loadSkinBtn.click();
            });
        }

        if (this.ui.resetViewBtn) {
            this.ui.resetViewBtn.addEventListener('click', () => {
                this.camera.position.set(-1.5, 0.5, 3.5);
                this.controls.target.set(-1.5, -0.4, 0);
                this.controls.update();
            });
        }

        if (this.ui.screenshotBtn) {
            this.ui.screenshotBtn.addEventListener('click', this.takeScreenshot.bind(this));
        }

        if (this.ui.orthoToggle) {
            this.ui.orthoToggle.addEventListener('change', this.toggleOrthographic.bind(this));
        }

        if (this.ui.transparentBgToggle) {
            this.ui.transparentBgToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('transparent-mode');
                } else {
                    document.body.classList.remove('transparent-mode');
                }
            });
        }

        if (this.ui.elytraToggle) {
            this.ui.elytraToggle.addEventListener('change', (e) => {
                if (this.models.cape && this.models.elytra) {
                    this.models.cape.visible = !e.target.checked;
                    this.models.elytra.visible = e.target.checked;
                }
            });
        }

        if (this.ui.hqToggle) {
            this.ui.hqToggle.addEventListener('change', (e) => {
                const isHQ = e.target.checked;
                this.renderer.setPixelRatio(isHQ ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.0));

                this.highlightLines.forEach(line => {
                    line.visible = isHQ;
                });
            });
        }

        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const { dropZone, fileInput } = this.ui;
        if (!dropZone) return;

        dropZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (file.type === 'image/png' || file.type === 'image/jpeg') {
                        const reader = new FileReader();
                        reader.onload = (event) => this.updateCapeTexture(event.target.result);
                        reader.readAsDataURL(file);
                    }
                }
            });
        }

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');

            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'image/png' || file.type === 'image/jpeg') {
                    const reader = new FileReader();
                    reader.onload = (event) => this.updateCapeTexture(event.target.result);
                    reader.readAsDataURL(file);
                }
            }
        });
    }

    takeScreenshot() {
        if (this.shadowMesh) this.shadowMesh.visible = false; // Désactiver l'ombre

        // Forcer un rendu synchrone
        this.renderer.render(this.scene, this.camera);

        let dataURL;
        if (this.ui.transparentBgToggle && this.ui.transparentBgToggle.checked) {
            dataURL = this.renderer.domElement.toDataURL('image/png');
        } else {
            dataURL = this.generateScreenshotWithBackground();
        }

        if (this.shadowMesh) this.shadowMesh.visible = true; // Réactiver l'ombre

        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `Cloakify_Render_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    generateScreenshotWithBackground() {
        const sCanvas = document.createElement('canvas');
        sCanvas.width = this.renderer.domElement.width;
        sCanvas.height = this.renderer.domElement.height;
        const sCtx = sCanvas.getContext('2d');

        // Base background color
        sCtx.fillStyle = '#121011';
        sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

        // Add active radiant halos
        if (window.currentBgColor) {
            const mc = window.currentBgColor;

            const grad1 = sCtx.createRadialGradient(
                sCanvas.width / 2, sCanvas.height / 2, 0,
                sCanvas.width / 2, sCanvas.height / 2, sCanvas.width * 0.6
            );
            grad1.addColorStop(0, `rgba(${mc[0]}, ${mc[1]}, ${mc[2]}, 0.15)`);
            grad1.addColorStop(1, 'transparent');
            sCtx.fillStyle = grad1;
            sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

            const grad2 = sCtx.createRadialGradient(
                sCanvas.width / 2, sCanvas.height, 0,
                sCanvas.width / 2, sCanvas.height, sCanvas.width * 0.5
            );
            grad2.addColorStop(0, `rgba(${mc[0]}, ${mc[1]}, ${mc[2]}, 0.08)`);
            grad2.addColorStop(1, 'transparent');
            sCtx.fillStyle = grad2;
            sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);
        }

        // Webgl composition on top
        sCtx.drawImage(this.renderer.domElement, 0, 0);
        return sCanvas.toDataURL('image/png');
    }

    toggleOrthographic(e) {
        const isOrtho = e.target.checked;

        // Remove lights from current camera
        const lightsArr = Object.values(this.lights);
        lightsArr.forEach(light => this.camera.remove(light));

        if (isOrtho) {
            this.orthoCamera.position.copy(this.camera.position);
            this.orthoCamera.rotation.copy(this.camera.rotation);
            this.camera = this.orthoCamera;
        } else {
            this.perspectiveCamera.position.copy(this.camera.position);
            this.perspectiveCamera.rotation.copy(this.camera.rotation);
            this.camera = this.perspectiveCamera;
        }

        // Add lights to new camera
        lightsArr.forEach(light => this.camera.add(light));

        this.controls.object = this.camera;
        this.controls.update();
    }

    // --- Texture & Skin Utilities ---

    displayTexturePreview(dataUrl) {
        if (!this.ui.texturePreview || !this.ui.downloadBtn) return;

        this.ui.texturePreview.src = dataUrl;
        this.ui.texturePreview.style.display = 'block';

        const dropText = document.querySelector('.drop-text');
        if (dropText) dropText.style.display = 'none';

        this.ui.downloadBtn.href = dataUrl;
        this.ui.downloadBtn.style.display = 'inline-block';
    }

    decodeCapeStr(palStr, dataStr, w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        // Default transparent for Index 0 (A)
        const palArr = palStr ? palStr.split('-') : [];
        const palette = [[0, 0, 0, 0]];

        for (let hex of palArr) {
            if (!hex) continue;
            palette.push([
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16),
                parseInt(hex.substring(6, 8), 16)
            ]);
        }

        let ptr = 0;
        let i = 0;
        while (i < dataStr.length) {
            let char = dataStr[i++];
            let countStr = "";
            while (i < dataStr.length && dataStr[i] >= '0' && dataStr[i] <= '9') {
                countStr += dataStr[i++];
            }
            let count = countStr ? parseInt(countStr) : 1;

            let colorIdx = 0;
            let charCode = char.charCodeAt(0);
            if (charCode >= 65 && charCode <= 90) colorIdx = charCode - 65; // A-Z
            else if (charCode >= 97 && charCode <= 122) colorIdx = charCode - 97 + 26; // a-z

            let color = palette[colorIdx] || [0, 0, 0, 0];
            for (let c = 0; c < count; c++) {
                if (ptr >= data.length) break;
                data[ptr++] = color[0];
                data[ptr++] = color[1];
                data[ptr++] = color[2];
                data[ptr++] = color[3];
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    updateBackgroundColor(canvas) {
        const ctx = canvas.getContext('2d');
        if (canvas.width === 0 || canvas.height === 0) return;

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let maxScore = -1;
        let mostColor = [99, 102, 241];
        let freq = {};

        for (let i = 0; i < imgData.length; i += 4) {
            let r = imgData[i], g = imgData[i + 1], b = imgData[i + 2], a = imgData[i + 3];

            // Avoid pure dark pixels and transparent ones
            if (a > 10 && (r > 20 || g > 20 || b > 20)) {
                let rr = Math.floor(r / 8) * 8;
                let gg = Math.floor(g / 8) * 8;
                let bb = Math.floor(b / 8) * 8;
                let key = `${rr},${gg},${bb}`;

                freq[key] = (freq[key] || 0) + 1;

                let saturation = Math.max(r, g, b) - Math.min(r, g, b);
                let score = freq[key] * (1 + saturation * 0.05);

                if (score > maxScore) {
                    maxScore = score;
                    mostColor = [r, g, b];
                }
            }
        }

        window.currentBgColor = mostColor;
        document.body.style.backgroundImage = `
            radial-gradient(circle at 50% 50%, rgba(${mostColor[0]}, ${mostColor[1]}, ${mostColor[2]}, 0.15) 0%, transparent 60%), 
            radial-gradient(circle at 50% 100%, rgba(${mostColor[0]}, ${mostColor[1]}, ${mostColor[2]}, 0.08) 0%, transparent 50%)
        `;
        document.documentElement.style.setProperty('--toggle-accent', `rgba(${mostColor[0]}, ${mostColor[1]}, ${mostColor[2]}, 0.8)`);
        document.documentElement.style.setProperty('--toggle-accent-bg', `rgba(${mostColor[0]}, ${mostColor[1]}, ${mostColor[2]}, 0.4)`);
    }

    updateCapeTextureCanvas(canvas) {
        if (this.materials.cape.length === 0) return;

        // Inject Canvas to UI Image preview
        this.displayTexturePreview(canvas.toDataURL('image/png'));

        // Setup adaptive halo background
        this.updateBackgroundColor(canvas);

        // Completely renew texture so mapping wrapping can be scaled correctly
        if (this.currentCapeMap) this.currentCapeMap.dispose();

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;

        this.currentCapeMap = texture;

        this.materials.cape.forEach(mat => {
            mat.map = texture;
            mat.needsUpdate = true;
        });

        this.materials.capeEdgeUniforms.forEach(uniforms => {
            if (uniforms.map) uniforms.map.value = texture;
        });
    }

    updateCapeTexture(dataUrl) {
        if (this.materials.cape.length === 0) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            this.updateCapeTextureCanvas(canvas);
        };
        img.src = dataUrl;
    }

    updatePlayerSkin(username) {
        if (!this.materials.player || this.materials.player.length === 0) return;

        if (!username || username.trim() === '') {
            this.materials.player.forEach(mat => {
                mat.map = this.materials.defaultPlayerMap;
                mat.needsUpdate = true;
            });
            this.materials.playerEdgeUniforms.forEach(uniforms => {
                if (uniforms.map) uniforms.map.value = this.materials.defaultPlayerMap;
            });
            return;
        }

        const textureLoader = new THREE.TextureLoader();
        textureLoader.crossOrigin = 'Anonymous';
        textureLoader.load(`https://mc-heads.net/skin/${username}`, (texture) => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.flipY = false;
            texture.colorSpace = THREE.SRGBColorSpace;

            this.materials.player.forEach(mat => {
                mat.map = texture;
                mat.needsUpdate = true;
            });
            this.materials.playerEdgeUniforms.forEach(uniforms => {
                if (uniforms.map) uniforms.map.value = texture;
            });
        });
    }

    onWindowResize() {
        const width = this.ui.container ? this.ui.container.clientWidth : window.innerWidth;
        const height = this.ui.container ? this.ui.container.clientHeight : window.innerHeight;
        const aspect = width / height;

        if (this.perspectiveCamera) {
            this.perspectiveCamera.aspect = aspect;
            this.perspectiveCamera.updateProjectionMatrix();
        }

        if (this.orthoCamera) {
            const frustumSize = 4.0;
            this.orthoCamera.left = (frustumSize * aspect) / -2;
            this.orthoCamera.right = (frustumSize * aspect) / 2;
            this.orthoCamera.top = frustumSize / 2;
            this.orthoCamera.bottom = frustumSize / -2;
            this.orthoCamera.updateProjectionMatrix();
        }

        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }

    animate() {
        requestAnimationFrame(this.animate);
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Initialize Application
new CloakifyApp();
