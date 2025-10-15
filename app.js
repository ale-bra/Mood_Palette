const upload = document.getElementById('imageUpload');
    const preview = document.getElementById('imagePreview');
    const previewArea = document.getElementById('previewArea');
    const paletteArea = document.getElementById('paletteArea');
    const extractBtn = document.getElementById('extractColors');
    const resetBtn = document.getElementById('reset');
    const analysisArea = document.getElementById('analysisArea');
    const harmonyCanvas = document.getElementById('harmonyCanvas');
    const exportCSSBtn = document.getElementById('exportCSS');
    const exportJSONBtn = document.getElementById('exportJSON');
    const toast = document.getElementById('toast');
    
    let dots = [];
    let imageCanvas = null;
    let imageCtx = null;
    let colors = [];

    upload.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        preview.src = ev.target.result;
        preview.style.display = 'block';
        clearDots();
      };
      reader.readAsDataURL(file);
    });

    function clearDots() {
      dots.forEach(d => d.remove());
      dots = [];
      colors = [];
      paletteArea.innerHTML = '';
      imageCanvas = null;
      imageCtx = null;
      document.getElementById('paletteSection').style.display = 'none';
      document.getElementById('analysisSection').style.display = 'none';
      document.getElementById('harmonySection').style.display = 'none';
      document.getElementById('exportSection').style.display = 'none';
    }

    extractBtn.addEventListener('click', () => {
      if (!preview.src) {
        showToast('Please upload an image first');
        return;
      }
      clearDots();
      
      imageCanvas = document.createElement('canvas');
      imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
      imageCanvas.width = preview.naturalWidth;
      imageCanvas.height = preview.naturalHeight;
      imageCtx.drawImage(preview, 0, 0);
      
      const colorData = extractDominantColors(imageCanvas, 5);
      colors = colorData.map(d => d.color);
      
      colorData.forEach(({color, x, y}) => {
        const dot = document.createElement('div');
        dot.className = 'color-dot';
        dot.style.background = color;
        
        const imgRect = preview.getBoundingClientRect();
        const previewRect = previewArea.getBoundingClientRect();
        
        const imgX = imgRect.left - previewRect.left;
        const imgY = imgRect.top - previewRect.top;
        
        const scaleX = imgRect.width / imageCanvas.width;
        const scaleY = imgRect.height / imageCanvas.height;
        
        const dotX = imgX + (x * scaleX) - 14;
        const dotY = imgY + (y * scaleY) - 14;
        
        dot.style.left = dotX + 'px';
        dot.style.top = dotY + 'px';
        
        enableDrag(dot);
        previewArea.appendChild(dot);
        dots.push(dot);
        addColorRect(color);
      });

      updateAnalysis();
      drawHarmonyWheel();
      
      document.getElementById('paletteSection').style.display = 'block';
      document.getElementById('analysisSection').style.display = 'block';
      document.getElementById('harmonySection').style.display = 'block';
      document.getElementById('exportSection').style.display = 'block';
    });

    function extractDominantColors(canvas, k) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      const pixelArray = [];
      
      // Sample every 10th pixel for performance
      for (let i = 0; i < pixels.length; i += 40) {
        pixelArray.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
      }
      
      // K-means clustering
      const clusters = kMeans(pixelArray, k);
      
      return clusters.map(cluster => {
        const [r, g, b] = cluster.center;
        // Find a pixel close to this color
        const x = Math.floor(Math.random() * canvas.width);
        const y = Math.floor(Math.random() * canvas.height);
        return {
          color: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
          x: x,
          y: y
        };
      });
    }

    function kMeans(data, k, maxIterations = 10) {
      // Initialize random centroids
      let centroids = [];
      for (let i = 0; i < k; i++) {
        centroids.push(data[Math.floor(Math.random() * data.length)].slice());
      }
      
      for (let iter = 0; iter < maxIterations; iter++) {
        const clusters = Array(k).fill(null).map(() => []);
        
        // Assign points to nearest centroid
        data.forEach(point => {
          let minDist = Infinity;
          let minIdx = 0;
          centroids.forEach((centroid, idx) => {
            const dist = Math.sqrt(
              Math.pow(point[0] - centroid[0], 2) +
              Math.pow(point[1] - centroid[1], 2) +
              Math.pow(point[2] - centroid[2], 2)
            );
            if (dist < minDist) {
              minDist = dist;
              minIdx = idx;
            }
          });
          clusters[minIdx].push(point);
        });
        
        // Update centroids
        centroids = clusters.map(cluster => {
          if (cluster.length === 0) return centroids[0];
          const sum = cluster.reduce((acc, point) => [
            acc[0] + point[0],
            acc[1] + point[1],
            acc[2] + point[2]
          ], [0, 0, 0]);
          return [
            sum[0] / cluster.length,
            sum[1] / cluster.length,
            sum[2] / cluster.length
          ];
        });
      }
      
      return centroids.map(center => ({ center, points: [] }));
    }

    function addColorRect(color) {
      const rect = document.createElement('div');
      rect.className = 'color-rect';
      rect.style.background = color;
      const hex = rgbToHex(color);
      rect.innerHTML = `<span>${hex}</span>`;
      rect.addEventListener('click', () => {
        navigator.clipboard.writeText(hex);
        showToast(`Copied ${hex}`);
      });
      paletteArea.appendChild(rect);
    }

    function enableDrag(dot) {
      let offsetX, offsetY, dragging = false;
      let paletteRect = null;
      let animationFrameId = null;
      
      dot.addEventListener('mousedown', e => {
        dragging = true;
        const rect = dot.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        const dotIndex = dots.indexOf(dot);
        paletteRect = paletteArea.children[dotIndex];
        
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const rect = previewArea.getBoundingClientRect();
        const x = e.clientX - rect.left - offsetX;
        const y = e.clientY - rect.top - offsetY;
        dot.style.left = Math.max(0, Math.min(x, rect.width - 28)) + 'px';
        dot.style.top = Math.max(0, Math.min(y, rect.height - 28)) + 'px';
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
          const newColor = updateDotColor(dot, paletteRect);
          if (newColor) {
            const dotIndex = dots.indexOf(dot);
            colors[dotIndex] = newColor;
            updateAnalysis();
            drawHarmonyWheel();
          }
        });
      });
      
      document.addEventListener('mouseup', () => {
        if (dragging) {
          dragging = false;
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
          }
        }
      });
    }

    function updateDotColor(dot, paletteRect) {
      if (!imageCanvas || !imageCtx) return null;
      
      const imgRect = preview.getBoundingClientRect();
      const dotRect = dot.getBoundingClientRect();
      
      const dotCenterX = dotRect.left + 14;
      const dotCenterY = dotRect.top + 14;
      
      if (dotCenterX < imgRect.left || dotCenterX > imgRect.right ||
          dotCenterY < imgRect.top || dotCenterY > imgRect.bottom) {
        return null;
      }
      
      const scaleX = imageCanvas.width / imgRect.width;
      const scaleY = imageCanvas.height / imgRect.height;
      
      const canvasX = Math.floor((dotCenterX - imgRect.left) * scaleX);
      const canvasY = Math.floor((dotCenterY - imgRect.top) * scaleY);
      
      const imageData = imageCtx.getImageData(canvasX, canvasY, 1, 1);
      const [r, g, b] = imageData.data;
      const newColor = `rgb(${r}, ${g}, ${b})`;
      
      dot.style.background = newColor;
      if (paletteRect) {
        paletteRect.style.background = newColor;
        const hex = rgbToHex(newColor);
        paletteRect.querySelector('span').textContent = hex;
      }
      
      return newColor;
    }

    function updateAnalysis() {
      const analysis = analyzeColors(colors);
      analysisArea.innerHTML = `
        <div class="analysis-item">
          <span class="analysis-label">Temperature:</span>${analysis.temperature}
        </div>
        <div class="analysis-item">
          <span class="analysis-label">Energy:</span>${analysis.energy}
        </div>
        <div class="analysis-item">
          <span class="analysis-label">Contrast:</span>${analysis.contrast}
        </div>
        <div class="analysis-item">
          <span class="analysis-label">Vibe:</span>${analysis.vibe}
        </div>
      `;
    }

    function analyzeColors(colors) {
      const hslColors = colors.map(rgbToHSL);
      
      // Temperature (average hue)
      const avgHue = hslColors.reduce((sum, c) => sum + c.h, 0) / hslColors.length;
      let temp = 'Neutral';
      if (avgHue < 60 || avgHue > 300) temp = 'Warm';
      else if (avgHue > 150 && avgHue < 270) temp = 'Cool';
      
      // Energy (saturation + lightness)
      const avgSat = hslColors.reduce((sum, c) => sum + c.s, 0) / hslColors.length;
      const avgLight = hslColors.reduce((sum, c) => sum + c.l, 0) / hslColors.length;
      const energy = avgSat * 0.7 + (avgLight > 50 ? avgLight - 50 : 50 - avgLight) * 0.3;
      let energyLevel = 'Subdued';
      if (energy > 50) energyLevel = 'Vibrant';
      else if (energy > 30) energyLevel = 'Moderate';
      
      // Contrast (difference between lightest and darkest)
      const lights = hslColors.map(c => c.l);
      const contrast = Math.max(...lights) - Math.min(...lights);
      let contrastLevel = 'Low';
      if (contrast > 60) contrastLevel = 'High';
      else if (contrast > 30) contrastLevel = 'Medium';
      
      // Vibe
      let vibe = '';
      if (temp === 'Warm' && energy > 40) vibe = 'Energetic & Bold';
      else if (temp === 'Cool' && avgLight < 40) vibe = 'Calm & Mysterious';
      else if (temp === 'Cool' && avgLight > 60) vibe = 'Fresh & Airy';
      else if (avgSat < 30) vibe = 'Muted & Sophisticated';
      else if (contrast > 50) vibe = 'Dynamic & Striking';
      else vibe = 'Balanced & Harmonious';
      
      return { temperature: temp, energy: energyLevel, contrast: contrastLevel, vibe };
    }

    function drawHarmonyWheel() {
      const ctx = harmonyCanvas.getContext('2d');
      const w = harmonyCanvas.width;
      const h = harmonyCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 20;
      
      ctx.clearRect(0, 0, w, h);
      
      // Draw color wheel
      for (let angle = 0; angle < 360; angle++) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, (angle - 1) * Math.PI / 180, angle * Math.PI / 180);
        ctx.lineTo(cx, cy);
        ctx.fillStyle = `hsl(${angle}, 80%, 60%)`;
        ctx.fill();
      }
      
      // Draw inner circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
      
      // Plot colors and draw connections
      const hslColors = colors.map(rgbToHSL);
      const points = hslColors.map(c => {
        const angle = c.h * Math.PI / 180;
        const r = radius * 0.75;
        return {
          x: cx + r * Math.cos(angle - Math.PI / 2),
          y: cy + r * Math.sin(angle - Math.PI / 2)
        };
      });
      
      // Draw connection lines
      ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
      ctx.lineWidth = 2;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.stroke();
        }
      }
      
      // Draw color dots
      colors.forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    function rgbToHSL(rgb) {
      const match = rgb.match(/\d+/g);
      let [r, g, b] = match.map(Number);
      r /= 255; g /= 255; b /= 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      
      return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function rgbToHex(rgb) {
      const match = rgb.match(/\d+/g);
      const [r, g, b] = match.map(Number);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    exportCSSBtn.addEventListener('click', () => {
      const css = colors.map((c, i) => `  --color-${i + 1}: ${rgbToHex(c)};`).join('\n');
      const output = `:root {\n${css}\n}`;
      navigator.clipboard.writeText(output);
      showToast('CSS variables copied!');
    });

    exportJSONBtn.addEventListener('click', () => {
      const json = JSON.stringify(colors.map(rgbToHex), null, 2);
      navigator.clipboard.writeText(json);
      showToast('JSON copied!');
    });

    resetBtn.addEventListener('click', () => {
      preview.src = '';
      preview.style.display = 'none';
      clearDots();
      upload.value = '';
    });

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }