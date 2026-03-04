import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xwqrrppnolqznrawhwsc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3cXJycHBub2xxem5yYXdod3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDYwOTcsImV4cCI6MjA4ODIyMjA5N30.U_hjMsT1jTe8nefgmPH8KbWFQ3TAmxAaHAKlz6ejjU8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class CloakifyApp {
    constructor() {
        this.galleryCapes = [];

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

        // Animation properties
        this.clock = new THREE.Clock();
        this.capeMeshesToAnimate = [];
        this.capeBbox = null;
        this.capeHeight = 1;
        this.capeAnimationConfig = {
            active: false,
            amplitude: 0.15, // max displacement
            speed: 2.0,      // wave speed
            frequency: 3.0   // waves along height
        };

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
            capeAnimToggle: document.getElementById('cape-anim-toggle'),
            hqToggle: document.getElementById('hq-toggle'),
            shareLinkBtn: document.getElementById('share-link-btn'),
            fileInput: document.getElementById('file-input'),

            // Modal Elements
            publishModal: document.getElementById('publish-modal'),
            modalForm: document.getElementById('modal-form'),
            modalResult: document.getElementById('modal-result'),
            creatorNameInput: document.getElementById('creator-name-input'),
            capeNameInput: document.getElementById('cape-name-input'),
            capeTagsInput: document.getElementById('cape-tags-input'),
            modalSubmitBtn: document.getElementById('modal-submit-btn'),
            shareLinkResult: document.getElementById('share-link-result'),
            modalCopyBtn: document.getElementById('modal-copy-btn'),
            modalCloseBtn: document.getElementById('modal-close-btn'),
            modalCancelBtn: document.getElementById('modal-cancel-btn'),

            // Gallery Elements
            galleryBtn: document.getElementById('gallery-btn'),
            galleryModal: document.getElementById('gallery-modal'),
            galleryCloseBtn: document.getElementById('gallery-close-btn'),
            gallerySearch: document.getElementById('gallery-search'),
            galleryFilter: document.getElementById('gallery-filter'),
            galleryGrid: document.getElementById('gallery-grid'),
            galleryLoading: document.getElementById('gallery-loading')
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

        setTimeout(() => this.startOnboarding(), 1000);
    }

    startOnboarding() {
        if (localStorage.getItem('cloakify_onboarding_done')) return;

        const blocker = document.createElement('div');
        blocker.id = 'onboarding-blocker';
        document.body.appendChild(blocker);

        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        document.body.appendChild(overlay);

        const tooltip = document.createElement('div');
        tooltip.id = 'onboarding-tooltip';
        document.body.appendChild(tooltip);

        const steps = [
            {
                target: '#texture-panel',
                title: 'Design & Upload',
                text: 'Drag & drop your Minecraft cape texture here to preview it instantly in 3D.',
                position: 'right'
            },
            {
                target: '#download-addon-btn',
                title: 'Aseprite Integration',
                text: 'Enhance your workflow by downloading our official extension for live syncing!',
                position: 'bottom'
            },
            {
                target: '.input-group',
                title: 'Your Character',
                text: 'Type your Minecraft username to load your personal skin directly.',
                position: 'bottom'
            },
            {
                target: '#gallery-btn',
                title: 'Community Gallery',
                text: 'Discover capes created by other talented pixel-artists, or showcase your own!',
                position: 'bottom'
            }
        ];

        let currentStep = 0;

        const renderStep = () => {
            if (currentStep >= steps.length) {
                this.closeOnboarding(overlay, tooltip, blocker);
                return;
            }

            const step = steps[currentStep];
            const targetEl = document.querySelector(step.target);
            if (!targetEl) {
                currentStep++;
                renderStep();
                return;
            }

            // Spotlight
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Ensure it's in view

            setTimeout(() => {
                const rect = targetEl.getBoundingClientRect();
                overlay.style.top = (rect.top - 8) + 'px';
                overlay.style.left = (rect.left - 8) + 'px';
                overlay.style.width = (rect.width + 16) + 'px';
                overlay.style.height = (rect.height + 16) + 'px';
                overlay.style.opacity = '1';

                // Reset tooltip
                tooltip.classList.remove('active');

                setTimeout(() => {
                    tooltip.innerHTML = `
                        <h3>${step.title}</h3>
                        <p>${step.text}</p>
                        <div class="onboarding-actions">
                            <button class="onboarding-btn" id="ob-skip">Skip</button>
                            <button class="onboarding-btn onboarding-btn-primary" id="ob-next">${currentStep === steps.length - 1 ? 'Finish' : 'Next'}</button>
                        </div>
                    `;

                    document.getElementById('ob-skip').onclick = () => this.closeOnboarding(overlay, tooltip, blocker);
                    document.getElementById('ob-next').onclick = () => {
                        currentStep++;
                        renderStep();
                    };

                    const ttRect = tooltip.getBoundingClientRect();
                    let top, left;

                    if (step.position === 'right') {
                        left = rect.right + 20;
                        top = rect.top + (rect.height / 2) - (ttRect.height / 2);
                        // Avoid overlap horizontally if out of bounds
                        if (left + ttRect.width > window.innerWidth - 20) {
                            left = rect.left - ttRect.width - 20;
                            // If it still overlaps or is out of bounds, fallback to bottom
                            if (left < 10) {
                                left = rect.left + (rect.width / 2) - (ttRect.width / 2);
                                top = rect.bottom + 20;
                            }
                        }
                    } else if (step.position === 'bottom') {
                        top = rect.bottom + 20;
                        left = rect.left + (rect.width / 2) - (ttRect.width / 2);
                        // Avoid overlap vertically
                        if (top + ttRect.height > window.innerHeight - 20) {
                            top = rect.top - ttRect.height - 20;
                        }
                    }

                    // Strict bounds checking as last resort
                    if (top < 10) top = 10;
                    if (left < 10) left = 10;
                    if (left + ttRect.width > window.innerWidth - 10) left = window.innerWidth - ttRect.width - 10;
                    if (top + ttRect.height > window.innerHeight - 10) top = window.innerHeight - ttRect.height - 10;

                    tooltip.style.top = top + 'px';
                    tooltip.style.left = left + 'px';
                    tooltip.classList.add('active');
                }, 200); // Wait for spot transition
            }, 300); // Wait for scroll
        };

        renderStep();
    }

    closeOnboarding(overlay, tooltip, blocker) {
        localStorage.setItem('cloakify_onboarding_done', 'true');
        overlay.style.opacity = '0';
        tooltip.style.opacity = '0';
        setTimeout(() => {
            blocker.remove();
            overlay.remove();
            tooltip.remove();
        }, 500);
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

            this.setupCapeAnimationMeshes();

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

        // 1. Check for short link ID first
        const shortId = urlParams.get('c');
        if (shortId) {
            this.setPublishButtonState(true);
            this.fetchFromShortId(shortId);
            // Handle username if present
            if (this.ui.usernameInput && this.ui.usernameInput.value) {
                this.updatePlayerSkin(this.ui.usernameInput.value);
            }
            return; // Wait for fetch before updating player skin later if needed, or done.
        }

        this.setPublishButtonState(false);

        // 2. Fallback to long URL parameters
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

    setPublishButtonState(disabled) {
        if (!this.ui.shareLinkBtn) return;
        this.ui.shareLinkBtn.disabled = disabled;
        this.ui.shareLinkBtn.style.opacity = disabled ? '0.5' : '1';
        this.ui.shareLinkBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        this.ui.shareLinkBtn.title = disabled ? "This cape is already in the gallery!" : "";
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

        if (this.ui.shareLinkBtn) {
            this.ui.shareLinkBtn.addEventListener('click', this.openPublishModal.bind(this));
        }

        // Modal Events
        if (this.ui.modalCancelBtn) this.ui.modalCancelBtn.addEventListener('click', this.closePublishModal.bind(this));
        if (this.ui.modalCloseBtn) this.ui.modalCloseBtn.addEventListener('click', this.closePublishModal.bind(this));
        if (this.ui.modalSubmitBtn) this.ui.modalSubmitBtn.addEventListener('click', this.generateShareLink.bind(this));
        if (this.ui.modalCopyBtn) {
            this.ui.modalCopyBtn.addEventListener('click', () => {
                const url = this.ui.shareLinkResult.value;
                navigator.clipboard.writeText(url).then(() => {
                    const originalText = this.ui.modalCopyBtn.innerText;
                    this.ui.modalCopyBtn.innerText = "Copied!";
                    setTimeout(() => { this.ui.modalCopyBtn.innerText = originalText; }, 2000);
                });
            });
        }

        // Gallery Events
        if (this.ui.galleryBtn) this.ui.galleryBtn.addEventListener('click', this.openGalleryModal.bind(this));
        if (this.ui.galleryCloseBtn) this.ui.galleryCloseBtn.addEventListener('click', this.closeGalleryModal.bind(this));
        if (this.ui.gallerySearch) this.ui.gallerySearch.addEventListener('input', this.renderGallery.bind(this));
        if (this.ui.galleryFilter) this.ui.galleryFilter.addEventListener('change', this.renderGallery.bind(this));

        // Click outside modals to close them
        window.addEventListener('click', (e) => {
            if (e.target === this.ui.publishModal) this.closePublishModal();
            if (e.target === this.ui.galleryModal) this.closeGalleryModal();
        });

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

        if (this.ui.capeAnimToggle) {
            this.ui.capeAnimToggle.addEventListener('change', (e) => {
                this.capeAnimationConfig.active = e.target.checked;
                if (!this.capeAnimationConfig.active) {
                    this.resetCapeAnimation();
                }
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
                        reader.onload = (event) => {
                            this.updateCapeTexture(event.target.result);
                            this.setPublishButtonState(false);
                            const newUrl = new URL(window.location.href);
                            newUrl.searchParams.delete('c');
                            window.history.pushState(null, '', newUrl.toString());
                        };
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
                    reader.onload = (event) => {
                        this.updateCapeTexture(event.target.result);
                        this.setPublishButtonState(false);
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('c');
                        window.history.pushState(null, '', newUrl.toString());
                    };
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
        document.documentElement.style.setProperty('--toggle-accent-rgb', `${mostColor[0]}, ${mostColor[1]}, ${mostColor[2]}`);
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

        const time = this.clock ? this.clock.getElapsedTime() : 0;
        if (this.capeAnimationConfig && this.capeAnimationConfig.active) {
            this.updateCapeAnimation(time);
        }

        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // --- API & Sharing Mock ---

    openPublishModal() {
        if (!this.currentCapeMap || !this.currentCapeMap.image) {
            alert("Please load a cape texture first.");
            return;
        }
        this.ui.publishModal.style.display = 'flex';
        this.ui.modalForm.style.display = 'flex';
        this.ui.modalResult.style.display = 'none';
        this.ui.capeNameInput.value = '';
        this.ui.creatorNameInput.value = '';
        this.ui.capeTagsInput.value = '';
    }

    closePublishModal() {
        this.ui.publishModal.style.display = 'none';
    }

    // --- Gallery Logic ---
    async openGalleryModal() {
        this.ui.galleryModal.style.display = 'flex';
        this.ui.galleryLoading.style.display = 'block';
        this.ui.galleryGrid.innerHTML = ''; // clear previous

        try {
            const { data, error } = await supabase
                .from('capes')
                .select('created_at, creator_name, cape_name, js_slug, img_data, tags')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.galleryCapes = data || [];
        } catch (error) {
            console.error(error);
            alert("Erreur lors du chargement de la galerie.");
        } finally {
            this.ui.galleryLoading.style.display = 'none';
            this.renderGallery();
        }
    }

    closeGalleryModal() {
        this.ui.galleryModal.style.display = 'none';
    }

    renderGallery() {
        const query = (this.ui.gallerySearch.value || "").toLowerCase().trim();
        const filter = this.ui.galleryFilter.value || "newest";

        // Filter
        let filtered = this.galleryCapes.filter(cape => {
            const cName = cape.cape_name.toLowerCase();
            const crName = cape.creator_name.toLowerCase();
            const tags = (cape.tags || []).join(" ").toLowerCase();
            return cName.includes(query) || crName.includes(query) || tags.includes(query);
        });

        // Sort
        if (filter === "oldest") {
            filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else {
            // "newest" defaults since Supabase already sends it sorted, but let's be sure
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        this.ui.galleryGrid.innerHTML = '';

        if (filtered.length === 0) {
            this.ui.galleryGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No capes found.</div>';
            return;
        }

        filtered.forEach(cape => {
            const card = document.createElement('div');
            card.className = 'cape-card';
            card.onclick = () => {
                this.setPublishButtonState(true);
                this.updateCapeTexture(cape.img_data);
                const newUrl = new URL(window.location.href);
                newUrl.search = "?c=" + cape.js_slug;
                window.history.pushState(null, '', newUrl.toString());
                this.closeGalleryModal();
            };

            const imgContainer = document.createElement('div');
            imgContainer.className = 'cape-card-img-container';
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'cape-card-img';
            canvasWrapper.style.display = 'flex';
            canvasWrapper.style.alignItems = 'center';
            canvasWrapper.style.justifyContent = 'center';

            const tempImg = new Image();
            tempImg.onload = () => {
                // Generate Isometric Render (Higher resolution internally for crispness)
                const isoCanvas = this.renderIsometricCape(tempImg, 250, 250);
                isoCanvas.style.width = '100%';
                isoCanvas.style.height = '100%';
                isoCanvas.style.objectFit = 'contain';
                canvasWrapper.appendChild(isoCanvas);
                imgContainer.appendChild(canvasWrapper);

                // Set resolution text
                resBadge.innerText = Math.max(16, tempImg.width / 4) + 'x';

                // Fetch dominant color for background glowing effect
                const canvas = document.createElement('canvas');
                canvas.width = tempImg.width;
                canvas.height = tempImg.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0);
                const data = ctx.getImageData(0, 0, tempImg.width, tempImg.height).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 0) { // Not transparent
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        count++;
                    }
                }
                if (count > 0) {
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);
                    imgContainer.style.backgroundImage = `radial-gradient(circle, rgba(${r},${g},${b},0.4) 0%, rgba(0,0,0,0.4) 100%)`;
                    imgContainer.dataset.rgb = `${r},${g},${b}`; // Store for hover state
                }
            };
            tempImg.src = cape.img_data;

            const info = document.createElement('div');
            info.className = 'cape-card-info';

            const title = document.createElement('h4');
            title.innerText = cape.cape_name;

            const creatorContainer = document.createElement('div');
            creatorContainer.style.display = 'flex';
            creatorContainer.style.justifyContent = 'space-between';
            creatorContainer.style.alignItems = 'center';

            const creator = document.createElement('p');
            creator.innerText = "by " + cape.creator_name;

            const resBadge = document.createElement('span');
            resBadge.style.fontSize = '10px';
            resBadge.style.color = 'rgba(255,255,255,0.4)';
            resBadge.style.background = 'rgba(255,255,255,0.05)';
            resBadge.style.padding = '2px 6px';
            resBadge.style.borderRadius = '4px';
            resBadge.innerText = '...';

            creatorContainer.appendChild(creator);
            creatorContainer.appendChild(resBadge);

            info.appendChild(title);
            info.appendChild(creatorContainer);

            // Tags
            if (cape.tags && cape.tags.length > 0) {
                const tagsCont = document.createElement('div');
                tagsCont.className = 'cape-card-tags';
                cape.tags.forEach(t => {
                    const tg = document.createElement('span');
                    tg.className = 'cape-card-tag';
                    tg.innerText = t;
                    tagsCont.appendChild(tg);
                });
                info.appendChild(tagsCont);
            }

            card.appendChild(imgContainer);
            card.appendChild(info);

            // 3D Hover Effect
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -7; // Reduced max deg for subtlety
                const rotateY = ((x - centerX) / centerX) * 7;

                card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

                // Si on a extrait la couleur du fond
                if (imgContainer.dataset.rgb) {
                    card.style.borderColor = `rgba(${imgContainer.dataset.rgb}, 0.8)`;
                } else {
                    card.style.borderColor = `var(--toggle-accent)`;
                }
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
                card.style.borderColor = `rgba(255, 255, 255, 0.08)`;
            });

            this.ui.galleryGrid.appendChild(card);
        });
    }

    // Render isométrique type Aseprite pour la galerie
    renderIsometricCape(imgElement, outW, outH) {
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const off = document.createElement('canvas');
        off.width = imgElement.naturalWidth || 64;
        off.height = imgElement.naturalHeight || 32;
        const offCtx = off.getContext('2d');
        offCtx.drawImage(imgElement, 0, 0);
        const imgData = offCtx.getImageData(0, 0, off.width, off.height).data;

        const getCol = (px, py) => {
            if (px < 0 || py < 0 || px >= off.width || py >= off.height) return null;
            const idx = (Math.floor(py) * off.width + Math.floor(px)) * 4;
            if (imgData[idx + 3] === 0) return null;
            return `rgba(${imgData[idx]}, ${imgData[idx + 1]}, ${imgData[idx + 2]}, ${imgData[idx + 3] / 255})`;
        };

        const scale = off.width / 64;
        const W = 10 * scale;
        const H = 16 * scale;
        const D = 1 * scale;

        // Offset coords mapping the standard MC cape texture
        const topX = 1 * scale; const topY = 0;
        const rightX = 11 * scale; const rightY = 1 * scale;
        const frontX = 1 * scale; const frontY = 1 * scale;

        // Auto-scale to fit canvas and center perfectly
        const s = Math.min((outW * 0.8) / (W + D), (outH * 0.8) / (H + (W + D) * 0.5));

        const totalW = (W + D) * s;
        const totalH = (H + (W + D) * 0.5) * s;

        const offsetX = (outW - totalW) / 2 + (D * s);
        const offsetY = (outH - totalH) / 2;

        const prj = (vx, vy, vz) => {
            const sx = (vx - vz) * s;
            const sy = (vx + vz) * 0.5 * s + vy * s;
            return { x: offsetX + sx, y: offsetY + sy };
        };

        const drawVoxel = (x, y, z, face, color) => {
            let pts = [];
            if (face === 'Top') pts = [prj(x, y, z), prj(x + 1, y, z), prj(x + 1, y, z + 1), prj(x, y, z + 1)];
            else if (face === 'Right') pts = [prj(x + 1, y, z), prj(x + 1, y, z + 1), prj(x + 1, y + 1, z + 1), prj(x + 1, y + 1, z)];
            else if (face === 'Front') pts = [prj(x, y, z + 1), prj(x + 1, y, z + 1), prj(x + 1, y + 1, z + 1), prj(x, y + 1, z + 1)];

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        };

        for (let z = 0; z < D; z++) {
            for (let x = 0; x < W; x++) {
                // Correct vertical mapping for Top Face
                const c = getCol(topX + x, topY + z);
                if (c) drawVoxel(x, 0, z, 'Top', c);
            }
        }
        for (let z = 0; z < D; z++) {
            for (let y = 0; y < H; y++) {
                // Correct horizontal mapping for Right Face (Character's left arm, texture at x=11..11)
                const c = getCol(rightX + (D - 1 - z), rightY + y);
                if (c) drawVoxel(W - 1, y, z, 'Right', c);
            }
        }
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const c = getCol(frontX + x, frontY + y);
                if (c) drawVoxel(x, y, D - 1, 'Front', c);
            }
        }

        return canvas;
    }

    // Fonction utilitaire pour créer le slug (ex: "Red Oni" -> "red-oni")
    slugify(text) {
        return text.toString().toLowerCase().trim()
            .replace(/\s+/g, '-')           // Remplace les espaces par -
            .replace(/[^\w\-]+/g, '')       // Retire les caractères non-alphanumériques
            .replace(/\-\-+/g, '-');        // Retire les - multiples
    }

    async generateShareLink() {
        const capeName = this.ui.capeNameInput.value.trim();
        const creatorName = this.ui.creatorNameInput.value.trim();

        // Parsing des tags
        const tagsRaw = this.ui.capeTagsInput.value;
        const tagsArray = tagsRaw.split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0)
            .slice(0, 3); // Garder les 3 premiers uniquement

        if (!capeName || !creatorName) {
            alert("Please provide both a Creator Name and a Cape Name.");
            return;
        }

        let baseSlug = this.slugify(capeName);
        if (!baseSlug) baseSlug = "cape";

        const originalText = this.ui.modalSubmitBtn.innerText;
        this.ui.modalSubmitBtn.innerText = "Publishing...";
        this.ui.modalSubmitBtn.disabled = true;

        const canvas = this.currentCapeMap.image;
        const base64Data = canvas.toDataURL('image/png');

        if (SUPABASE_URL === 'VOTRE_URL_SUPABASE') {
            alert("Vous devez configurer SUPABASE_URL et SUPABASE_ANON_KEY en haut du fichier app.js !");
            this.ui.modalSubmitBtn.innerText = originalText;
            this.ui.modalSubmitBtn.disabled = false;
            return;
        }

        // --- SÉCURITÉ 1 : Rate Limit Côté Client (Anti-Spam Rapide) ---
        const lastPublishTime = localStorage.getItem('cloakify_last_publish');
        const now = Date.now();
        if (lastPublishTime && (now - parseInt(lastPublishTime)) < 60000) { // 60 secondes d'attente
            alert("Veuillez patienter un instant avant de publier une nouvelle cape.");
            this.ui.modalSubmitBtn.innerText = originalText;
            this.ui.modalSubmitBtn.disabled = false;
            return;
        }

        try {
            // --- SÉCURITÉ 2 : Dé-duplication de base64 ---
            // On vérifie si la cape (les pixels exacts) existe DÉJÀ dans la base
            // Si c'est le cas, on retourne directement le lien existant au lieu de dupliquer la ligne.
            const { data: existingCape, error: existingError } = await supabase
                .from('capes')
                .select('js_slug')
                .eq('img_data', base64Data)
                .limit(1)
                .single();

            if (existingCape) {
                // La cape existe déjà ! On simule un succès et on renvoie le lient de la cape existante
                const currentUrl = new URL(window.location.href);
                currentUrl.search = "?c=" + existingCape.js_slug;

                this.ui.modalForm.style.display = 'none';
                this.ui.modalResult.style.display = 'block';
                this.ui.shareLinkResult.value = currentUrl.toString();

                // Mettre à jour l'anti-spam quand même pour éviter le martelage
                localStorage.setItem('cloakify_last_publish', now.toString());

                this.ui.modalSubmitBtn.innerText = originalText;
                this.ui.modalSubmitBtn.disabled = false;
                return;
            }

            let isUnique = false;
            let finalSlug = baseSlug;
            let attempts = 0;

            // Vérification de l'unicité du slug
            while (!isUnique && attempts < 10) {
                const { data, error } = await supabase
                    .from('capes')
                    .select('js_slug')
                    .eq('js_slug', finalSlug)
                    .single();

                if (data) {
                    // Slug déjà existant : on ajoute un identifiant aléatoire
                    finalSlug = baseSlug + "-" + Math.floor(Math.random() * 10000);
                    attempts++;
                } else if (error && error.code === 'PGRST116') {
                    // L'erreur 'PGRST116' indique que 0 ligne a été retournée (donc le slug est libre, parfait !)
                    isUnique = true;
                } else if (error) {
                    throw error;
                }
            }

            const { error: insertError } = await supabase
                .from('capes')
                .insert([{
                    creator_name: creatorName,
                    cape_name: capeName,
                    js_slug: finalSlug,
                    img_data: base64Data,
                    tags: tagsArray
                }]);

            if (insertError) throw insertError;

            // Générer l'URL finale pour le client
            const currentUrl = new URL(window.location.href);
            currentUrl.search = "?c=" + finalSlug;

            this.ui.modalForm.style.display = 'none';
            this.ui.modalResult.style.display = 'block';
            this.ui.shareLinkResult.value = currentUrl.toString();

            // Mémoriser l'heure de publication pour l'Anti-spam local
            localStorage.setItem('cloakify_last_publish', Date.now().toString());

        } catch (error) {
            console.error(error);
            alert("Erreur lors de la publication de la cape : " + error.message);
        } finally {
            this.ui.modalSubmitBtn.innerText = originalText;
            this.ui.modalSubmitBtn.disabled = false;
        }
    }

    async fetchFromShortId(shortId) {
        if (SUPABASE_URL === 'VOTRE_URL_SUPABASE') {
            console.warn("Supabase non-configuré, passage de la récupération.");
            return;
        }

        try {
            const { data, error } = await supabase
                .from('capes')
                .select('img_data')
                .eq('js_slug', shortId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') throw new Error("Cette cape n'existe pas ou le lien est invalide.");
                throw error;
            }

            if (data && data.img_data) {
                this.updateCapeTexture(data.img_data);
            }
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    setupCapeAnimationMeshes() {
        this.capeMeshesToAnimate = [];
        let capeMesh = null;

        this.models.cape.traverse(child => {
            if (child.isMesh && child.name === '16x') {
                capeMesh = child;
            }
        });

        if (!capeMesh) return;

        capeMesh.geometry.computeBoundingBox();
        this.capeBbox = capeMesh.geometry.boundingBox.clone();
        this.capeHeight = this.capeBbox.max.y - this.capeBbox.min.y;
        if (this.capeHeight === 0) this.capeHeight = 1;

        const addMeshForAnim = (mesh, isCape) => {
            if (mesh.geometry && mesh.geometry.attributes.position) {
                this.capeMeshesToAnimate.push({
                    mesh: mesh,
                    origPos: mesh.geometry.attributes.position.clone(),
                    isCape: isCape
                });
            }
        };

        addMeshForAnim(capeMesh, true);

        capeMesh.children.forEach(child => {
            if (child.isLineSegments || child.isLine) {
                addMeshForAnim(child, false);
            }
        });
    }

    updateCapeAnimation(time) {
        const { amplitude, speed, frequency } = this.capeAnimationConfig;

        this.capeMeshesToAnimate.forEach(item => {
            const posAttr = item.mesh.geometry.attributes.position;
            const origPos = item.origPos;

            for (let i = 0; i < posAttr.count; i++) {
                const ox = origPos.getX(i);
                const oy = origPos.getY(i);
                const oz = origPos.getZ(i);

                // Normalise Y de 0 (haut) à 1 (bas)
                const normalizeY = (this.capeBbox.max.y - oy) / this.capeHeight;
                const nY = Math.max(0, Math.min(1, normalizeY));

                // Mouvement sinusoïdal
                const waveOffset = Math.sin(time * speed - nY * frequency) * amplitude * nY;

                posAttr.setZ(i, oz + waveOffset);
            }
            posAttr.needsUpdate = true;

            if (item.isCape) {
                // Seulement pour le maillage principal pour la lumière
                item.mesh.geometry.computeVertexNormals();
            }
        });
    }

    resetCapeAnimation() {
        this.capeMeshesToAnimate.forEach(item => {
            const posAttr = item.mesh.geometry.attributes.position;
            const origPos = item.origPos;

            for (let i = 0; i < posAttr.count; i++) {
                posAttr.setZ(i, origPos.getZ(i));
            }
            posAttr.needsUpdate = true;

            if (item.isCape) {
                item.mesh.geometry.computeVertexNormals();
            }
        });
    }
}

// Initialize Application
new CloakifyApp();
