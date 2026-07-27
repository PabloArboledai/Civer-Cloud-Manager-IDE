import './style.css';
import QRCodeStyling from 'qr-code-styling';
import PhotoSwipeLightbox from 'photoswipe/lightbox';

// Initialize default QR Code
const qrCode = new QRCodeStyling({
  width: 300,
  height: 300,
  data: "https://ejemplo.com",
  margin: 10,
  qrOptions: {
    typeNumber: 0,
    mode: "Byte",
    errorCorrectionLevel: "H" // Set to H to support larger logos
  },
  imageOptions: {
    hideBackgroundDots: true,
    imageSize: 0.4,
    margin: 5,
    crossOrigin: "anonymous",
  },
  dotsOptions: {
    type: "rounded",
    color: "#6a11cb"
  },
  backgroundOptions: {
    color: "#ffffff",
  },
  cornersSquareOptions: {
    type: "extra-rounded",
    color: "#000000"
  },
  cornersDotOptions: {
    type: "dot",
    color: "#000000"
  }
});

const canvasContainer = document.getElementById("canvas-container");
qrCode.append(canvasContainer);

// Handle Inputs
const urlInput = document.getElementById("qr-url");
const colorDotsInput = document.getElementById("color-dots");
const colorDotsVal = document.getElementById("color-dots-val");
const colorBgInput = document.getElementById("color-bg");
const colorBgVal = document.getElementById("color-bg-val");
const dotStyleInput = document.getElementById("dot-style");
const cornerStyleInput = document.getElementById("corner-square-style");
const logoInput = document.getElementById("logo-upload");
const logoSizeInput = document.getElementById("logo-size");
const logoSizeVal = document.getElementById("logo-size-val");
const logoFilterInput = document.getElementById("logo-filter");
const logoPresets = document.querySelectorAll(".logo-preset");

const downloadPngBtn = document.getElementById("download-png");
const downloadSvgBtn = document.getElementById("download-svg");

let rawLogoSrc = null; // Holds the un-filtered original image source (data URI or URL)

const applyFilterToImage = (imgSrc, filterValue) => {
  return new Promise((resolve) => {
    if (!imgSrc || filterValue === "none") {
      resolve(imgSrc);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      
      // Apply CSS filter via Canvas 2D API
      ctx.filter = filterValue;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imgSrc;
  });
};

const updateQRCode = async () => {
  const data = urlInput.value || "https://ejemplo.com";
  const dotsColor = colorDotsInput.value;
  const bgColor = colorBgInput.value;
  const dotsType = dotStyleInput.value;
  const cornersType = cornerStyleInput.value;
  const imageSize = parseFloat(logoSizeInput.value);
  const filterValue = logoFilterInput.value;

  const processedLogo = await applyFilterToImage(rawLogoSrc, filterValue);

  qrCode.update({
    data: data,
    dotsOptions: { type: dotsType, color: dotsColor, gradient: null },
    backgroundOptions: { color: bgColor },
    cornersSquareOptions: { type: cornersType, color: dotsColor },
    cornersDotOptions: { type: "dot", color: dotsColor },
    image: processedLogo,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: imageSize,
      margin: 5,
      crossOrigin: "anonymous",
    }
  });
};

// Event Listeners
urlInput.addEventListener("input", updateQRCode);

colorDotsInput.addEventListener("input", (e) => {
  colorDotsVal.textContent = e.target.value;
  updateQRCode();
});

colorBgInput.addEventListener("input", (e) => {
  colorBgVal.textContent = e.target.value;
  updateQRCode();
});

dotStyleInput.addEventListener("change", updateQRCode);
cornerStyleInput.addEventListener("change", updateQRCode);
logoSizeInput.addEventListener("input", (e) => {
  logoSizeVal.textContent = Math.round(e.target.value * 100) + "%";
  updateQRCode();
});
logoFilterInput.addEventListener("change", updateQRCode);

// Logo Presets
logoPresets.forEach(preset => {
  preset.addEventListener("click", () => {
    // Remove active from all
    logoPresets.forEach(p => p.classList.remove("active"));
    preset.classList.add("active");
    
    const logoPath = preset.dataset.logo;
    rawLogoSrc = logoPath || null;
    
    // Clear file input if a preset is selected
    logoInput.value = "";
    
    updateQRCode();
  });
});

