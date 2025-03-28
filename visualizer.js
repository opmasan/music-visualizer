let audioContext;
let analyser;
let canvas;
let ctx;
let dataArray;
let particles = [];
let hueRotation = 0;
let sensitivity = 2.5; // Збільшено з 1.5 до 2.5
let lastBeat = 0;
let beatThreshold = 120; // Зменшено з 150 до 120 для більш частого спрацювування
let colorOffset = 0;
let bassMultiplier = 2.0; // Новий множник для басів

// Додаємо нові змінні для налаштування частот
let frequencySettings = {
    bass: 1.0,
    mid: 1.0,
    high: 1.0
};

// Додаємо змінні для кешування
let lastFrameTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

function startAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.85; // Згладжування аналізу (0-1)
                
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                
                setupCanvas();
                createParticles();
                draw();
            })
            .catch(err => console.error('Помилка доступу до мікрофону:', err));
    }
}

function setupCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    function updateCanvasSize() {
        // Отримуємо розміри вікна
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Встановлюємо розміри canvas
        canvas.width = width;
        canvas.height = height;
        
        // Зберігаємо розміри для використання в ефектах
        canvas.realWidth = width;
        canvas.realHeight = height;
    }
    
    // Початкове налаштування розмірів
    updateCanvasSize();
    
    // Оновлюємо розміри при зміні розміру вікна
    window.removeEventListener('resize', updateCanvasSize);
    window.addEventListener('resize', () => {
        updateCanvasSize();
        createParticles(); // Перестворюємо частинки для нового розміру
    });
}

function createParticles() {
    particles = [];
    const particleCount = 80;
    
    for(let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.realWidth,
            y: Math.random() * canvas.realHeight,
            size: Math.random() * 2 + 1,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5
        });
    }
}

function draw(timestamp) {
    // Обмежуємо FPS
    if (timestamp - lastFrameTime < frameInterval) {
        requestAnimationFrame(draw);
        return;
    }
    lastFrameTime = timestamp;
    
    const effect = document.getElementById('effectSelect').value;
    analyser.getByteFrequencyData(dataArray);
    
    // Оновлюємо адаптивну чутливість
    updateSensitivity();
    
    ctx.fillStyle = 'rgba(15, 15, 19, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    switch(effect) {
        case 'cosmicRings':
            drawCosmicRings();
            break;
        case 'nebula':
            drawNebula();
            break;
        case 'ambient':
            drawAmbientFlow();
            break;
        case 'waves':
            drawSmoothWaves();
            break;
        case 'frequencyBased':
            drawFrequencyBasedEffect();
            break;
        case 'waterfall':
            drawFrequencyWaterfall();
            break;
    }
    
    requestAnimationFrame(draw);
}

function getBeatDetection() {
    // Якщо баси вимкнені, біти не детектуються
    if (frequencySettings.bass === 0) return 0;
    
    let bassSum = 0;
    for(let i = 0; i < 8; i++) {
        bassSum += dataArray[i] * bassMultiplier * frequencySettings.bass;
    }
    const currentBeat = bassSum / 8;
    
    if(currentBeat > beatThreshold && currentBeat - lastBeat > 15) {
        colorOffset = (colorOffset + 60) % 360;
    }
    lastBeat = currentBeat;
    return currentBeat;
}

function getColorFromFrequency(frequency, intensity) {
    const baseHue = (colorOffset + frequency * 0.3) % 360;
    return `hsla(${baseHue}, 80%, ${50 + intensity * 20}%, ${Math.min(0.8, intensity)})`;
}

