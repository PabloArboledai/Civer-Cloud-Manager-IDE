import fs from 'fs';
import path from 'path';
import { QRCodeCanvas } from '@loskir/styled-qr-code-node';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    type: 'string',
    description: 'URL a codificar en el QR',
    demandOption: true
  })
  .option('name', {
    alias: 'n',
    type: 'string',
    description: 'Nombre del archivo generado',
    default: 'qr-code-pro'
  })
  .option('color-dots', {
    type: 'string',
    description: 'Color de los puntos (Hex)',
    default: '#6a11cb'
  })
  .option('color-bg', {
    type: 'string',
    description: 'Color de fondo (Hex)',
    default: '#ffffff'
  })
  .option('dot-style', {
    type: 'string',
    description: 'Estilo de puntos (rounded, dots, classy, classy-rounded, square, extra-rounded)',
    default: 'rounded'
  })
  .option('corner-style', {
    type: 'string',
    description: 'Estilo del marco de esquinas (dot, square, extra-rounded)',
    default: 'extra-rounded'
  })
  .option('logo', {
    type: 'string',
    description: 'Ruta local absoluta o URL de un logo para el centro (opcional)'
  })
  .help()
  .argv;

const outputDir = path.join(process.cwd(), 'generated_qrs');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const generateQR = async () => {
  const filename = `${argv.name}_${Date.now()}.png`;
  const filePath = path.join(outputDir, filename);

  const options = {
    width: 600,
    height: 600,
    data: argv.url,
    margin: 10,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "H" // High correction is good for logos
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 10,
      crossOrigin: "anonymous",
    },
    dotsOptions: {
      color: argv['color-dots'],
      type: argv['dot-style']
    },
    backgroundOptions: {
      color: argv['color-bg'],
    },
    cornersSquareOptions: {
      color: argv['color-dots'],
      type: argv['corner-style']
    },
    cornersDotOptions: {
      color: argv['color-dots'],
      type: "dot"
    }
  };

  if (argv.logo) {
    options.image = argv.logo;
  }

  const qrCode = new QRCodeCanvas(options);

  try {
    const buffer = await qrCode.toBuffer("png");
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Código QR PRO generado exitosamente: ${filePath}`);
  } catch (err) {
    console.error('❌ Error generando el QR PRO:', err);
  }
};

generateQR();