// Custom Upload
logoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) {
    rawLogoSrc = null;
    updateQRCode();
    return;
  }
  
  // Remove active state from presets
  logoPresets.forEach(p => p.classList.remove("active"));
  
  const reader = new FileReader();
  reader.onload = (event) => {
    rawLogoSrc = event.target.result;
    updateQRCode();
  };
  reader.readAsDataURL(file);
});

// Download actions
downloadPngBtn.addEventListener("click", () => qrCode.download({ name: "qr-pro", extension: "png" }));
downloadSvgBtn.addEventListener("click", () => qrCode.download({ name: "qr-pro", extension: "svg" }));

// --- AI Generation Logic ---
const btnGenerateAI = document.getElementById('btn-generate-ai');
const aiPromptInput = document.getElementById('ai-prompt');

btnGenerateAI.addEventListener('click', async () => {
  const url = urlInput.value || "https://ejemplo.com";
  const prompt = aiPromptInput.value;
  
  if (!prompt) {
    alert("Por favor ingresa un prompt para la Inteligencia Artificial (Ej: A beautiful sunset).");
    return;
  }
  
  btnGenerateAI.disabled = true;
  const originalText = btnGenerateAI.innerText;
  btnGenerateAI.innerText = "✨ Generando con IA... (puede tardar 10-20s)";
  btnGenerateAI.style.opacity = "0.7";
  
  try {
    const res = await fetch('http://localhost:4000/api/generate-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, prompt })
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Go to gallery to see the generated QR
      tabGallery.click();
    } else {
      alert("Error: " + data.error);
    }
  } catch(err) {
    console.error(err);
    alert("Error de conexión con el backend (asegúrate de que webhook-server.js esté corriendo).");
  } finally {
    btnGenerateAI.disabled = false;
    btnGenerateAI.innerText = originalText;
    btnGenerateAI.style.opacity = "1";
  }
});

// --- Tab Logic ---
const tabGenerator = document.getElementById('tab-generator');
const tabGallery = document.getElementById('tab-gallery');
const viewGenerator = document.getElementById('view-generator');
const viewGallery = document.getElementById('view-gallery');

tabGenerator.addEventListener('click', () => {
  tabGenerator.classList.add('active');
  tabGallery.classList.remove('active');
  viewGenerator.classList.remove('hidden');
  viewGallery.classList.add('hidden');
});

tabGallery.addEventListener('click', () => {
  tabGallery.classList.add('active');
  tabGenerator.classList.remove('active');
  viewGallery.classList.remove('hidden');
  viewGenerator.classList.add('hidden');
  loadGallery();
});

// --- Gallery Logic ---
const galleryContainer = document.getElementById('my-gallery');
let lightbox = null;

const loadGallery = async () => {
  galleryContainer.innerHTML = '<div class="loading-state">Cargando galería...</div>';
  
  try {
    const res = await fetch('http://localhost:4000/api/qrs');
    const data = await res.json();
    
    if (data.success && data.qrs.length > 0) {
      galleryContainer.innerHTML = '';
      
      data.qrs.forEach((qr) => {
        const a = document.createElement('a');
        a.href = qr.url;
        a.className = 'gallery-item';
        a.dataset.pswpWidth = qr.width;
        a.dataset.pswpHeight = qr.height;
        a.target = '_blank';
        
        const img = document.createElement('img');
        img.src = qr.url;
        img.alt = qr.name;
        
        a.appendChild(img);
        galleryContainer.appendChild(a);
      });

      // Init PhotoSwipe
      if (!lightbox) {
        lightbox = new PhotoSwipeLightbox({
          gallery: '#my-gallery',
          children: 'a',
          pswpModule: () => import('photoswipe')
        });
        lightbox.init();
      }
    } else {
      galleryContainer.innerHTML = '<div class="loading-state">No hay QRs generados aún.</div>';
    }
  } catch (err) {
    console.error(err);
    galleryContainer.innerHTML = '<div class="loading-state">Error cargando galería. Asegúrate de que el backend (npm run api) esté encendido.</div>';
  }
};