function drawAmbientFlow() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const frequencies = analyzeFrequencies();
    const beat = getBeatDetection();
    
    particles.forEach((particle, index) => {
        // Визначаємо тип частинки за індексом
        const freqType = index % 3 === 0 ? frequencies.bass :
                        index % 3 === 1 ? frequencies.mid :
                        frequencies.high;
        
        const speedMultiplier = Math.min((beat / 128) * sensitivity * 0.5 * freqType, 2.0);
        
        particle.x += particle.speedX * speedMultiplier;
        particle.y += particle.speedY * speedMultiplier;
        
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.y < 0) particle.y = canvas.height;
        
        const hue = (colorOffset + index * 120) % 360; // Різні кольори для різних частот
        const particleIntensity = freqType;
        
        const size = Math.min(
            particle.size * particleIntensity * sensitivity * 0.6,
            particle.size * 3
        );
        
        ctx.beginPath();
        ctx.arc(
            particle.x,
            particle.y,
            size,
            0,
            Math.PI * 2
        );
        
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${Math.min(0.4, particleIntensity * 0.8)})`;
        ctx.fill();
    });
}

function drawNebula() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const beat = getBeatDetection();
    const frequencies = analyzeFrequencies();
    
    // Зменшуємо радіус пульсації
    const pulseRadius = beat * 1.2;
    
    // Розділяємо частоти на три зони
    for(let i = 0; i < dataArray.length; i += 2) {
        const angle = (i * 2 * Math.PI) / dataArray.length;
        let intensity;
        
        // Визначаємо зону частот
        if (i < dataArray.length * 0.1) { // Баси
            intensity = (dataArray[i] / 255) * sensitivity * 0.7 * frequencies.bass;
        } else if (i < dataArray.length * 0.5) { // Середні
            intensity = (dataArray[i] / 255) * sensitivity * 0.7 * frequencies.mid;
        } else { // Високі
            intensity = (dataArray[i] / 255) * sensitivity * 0.7 * frequencies.high;
        }
        
        const radius = Math.min(
            intensity * 200 + pulseRadius, 
            Math.min(canvas.width, canvas.height) * 0.4
        );
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 50 * intensity);
        const color = getColorFromFrequency(dataArray[i], intensity);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(x, y, 50 * intensity * sensitivity * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    
    // Зменшуємо інтенсивність центрального сяйва
    const centerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, pulseRadius
    );
    centerGlow.addColorStop(0, `hsla(${colorOffset}, 80%, 50%, ${beat/255 * 0.3})`); // Зменшено прозорість
    centerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSmoothWaves() {
    const beat = getBeatDetection();
    const frequencies = analyzeFrequencies();
    const waves = 3;
    
    ctx.fillStyle = 'rgba(15, 15, 19, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for(let waveIndex = 0; waveIndex < waves; waveIndex++) {
        const points = [];
        const sliceWidth = canvas.width / (dataArray.length / 2);
        let x = 0;
        
        // Кожна хвиля відповідає за свою частоту
        const freqMultiplier = waveIndex === 0 ? frequencies.bass : 
                             waveIndex === 1 ? frequencies.mid : 
                             frequencies.high;
        
        for(let i = 0; i < dataArray.length / 2; i++) {
            const v = (dataArray[i] / 128.0) * sensitivity * freqMultiplier;
            const offsetY = (waveIndex - 1) * 100;
            const y = (canvas.height / 2) + 
                     Math.sin(x * 0.02 + waveIndex + Date.now() * 0.001) * 50 + 
                     v * 100 + 
                     offsetY + 
                     Math.sin(Date.now() * 0.002) * 30;
            
            points.push({ x, y });
            x += sliceWidth;
        }
        
        // Малюємо хвилю
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for(let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        
        const hue = (colorOffset + waveIndex * 120) % 360; // Більша різниця в кольорах
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`);
        gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 80%, 50%, ${freqMultiplier * 0.5})`);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 + (beat / 255) * 5 * freqMultiplier;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    // Додаємо вертикальні світлові промені при сильних бітах
    if(beat > beatThreshold * 1.2) {
        const beamCount = 3;
        for(let i = 0; i < beamCount; i++) {
            const x = canvas.width * (i + 1) / (beamCount + 1);
            const gradient = ctx.createLinearGradient(x, 0, x, canvas.height);
            const hue = (colorOffset + i * 40) % 360;
            
            gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0)`);
            gradient.addColorStop(0.5, `hsla(${hue}, 80%, 50%, ${beat/255 * 0.3})`);
            gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x - 20, 0, 40, canvas.height);
        }
    }
}

// Додаємо новий ефект - Cosmic Rings
function drawCosmicRings() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const beat = getBeatDetection();
    const frequencies = analyzeFrequencies();
    
    // Розподіляємо кільця за частотами
    const rings = [
        { radius: 100, freq: frequencies.bass },
        { radius: 160, freq: frequencies.bass },
        { radius: 220, freq: frequencies.mid },
        { radius: 280, freq: frequencies.mid },
        { radius: 340, freq: frequencies.high }
    ];
    
    rings.forEach((ring, index) => {
        const segments = 32;
        
        ctx.beginPath();
        for(let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const segment = Math.floor(i * dataArray.length / segments);
            const intensity = (dataArray[segment] / 255) * ring.freq;
            
            const radiusOffset = intensity * 80 * sensitivity;
            const radius = ring.radius + radiusOffset + (beat / 255) * 50 * ring.freq;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            if(i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        const strokeColor = getColorFromFrequency(ring.radius + beat, ring.freq);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 + (beat / 255) * 5 * ring.freq;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = strokeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;
    });
    
    // Частинки реагують на відповідні частоти
    for(let i = 0; i < dataArray.length; i += 8) {
        const freqType = i < dataArray.length * 0.3 ? frequencies.bass :
                        i < dataArray.length * 0.6 ? frequencies.mid :
                        frequencies.high;
        
        const intensity = (dataArray[i] / 255) * freqType;
        if(intensity > 0.4) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 350;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            ctx.beginPath();
            ctx.arc(x, y, intensity * 4, 0, Math.PI * 2);
            ctx.fillStyle = getColorFromFrequency(radius, intensity);
            ctx.fill();
        }
    }
}

