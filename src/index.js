/* jshint node: true */
/* globals THREE */

window.THREE = require("three");

let scene, renderer, camera, clock, width, height, video;
let particles, videoWidth, videoHeight;
let offset = {
    value: 1.5,
};

// audio
let audio, analyser;
const fftSize = 2048;  // https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize
const frequencyRange = {
    bass: [20, 140],
    lowMid: [140, 400],
    mid: [400, 2600],
    highMid: [2600, 5200],
    treble: [5200, 14000],
};

const init = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    renderer = new THREE.WebGLRenderer();
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    initCamera();

    onResize();

    if (hasGetUserMedia()) {
        initVideo();
        initAudio();
    } else {
        showAlert();
    }
};

const initCamera = () => {
    const fov = 45;
    const aspect = width / height;

    camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 10000);
    const z = Math.min(window.innerWidth, window.innerHeight);
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, 0);

    scene.add(camera);
};

const initVideo = () => {
    video = document.getElementById("video");
    video.autoplay = true;

    const option = {
        video: true,
        audio: false
    };
    navigator.getUserMedia(option, (stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            videoWidth = video.videoWidth;
            videoHeight = video.videoHeight;

            createParticles();
            draw();
        });
    }, (error) => {
        console.log(error);
        showAlert();
    });
};

const initAudio = () => {
    const audioListener = new THREE.AudioListener();
    audio = new THREE.Audio(audioListener);

    const audioLoader = new THREE.AudioLoader();
    // https://www.newgrounds.com/audio/listen/872056
    audioLoader.load('asset/872056_Above-the-clouds.mp3', (buffer) => {
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(0.5);
        audio.play();
    });

    analyser = new THREE.AudioAnalyser(audio, fftSize);

    document.body.addEventListener('click', function () {
        if (audio) {
            if (audio.isPlaying) {
                audio.pause();
            } else {
                audio.play();
            }
        }
    });
};

const createParticles = () => {
    const imageData = getImageData(video);
    const geometry = new THREE.Geometry();
    geometry.morphAttributes = {};  // This is necessary to avoid error.
    const material = new THREE.PointsMaterial({
        size: 1,
        color: 0x66eedd,
        sizeAttenuation: false
    });

    for (let y = 0, height = imageData.height; y < height; y += 1) {
        for (let x = 0, width = imageData.width; x < width; x += 1) {
            const vertex = new THREE.Vector3(
                x - imageData.width / 2,
                -y + imageData.height / 2,
                0
            );
            geometry.vertices.push(vertex);
        }
    }

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
};

const getImageData = (image) => {
    const canvas = document.createElement("canvas");
    const w = image.videoWidth;
    const h = image.videoHeight;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");

    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(image, 0, 0);

    return ctx.getImageData(0, 0, w, h);
};

let max = -1;
let min = -1;

const map = (value, beforeMin, beforeMax, afterMin, afterMax) => {
    return afterMin + (afterMax - afterMin) * ((value - beforeMin) / (beforeMax - beforeMin));
};

/**
 * https://github.com/processing/p5.js-sound/blob/v0.14/lib/p5.sound.js#L1765
 *
 * @param data
 * @param _frequencyRange
 * @returns {number} 0.0 ~ 1.0
 */
const getFrequencyRangeValue = (data, _frequencyRange) => {
    const nyquist = 48000 / 2;
    const lowIndex = Math.round(_frequencyRange[0] / nyquist * data.length);
    const highIndex = Math.round(_frequencyRange[1] / nyquist * data.length);
    let total = 0;
    let numFrequencies = 0;

    for (let i = lowIndex; i <= highIndex; i++) {
        total += data[i];
        numFrequencies += 1;
    }
    return total / numFrequencies / 255;
};

const draw = () => {
    clock.getDelta();
    const time = clock.elapsedTime;

    let r, g, b;

    // audio
    if (analyser) {
        // analyser.getFrequencyData() would be an array with a size of half of fftSize.
        const data = analyser.getFrequencyData();

        const freq = analyser.getAverageFrequency() / 255;
        const bass = getFrequencyRangeValue(data, frequencyRange.bass);
        const mid = getFrequencyRangeValue(data, frequencyRange.mid);
        const treble = getFrequencyRangeValue(data, frequencyRange.treble);

        r = bass;
        g = mid;
        b = treble;

        if (max < 0) {
            max = freq;
        } else if (freq > max) {
            max = freq;
        }
        if (min < 0) {
            min = freq;
        } else if (freq < min) {
            min = freq;
        }

        offset.value = map(freq, min, max, 0.1, 0.5);
    }

    // video
    if (particles) {
        particles.material.color.r = 1 - r;
        particles.material.color.g = 1 - g;
        particles.material.color.b = 1 - b;

        const density = 1;
        const imageData = getImageData(video);
        for (let i = 0, length = particles.geometry.vertices.length; i < length; i++) {
            const particle = particles.geometry.vertices[i];
            if (i % density !== 0) {
                particle.z = 1000;
                continue;
            }
            let index = i * 4;
            let gray = (imageData.data[index] + imageData.data[index + 1] + imageData.data[index + 2]) / 3;
            let threshold = 300;
            if (gray < threshold) {
                if (gray < threshold / 3) {
                    particle.z = gray * r * 5;

                } else if (gray < threshold / 2) {
                    particle.z = gray * g * 5;

                } else {
                    particle.z = gray * b * 5;
                }
            } else {
                particle.z = 10000;
            }
        }
        particles.geometry.verticesNeedUpdate = true;
    }

    // const t2 = time * 0.5;
    // camera.position.x = 100 * Math.cos(t2);
    // camera.position.y = 100 * Math.sin(t2);
    // camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer.render(scene, camera);

    requestAnimationFrame(draw);
};

const showAlert = () => {
    document.getElementById("message").classList.remove("hidden");
};

const hasGetUserMedia = () => {
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
};

const onResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
};

window.addEventListener("resize", onResize);

init();
