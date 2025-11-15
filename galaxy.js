import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";

// Configuration
const CONFIG = {
    // Danh sách ảnh của bạn
    photos: [
        'images/photo1.jpg',
        'images/photo2.jpg', 
        'images/photo3.jpg',
        'images/photo4.jpg',
        'images/photo5.jpg',
        'images/photo6.jpg'
        // Thêm nhiều ảnh nếu cần
    ],
    
    // Galaxy parameters
    innerParticles: 50000,
    outerParticles: 100000,
    animationDuration: 5000, // ms cho animation khởi tạo
    
    // Colors
    colors: {
        inner: new THREE.Color(227/255, 155/255, 0),
        outer: new THREE.Color(100/255, 50/255, 255/255)
    }
};

// Global variables
let scene, camera, renderer, controls;
let galaxyPoints, galaxyGeometry, galaxyMaterial;
let particlesData = [];
let animationPhase = 'init';
let startTime = Date.now();
let clock = new THREE.Clock();
let gu = { time: { value: 0 } };
let centralStarClicked = false;

// DOM elements
const welcomeScreen = document.getElementById('welcomeScreen');
const galaxyContainer = document.getElementById('galaxyContainer');
const uiOverlay = document.getElementById('uiOverlay');
const enterBtn = document.getElementById('enterBtn');
const centralStar = document.getElementById('centralStar');
const birthdayMessage = document.getElementById('birthdayMessage');
const bgMusic = document.getElementById('bgMusic');
const particleCountEl = document.querySelector('.count-number');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Enter button click
    enterBtn.addEventListener('click', enterGalaxy);
    
    // Central star click
    centralStar.addEventListener('click', onCentralStarClick);
    
    // Controls
    setupControls();
}

// Enter galaxy animation
function enterGalaxy() {
    // Play music
    bgMusic.volume = 0.3;
    bgMusic.play().catch(e => console.log('Autoplay prevented'));
    
    // Fade out welcome screen
    welcomeScreen.classList.add('fade-out');
    
    setTimeout(() => {
        welcomeScreen.style.display = 'none';
        galaxyContainer.classList.remove('hidden');
        uiOverlay.classList.remove('hidden');
        
        // Initialize Three.js
        initThreeJS();
        createGalaxyParticles();
        animate();
    }, 2000);
}

// Initialize Three.js
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x160016);
    
    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 4, 21);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    galaxyContainer.appendChild(renderer.domElement);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    
    // Window resize
    window.addEventListener('resize', onWindowResize);
}

// Create galaxy particles với animation
function createGalaxyParticles() {
    let sizes = [];
    let shift = [];
    let positions = [];
    let colors = [];
    
    // Helper function
    let pushShift = () => {
        shift.push(
            Math.random() * Math.PI,
            Math.random() * Math.PI * 2,
            (Math.random() * 0.9 + 0.1) * Math.PI * 0.1,
            Math.random() * 0.9 + 0.1
        );
    };
    
    // Inner particles - ban đầu phân tán ngẫu nhiên
    for(let i = 0; i < CONFIG.innerParticles; i++) {
        // Starting position (random)
        let startPos = new THREE.Vector3(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );
        
        // Target position (sphere)
        let targetPos = new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.5 + 9.5);
        
        particlesData.push({
            startPos: startPos,
            targetPos: targetPos,
            currentPos: startPos.clone()
        });
        
        positions.push(startPos.x, startPos.y, startPos.z);
        sizes.push(Math.random() * 1.5 + 0.5);
        pushShift();
        
        // Color
        colors.push(CONFIG.colors.inner.r, CONFIG.colors.inner.g, CONFIG.colors.inner.b);
    }
    
    // Outer particles - dải ngân hà
    for(let i = 0; i < CONFIG.outerParticles; i++) {
        let r = 10, R = 40;
        let rand = Math.pow(Math.random(), 1.5);
        let radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
        
        // Starting position (random)
        let startPos = new THREE.Vector3(
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200
        );
        
        // Target position (galaxy disk)
        let targetPos = new THREE.Vector3().setFromCylindricalCoords(
            radius, 
            Math.random() * 2 * Math.PI, 
            (Math.random() - 0.5) * 2
        );
        
        particlesData.push({
            startPos: startPos,
            targetPos: targetPos,
            currentPos: startPos.clone()
        });
        
        positions.push(startPos.x, startPos.y, startPos.z);
        sizes.push(Math.random() * 1.5 + 0.5);
        pushShift();
        
        // Color gradient
        let d = radius / 40;
        let color = new THREE.Color();
        color.lerpColors(CONFIG.colors.inner, CONFIG.colors.outer, d);
        colors.push(color.r, color.g, color.b);
    }
    
    // Create geometry
    galaxyGeometry = new THREE.BufferGeometry();
    galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    galaxyGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    galaxyGeometry.setAttribute('shift', new THREE.Float32BufferAttribute(shift, 4));
    
    // Create material với shader
    galaxyMaterial = new THREE.PointsMaterial({
        size: 0.125,
        transparent: true,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        onBeforeCompile: shader => {
            shader.uniforms.time = gu.time;
            shader.vertexShader = `
                uniform float time;
                attribute float size;
                attribute vec4 shift;
                varying vec3 vColor;
                ${shader.vertexShader}
            `.replace(
                `gl_PointSize = size;`,
                `gl_PointSize = size * size;`
            ).replace(
                `#include <color_vertex>`,
                `#include <color_vertex>
                vColor = color;`
            ).replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>
                float t = time;
                float moveT = mod(shift.x + shift.z * t, PI2);
                float moveS = mod(shift.y + shift.z * t, PI2);
                transformed += vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.a;`
            );
            
            shader.fragmentShader = `
                varying vec3 vColor;
                ${shader.fragmentShader}
            `.replace(
                `#include <clipping_planes_fragment>`,
                `#include <clipping_planes_fragment>
                float d = length(gl_PointCoord.xy - 0.5);`
            ).replace(
                `vec4 diffuseColor = vec4( diffuse, opacity );`,
                `vec4 diffuseColor = vec4( vColor, smoothstep(0.5, 0.1, d) );`
            );
        }
    });
    
    // Create points
    galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxyPoints.rotation.order = "ZYX";
    galaxyPoints.rotation.z = 0.2;
    scene.add(galaxyPoints);
    
    // Update particle count
    particleCountEl.textContent = (CONFIG.innerParticles + CONFIG.outerParticles).toLocaleString();
    
    // Start formation animation
    animationPhase = 'forming';
    startTime = Date.now();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Time
    let t = clock.getElapsedTime() * 0.5;
    gu.time.value = t * Math.PI;
    
    // Formation animation
    if(animationPhase === 'forming') {
        let elapsed = Date.now() - startTime;
        let progress = Math.min(elapsed / CONFIG.animationDuration, 1);
        
        // Easing function
        progress = easeInOutCubic(progress);
        
        // Update particle positions
        let positions = galaxyGeometry.attributes.position.array;
        for(let i = 0; i < particlesData.length; i++) {
            let particle = particlesData[i];
            let i3 = i * 3;
            
            // Lerp from start to target
            positions[i3] = particle.startPos.x + (particle.targetPos.x - particle.startPos.x) * progress;
            positions[i3 + 1] = particle.startPos.y + (particle.targetPos.y - particle.startPos.y) * progress;
            positions[i3 + 2] = particle.startPos.z + (particle.targetPos.z - particle.startPos.z) * progress;
        }
        galaxyGeometry.attributes.position.needsUpdate = true;
        
        if(progress >= 1) {
            animationPhase = 'complete';
        }
    }
    
    // Rotate galaxy
    if(galaxyPoints) {
        galaxyPoints.rotation.y = t * 0.05;
    }
    
    // Render
    renderer.render(scene, camera);
}