function analyzeFrequencies() {
    // Якщо значення 0, повертаємо 0 для відповідної частоти
    const bass = frequencySettings.bass === 0 ? 0 : 
        (dataArray.slice(0, 10).reduce((a, b) => a + b) / 10 * frequencySettings.bass);
    const mid = frequencySettings.mid === 0 ? 0 : 
        (dataArray.slice(10, 100).reduce((a, b) => a + b) / 90 * frequencySettings.mid);
    const high = frequencySettings.high === 0 ? 0 : 
        (dataArray.slice(100, 200).reduce((a, b) => a + b) / 100 * frequencySettings.high);
    
    return {
        bass: bass / 255,
        mid: mid / 255,
        high: high / 255
    };
}

function drawFrequencyBasedEffect() {
    const frequencies = analyzeFrequencies();
    
    // Створюємо три кола, кожне реагує на свій частотний діапазон
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Бас - внутрішнє коло
    ctx.beginPath();
    ctx.arc(centerX, centerY, 100 * frequencies.bass, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${colorOffset}, 70%, 50%, ${frequencies.bass})`;
    ctx.fill();
    
    // Середні частоти - середнє коло
    ctx.beginPath();
    ctx.arc(centerX, centerY, 150 * frequencies.mid, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(colorOffset + 120) % 360}, 70%, 50%, ${frequencies.mid})`;
    ctx.fill();
    
    // Високі частоти - зовнішнє коло
    ctx.beginPath();
    ctx.arc(centerX, centerY, 200 * frequencies.high, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(colorOffset + 240) % 360}, 70%, 50%, ${frequencies.high})`;
    ctx.fill();
}

function drawFrequencyWaterfall() {
    const frequencies = analyzeFrequencies();
    const barWidth = canvas.width / 64;
    const maxHeight = canvas.height * 0.8;
    
    // Малюємо частотні смуги
    for(let i = 0; i < 64; i++) {
        // Визначаємо тип частоти та застосовуємо відповідні множники
        const freqType = i < 21 ? frequencies.bass * 0.6 : // Зменшуємо чутливість басів
                        i < 42 ? frequencies.mid * 0.8 : 
                        frequencies.high;
                        
        const value = Math.pow((dataArray[i] / 255), 1.3); // Додаємо нелінійність для кращого контролю
        const height = value * maxHeight * freqType * sensitivity * 0.7; // Зменшуємо загальну чутливість
        const x = i * barWidth;
        
        // Створюємо градієнт для кожної смуги
        const gradient = ctx.createLinearGradient(0, canvas.height - height, 0, canvas.height);
        
        // Колір залежить від частоти
        const hue = i < 21 ? colorOffset : 
                   i < 42 ? (colorOffset + 120) % 360 : 
                   (colorOffset + 240) % 360;
                   
        gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, ${value * freqType})`);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - height, barWidth - 1, height);
    }
}

function updateSensitivity() {
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    if (average < 50) {
        sensitivity = Math.min(sensitivity * 1.1, 5.0);
    } else if (average > 150) {
        sensitivity = Math.max(sensitivity * 0.9, 1.0);
    }
}

// Додаємо обробник для зміни ефекту
document.getElementById('effectSelect').addEventListener('change', () => {
    // Очищаємо канвас при зміні ефекту
    ctx.fillStyle = '#0f0f13';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

// Додаємо обробники подій для слайдерів
document.getElementById('bassSlider').addEventListener('input', (e) => {
    frequencySettings.bass = e.target.value / 100;
});

document.getElementById('midSlider').addEventListener('input', (e) => {
    frequencySettings.mid = e.target.value / 100;
});

document.getElementById('highSlider').addEventListener('input', (e) => {
    frequencySettings.high = e.target.value / 100;
});

document.getElementById('sensitivitySlider').addEventListener('input', (e) => {
    sensitivity = e.target.value / 100;
}); 