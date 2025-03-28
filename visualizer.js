// Клас для управління візуалізатором
class VisualizerManager {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.canvas = null;
        this.ctx = null;
        this.dataArray = null;
        this.particles = [];
        this.hueRotation = 0;
        this.sensitivity = 2.5;
        this.lastBeat = 0;
        this.beatThreshold = 120;
        this.colorOffset = 0;
        this.bassMultiplier = 2.0;
        this.lastFrameTime = 0;
        this.FPS = 60;
        this.frameInterval = 1000 / this.FPS;
        
        // Кешування градієнтів
        this.gradientCache = new Map();
        this.maxGradientCacheSize = 100;
        
        this.frequencySettings = {
            bass: 1.0,
            mid: 1.0,
            high: 1.0
        };
        
        // Кешування частотних даних
        this.frequencyCache = {
            lastUpdate: 0,
            updateInterval: 1000 / 30, // Оновлення 30 разів на секунду
            data: {
                bass: 0,
                mid: 0,
                high: 0
            }
        };

        // Прив'язуємо методи до контексту
        this.draw = this.draw.bind(this);
        this.startAudio = this.startAudio.bind(this);
        
        // Ініціалізуємо обробники подій
        this.initializeEventListeners();
    }
    
    async startAudio() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);
            
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.85;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            this.setupCanvas();
            this.createParticles();
            this.draw();
        } catch (err) {
            console.error('Помилка доступу до мікрофону:', err);
        }
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        const updateCanvasSize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.realWidth = width;
            this.canvas.realHeight = height;
            
            // Очищаємо кеш градієнтів при зміні розміру
            this.gradientCache.clear();
        };
        
        updateCanvasSize();
        window.addEventListener('resize', () => {
            updateCanvasSize();
            this.createParticles();
        });
    }
    
    // Оптимізоване створення та кешування градієнтів
    getGradient(key, createGradient) {
        // Очищаємо кеш, якщо він став занадто великим
        if (this.gradientCache.size > this.maxGradientCacheSize) {
            const oldestKey = this.gradientCache.keys().next().value;
            this.gradientCache.delete(oldestKey);
        }
        
        // Перевіряємо кеш
        if (!this.gradientCache.has(key)) {
            const gradient = createGradient();
            this.gradientCache.set(key, {
                gradient,
                lastUsed: performance.now()
            });
        } else {
            // Оновлюємо час останнього використання
            this.gradientCache.get(key).lastUsed = performance.now();
        }
        
        return this.gradientCache.get(key).gradient;
    }
    
    // Оптимізоване створення кольорів
    getColorWithCache(hue, saturation, lightness, alpha) {
        const key = `hsla-${hue}-${saturation}-${lightness}-${alpha}`;
        if (!this.gradientCache.has(key)) {
            this.gradientCache.set(key, `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`);
        }
        return this.gradientCache.get(key);
    }
    
    // Очищення старих градієнтів
    cleanupGradients() {
        const now = performance.now();
        const maxAge = 5000; // 5 секунд
        
        for (const [key, value] of this.gradientCache.entries()) {
            if (now - value.lastUsed > maxAge) {
                this.gradientCache.delete(key);
            }
        }
    }
    
    // Оптимізований аналіз частот
    analyzeFrequencies() {
        const now = performance.now();
        
        // Повертаємо кешовані дані, якщо вони ще актуальні
        if (now - this.frequencyCache.lastUpdate < this.frequencyCache.updateInterval) {
            return this.frequencyCache.data;
        }
        
        // Аналізуємо частоти з використанням TypedArray для кращої продуктивності
        const bass = this.frequencySettings.bass === 0 ? 0 : 
            new Float32Array(this.dataArray.slice(0, 8)).reduce((a, b) => a + b) / 8;
        
        const mid = this.frequencySettings.mid === 0 ? 0 : 
            new Float32Array(this.dataArray.slice(8, 100)).reduce((a, b) => a + b) / 92;
        
        const high = this.frequencySettings.high === 0 ? 0 : 
            new Float32Array(this.dataArray.slice(100, 200)).reduce((a, b) => a + b) / 100;
        
        // Оновлюємо кеш
        this.frequencyCache.data = {
            bass: (bass / 255) * this.frequencySettings.bass,
            mid: (mid / 255) * this.frequencySettings.mid,
            high: (high / 255) * this.frequencySettings.high
        };
        
        this.frequencyCache.lastUpdate = now;
        return this.frequencyCache.data;
    }
    
    createParticles() {
        this.particles = [];
        const particleCount = 80;
        
        for(let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.realWidth,
                y: Math.random() * this.canvas.realHeight,
                size: Math.random() * 2 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5
            });
        }
    }

    draw(timestamp) {
        if (!this.ctx || !this.canvas) return;
        
        // Обмежуємо FPS
        if (timestamp - this.lastFrameTime < this.frameInterval) {
            requestAnimationFrame(this.draw);
            return;
        }
        this.lastFrameTime = timestamp;
        
        const effectSelect = document.getElementById('effectSelect');
        if (!effectSelect) return;
        
        const effect = effectSelect.value;
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Оновлюємо адаптивну чутливість
        this.updateSensitivity();
        
        this.ctx.fillStyle = 'rgba(15, 15, 19, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Періодично очищаємо старі градієнти
        if (timestamp % 5000 < this.frameInterval) {
            this.cleanupGradients();
        }
        
        switch(effect) {
            case 'cosmicRings':
                this.drawCosmicRings();
                break;
            case 'nebula':
                this.drawNebula();
                break;
            case 'ambient':
                this.drawAmbientFlow();
                break;
            case 'waves':
                this.drawSmoothWaves();
                break;
            case 'frequencyBased':
                this.drawFrequencyBasedEffect();
                break;
            case 'waterfall':
                this.drawFrequencyWaterfall();
                break;
        }
        
        requestAnimationFrame(this.draw);
    }

    getBeatDetection() {
        // Якщо баси вимкнені, біти не детектуються
        if (this.frequencySettings.bass === 0) return 0;
        
        let bassSum = 0;
        for(let i = 0; i < 8; i++) {
            bassSum += this.dataArray[i] * this.bassMultiplier * this.frequencySettings.bass;
        }
        const currentBeat = bassSum / 8;
        
        if(currentBeat > this.beatThreshold && currentBeat - this.lastBeat > 15) {
            this.colorOffset = (this.colorOffset + 60) % 360;
        }
        this.lastBeat = currentBeat;
        return currentBeat;
    }

    getColorFromFrequency(frequency, intensity) {
        const baseHue = (this.colorOffset + frequency * 0.3) % 360;
        return `hsla(${baseHue}, 80%, ${50 + intensity * 20}%, ${Math.min(0.8, intensity)})`;
    }

    drawAmbientFlow() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const frequencies = this.analyzeFrequencies();
        const beat = this.getBeatDetection();
        
        this.particles.forEach((particle, index) => {
            // Визначаємо тип частинки за індексом
            const freqType = index % 3 === 0 ? frequencies.bass :
                            index % 3 === 1 ? frequencies.mid :
                            frequencies.high;
            
            const speedMultiplier = Math.min((beat / 128) * this.sensitivity * 0.5 * freqType, 2.0);
            
            particle.x += particle.speedX * speedMultiplier;
            particle.y += particle.speedY * speedMultiplier;
            
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.y > this.canvas.height) particle.y = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            
            const hue = (this.colorOffset + index * 120) % 360; // Різні кольори для різних частот
            const particleIntensity = freqType;
            
            const size = Math.min(
                particle.size * particleIntensity * this.sensitivity * 0.6,
                particle.size * 3
            );
            
            this.ctx.beginPath();
            this.ctx.arc(
                particle.x,
                particle.y,
                size,
                0,
                Math.PI * 2
            );
            
            this.ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${Math.min(0.4, particleIntensity * 0.8)})`;
            this.ctx.fill();
        });
    }

    drawNebula() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const beat = this.getBeatDetection();
        const frequencies = this.analyzeFrequencies();
        
        // Зменшуємо радіус пульсації
        const pulseRadius = beat * 1.2;
        
        // Розділяємо частоти на три зони
        for(let i = 0; i < this.dataArray.length; i += 2) {
            const angle = (i * 2 * Math.PI) / this.dataArray.length;
            let intensity;
            
            // Визначаємо зону частот
            if (i < this.dataArray.length * 0.1) { // Баси
                intensity = (this.dataArray[i] / 255) * this.sensitivity * 0.7 * frequencies.bass;
            } else if (i < this.dataArray.length * 0.5) { // Середні
                intensity = (this.dataArray[i] / 255) * this.sensitivity * 0.7 * frequencies.mid;
            } else { // Високі
                intensity = (this.dataArray[i] / 255) * this.sensitivity * 0.7 * frequencies.high;
            }
            
            const radius = Math.min(
                intensity * 200 + pulseRadius, 
                Math.min(this.canvas.width, this.canvas.height) * 0.4
            );
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 50 * intensity);
            const color = this.getColorFromFrequency(this.dataArray[i], intensity);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 50 * intensity * this.sensitivity * 0.8, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        }
        
        // Зменшуємо інтенсивність центрального сяйва
        const centerGlow = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, pulseRadius
        );
        centerGlow.addColorStop(0, `hsla(${this.colorOffset}, 80%, 50%, ${beat/255 * 0.3})`); // Зменшено прозорість
        centerGlow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = centerGlow;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawSmoothWaves() {
        const beat = this.getBeatDetection();
        const frequencies = this.analyzeFrequencies();
        const waves = 3;
        
        this.ctx.fillStyle = 'rgba(15, 15, 19, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        for(let waveIndex = 0; waveIndex < waves; waveIndex++) {
            const points = [];
            const sliceWidth = this.canvas.width / (this.dataArray.length / 2);
            let x = 0;
            
            // Кожна хвиля відповідає за свою частоту
            const freqMultiplier = waveIndex === 0 ? frequencies.bass : 
                                 waveIndex === 1 ? frequencies.mid : 
                                 frequencies.high;
            
            for(let i = 0; i < this.dataArray.length / 2; i++) {
                const v = (this.dataArray[i] / 128.0) * this.sensitivity * freqMultiplier;
                const offsetY = (waveIndex - 1) * 100;
                const y = (this.canvas.height / 2) + 
                         Math.sin(x * 0.02 + waveIndex + Date.now() * 0.001) * 50 + 
                         v * 100 + 
                         offsetY + 
                         Math.sin(Date.now() * 0.002) * 30;
                
                points.push({ x, y });
                x += sliceWidth;
            }
            
            // Малюємо хвилю
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            
            for(let i = 0; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            
            const hue = (this.colorOffset + waveIndex * 120) % 360; // Більша різниця в кольорах
            const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
            gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`);
            gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 80%, 50%, ${freqMultiplier * 0.5})`);
            gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`);
            
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 3 + (beat / 255) * 5 * freqMultiplier;
            
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = `hsla(${hue}, 80%, 50%, ${freqMultiplier * 0.5})`;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Додаємо вертикальні світлові промені при сильних бітах
        if(beat > this.beatThreshold * 1.2) {
            const beamCount = 3;
            for(let i = 0; i < beamCount; i++) {
                const x = this.canvas.width * (i + 1) / (beamCount + 1);
                const gradient = this.ctx.createLinearGradient(x, 0, x, this.canvas.height);
                const hue = (this.colorOffset + i * 40) % 360;
                
                gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0)`);
                gradient.addColorStop(0.5, `hsla(${hue}, 80%, 50%, ${beat/255 * 0.3})`);
                gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
                
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x - 20, 0, 40, this.canvas.height);
            }
        }
    }

    // Додаємо новий ефект - Cosmic Rings
    drawCosmicRings() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const beat = this.getBeatDetection();
        const frequencies = this.analyzeFrequencies();
        
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
            
            this.ctx.beginPath();
            for(let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const segment = Math.floor(i * this.dataArray.length / segments);
                const intensity = (this.dataArray[segment] / 255) * ring.freq;
                
                const radiusOffset = intensity * 80 * this.sensitivity;
                const radius = ring.radius + radiusOffset + (beat / 255) * 50 * ring.freq;
                
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                if(i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            
            this.ctx.closePath();
            const strokeColor = this.getColorFromFrequency(ring.radius + beat, ring.freq);
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = 2 + (beat / 255) * 5 * ring.freq;
            
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = strokeColor;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        });
        
        // Частинки реагують на відповідні частоти
        for(let i = 0; i < this.dataArray.length; i += 8) {
            const freqType = i < this.dataArray.length * 0.3 ? frequencies.bass :
                            i < this.dataArray.length * 0.6 ? frequencies.mid :
                            frequencies.high;
            
            const intensity = (this.dataArray[i] / 255) * freqType;
            if(intensity > 0.4) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 350;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, intensity * 4, 0, Math.PI * 2);
                this.ctx.fillStyle = this.getColorFromFrequency(radius, intensity);
                this.ctx.fill();
            }
        }
    }

    drawFrequencyBasedEffect() {
        const frequencies = this.analyzeFrequencies();
        
        // Створюємо три кола, кожне реагує на свій частотний діапазон
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Бас - внутрішнє коло
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 100 * frequencies.bass, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${this.colorOffset}, 70%, 50%, ${frequencies.bass})`;
        this.ctx.fill();
        
        // Середні частоти - середнє коло
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 150 * frequencies.mid, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${(this.colorOffset + 120) % 360}, 70%, 50%, ${frequencies.mid})`;
        this.ctx.fill();
        
        // Високі частоти - зовнішнє коло
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 200 * frequencies.high, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${(this.colorOffset + 240) % 360}, 70%, 50%, ${frequencies.high})`;
        this.ctx.fill();
    }

    drawFrequencyWaterfall() {
        const frequencies = this.analyzeFrequencies();
        const barWidth = this.canvas.width / 64;
        const maxHeight = this.canvas.height * 0.8;
        
        // Малюємо частотні смуги
        for(let i = 0; i < 64; i++) {
            // Визначаємо тип частоти та застосовуємо відповідні множники
            const freqType = i < 21 ? frequencies.bass * 0.6 : // Зменшуємо чутливість басів
                            i < 42 ? frequencies.mid * 0.8 : 
                            frequencies.high;
                            
            const value = Math.pow((this.dataArray[i] / 255), 1.3); // Додаємо нелінійність для кращого контролю
            const height = value * maxHeight * freqType * this.sensitivity * 0.7; // Зменшуємо загальну чутливість
            const x = i * barWidth;
            
            // Створюємо градієнт для кожної смуги
            const gradient = this.ctx.createLinearGradient(0, this.canvas.height - height, 0, this.canvas.height);
            
            // Колір залежить від частоти
            const hue = i < 21 ? this.colorOffset : 
                       i < 42 ? (this.colorOffset + 120) % 360 : 
                       (this.colorOffset + 240) % 360;
                       
            gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, ${value * freqType})`);
            gradient.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, this.canvas.height - height, barWidth - 1, height);
        }
    }

    updateSensitivity() {
        const average = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
        if (average < 50) {
            this.sensitivity = Math.min(this.sensitivity * 1.1, 5.0);
        } else if (average > 150) {
            this.sensitivity = Math.max(this.sensitivity * 0.9, 1.0);
        }
    }

    initializeEventListeners() {
        // Кнопка старту
        const startButton = document.getElementById('startButton');
        if (startButton) {
            startButton.addEventListener('click', this.startAudio);
        }
        
        // Слайдери
        const bassSlider = document.getElementById('bassSlider');
        if (bassSlider) {
            bassSlider.addEventListener('input', (e) => {
                this.frequencySettings.bass = e.target.value / 100;
            });
        }
        
        const midSlider = document.getElementById('midSlider');
        if (midSlider) {
            midSlider.addEventListener('input', (e) => {
                this.frequencySettings.mid = e.target.value / 100;
            });
        }
        
        const highSlider = document.getElementById('highSlider');
        if (highSlider) {
            highSlider.addEventListener('input', (e) => {
                this.frequencySettings.high = e.target.value / 100;
            });
        }
        
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        if (sensitivitySlider) {
            sensitivitySlider.addEventListener('input', (e) => {
                this.sensitivity = e.target.value / 100;
            });
        }
        
        // Селектор ефектів
        const effectSelect = document.getElementById('effectSelect');
        if (effectSelect) {
            effectSelect.addEventListener('change', () => {
                if (this.ctx) {
                    this.ctx.fillStyle = '#0f0f13';
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                }
            });
        }
    }
}

// Створюємо екземпляр менеджера після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
    window.visualizer = new VisualizerManager();
}); 