// Easing function
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Central star click handler
function onCentralStarClick() {
    if(centralStarClicked) return;
    centralStarClicked = true;
    
    // Hide star
    centralStar.style.display = 'none';
    
    // Create photo orbits
    createPhotoOrbits();
    
    // Show birthday message
    setTimeout(() => {
        birthdayMessage.classList.remove('hidden');
        createConfetti();
    }, 2000);
}

// Create photo orbits
function createPhotoOrbits() {
    const container = document.getElementById('photoOrbit');
    
    CONFIG.photos.forEach((photo, index) => {
        const photoEl = document.createElement('div');
        photoEl.className = 'orbital-photo';
        photoEl.style.animationDelay = `${index * 2}s`;
        photoEl.style.animationDuration = `${20 + index * 3}s`;
        
        const img = document.createElement('img');
        img.src = photo;
        photoEl.appendChild(img);
        
        container.appendChild(photoEl);
        
        // Fade in
        setTimeout(() => {
            photoEl.style.opacity = '1';
        }, index * 200);
    });
}

// Create confetti effect
function createConfetti() {
    const colors = ['#fc0', '#c0f', '#e39b00', '#fff'];
    
    for(let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * window.innerWidth + 'px';
        confetti.style.top = '-20px';
        confetti.style.zIndex = '200';
        confetti.style.borderRadius = '50%';
        confetti.style.pointerEvents = 'none';
        document.body.appendChild(confetti);
        
        // Animate
        let posY = -20;
        let posX = parseFloat(confetti.style.left);
        let velocityY = Math.random() * 5 + 3;
        let velocityX = (Math.random() - 0.5) * 2;
        
        const fall = setInterval(() => {
            posY += velocityY;
            posX += velocityX;
            confetti.style.top = posY + 'px';
            confetti.style.left = posX + 'px';
            confetti.style.transform = `rotate(${posY * 2}deg)`;
            
            if(posY > window.innerHeight) {
                clearInterval(fall);
                confetti.remove();
            }
        }, 20);
    }
}

// Setup controls
function setupControls() {
    // Music toggle
    document.getElementById('musicToggle')?.addEventListener('click', function() {
        if(bgMusic.paused) {
            bgMusic.play();
            this.classList.add('active');
        } else {
            bgMusic.pause();
            this.classList.remove('active');
        }
    });
    
    // Rotate toggle
    document.getElementById('rotateToggle')?.addEventListener('click', function() {
        controls.autoRotate = !controls.autoRotate;
        this.classList.toggle('active');
    });
    
    // Fullscreen toggle
    document.getElementById('fullscreenToggle')?.addEventListener('click', () => {
        if(!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });
}

// Window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}