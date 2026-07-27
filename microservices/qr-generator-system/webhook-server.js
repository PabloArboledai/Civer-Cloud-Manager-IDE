import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { QRCodeCanvas } from '@loskir/styled-qr-code-node';

const app = express();
app.use(cors());
app.use(express.json());

const outputDir = path.join(process.cwd(), 'generated_qrs');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Servir la carpeta de QRs como archivos estáticos
app.use('/qrs', express.static(outputDir));

// Endpoint para obtener la lista de QRs generados
app.get('/api/qrs', (req, res) => {
  try {
    const files = fs.readdirSync(outputDir);
    const images = files
      .filter(file => file.endsWith('.png'))
      .sort((a, b) => {
        const timeA = fs.statSync(path.join(outputDir, a)).mtime.getTime();
        const timeB = fs.statSync(path.join(outputDir, b)).mtime.getTime();
        return timeB - timeA; // Recientes primero
      });

    // We assume images are 600x600 based on our generation params
    const qrs = images.map(img => ({
      url: `http://localhost:4000/qrs/${img}`,
      name: img,
      width: 600,
      height: 600
    }));
    
    res.json({ success: true, qrs });
  } catch (err) {
    console.error('Error leyendo la carpeta de QRs:', err);
    res.status(500).json({ error: 'No se pudieron leer las imágenes' });
  }
});

app.post('/api/generate-ai', async (req, res) => {
  const { url, prompt } = req.body;
  if (!url || !prompt) {
    return res.status(400).json({ error: 'Faltan parámetros "url" o "prompt".' });
  }

  try {
    console.log(`🧠 Solicitando QR AI a Modal para la URL: ${url}`);
    
    // Using dynamic import for node-fetch if needed, or global fetch if Node 18+
    const response = await fetch('https://latinobetterware--qr-ai-generator-webhook.modal.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        prompt,
        secret: 'ws-Xfvp6XgEPc6i46DbC9nymo'
      })
    });

    if (!response.ok) {
      throw new Error(`Error en Modal: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.image_b64) {
      throw new Error('Respuesta inválida de Modal');
    }

    const filename = `ai_qr_${Date.now()}.png`;
    const filePath = path.join(outputDir, filename);
    const buffer = Buffer.from(data.image_b64, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ QR AI generado: ${filePath}`);
    
    res.json({
      success: true,
      path: filePath,
      filename: filename,
      url: `http://localhost:4000/qrs/${filename}`
    });
  } catch (err) {
    console.error('❌ Error generando QR AI:', err);
    res.status(500).json({ error: 'No se pudo generar el QR AI' });
  }
});

app.post('/webhook/generate', async (req, res) => {
  const { url, name, colorDots, colorBg, dotStyle, cornerStyle, logo } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro "url" en el body.' });
  }

  const filename = `${name || 'webhook_qr_pro'}_${Date.now()}.png`;
  const filePath = path.join(outputDir, filename);

  const options = {
    width: 600,
    height: 600,
    data: url,
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "H"
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 10,
      crossOrigin: "anonymous",
    },
    dotsOptions: {
      color: colorDots || '#6a11cb',
      type: dotStyle || 'rounded'
    },
    backgroundOptions: {
      color: colorBg || '#ffffff',
    },
    cornersSquareOptions: {
      color: colorDots || '#6a11cb',
      type: cornerStyle || 'extra-rounded'
    },
    cornersDotOptions: {
      color: colorDots || '#6a11cb',
      type: "dot"
    }
  };

  if (logo) {
    options.image = logo;
  }

  const qrCode = new QRCodeCanvas(options);

  try {
    const buffer = await qrCode.toBuffer("png");
    fs.writeFileSync(filePath, buffer);
    console.log(`🔔 Webhook: QR PRO generado: ${filePath}`);
    res.json({
      success: true,
      message: 'Código QR PRO generado correctamente',
      path: filePath,
      filename: filename
    });
  } catch (err) {
    console.error('❌ Error en webhook:', err);
    res.status(500).json({ error: 'No se pudo generar el QR PRO' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Webhook PRO listo y escuchando peticiones POST en http://localhost:${PORT}/webhook/generate`);
});
