const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

let mainWindow;

function createWindow() {
  // Get the correct preload path
  //const preloadPath = path.join(__dirname, 'public', 'preload.js');
  const isDev = process.env.ELECTRON_IS_DEV === 'true';

const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
    },
    show: false // Don't show until ready
  });

  // Check if we're in development or production
 //const isDev = process.env.ELECTRON_IS_DEV === 'true';
  console.log('Is development:', isDev);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from build folder
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Open file dialog to select template
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error in open-file-dialog:', error);
    throw error;
  }
});

// Read file for preview
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return Array.from(new Uint8Array(data.buffer));
  } catch (error) {
    console.error('Error reading file for preview:', error);
    throw error;
  }
});

// Process file and extract placeholders
ipcMain.handle('process-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true 
    });

    const text = doc.getFullText();
    const placeholders = extractPlaceholders(text);
    
    return { success: true, placeholders };
  } catch (error) {
    console.error('Error processing file:', error);
    return { success: false, error: error.message };
  }
});

// Generate document with filled placeholders
ipcMain.handle('generate-document', async (event, options) => {
  const { filePath, values, outputFormat } = options;
  
  try {
    // Read and process the template
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    // Set the data and render
    doc.render(values);

    // Generate the filled document
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    
    if (outputFormat === 'docx') {
      // Save DOCX directly
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'contract.docx',
        filters: [
          { name: 'Word Documents', extensions: ['docx'] }
        ]
      });

      if (!result.canceled) {
        fs.writeFileSync(result.filePath, buffer);
        return { success: true, filePath: result.filePath };
      }
    } else if (outputFormat === 'pdf') {
      // Save temporary DOCX and convert to PDF using LibreOffice
      const tempDir = require('os').tmpdir();
      const tempDocxPath = path.join(tempDir, `temp_contract_${Date.now()}.docx`);
      const tempPdfPath = path.join(tempDir, `temp_contract_${Date.now()}.pdf`);
      
      // Write temporary DOCX
      fs.writeFileSync(tempDocxPath, buffer);
      
      // Convert to PDF using LibreOffice
      await convertToPdf(tempDocxPath, tempPdfPath);
      
      // Show save dialog for PDF
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: 'contract.pdf',
        filters: [
          { name: 'PDF Documents', extensions: ['pdf'] }
        ]
      });

      if (!result.canceled) {
        const pdfData = fs.readFileSync(tempPdfPath);
        fs.writeFileSync(result.filePath, pdfData);
        
        // Clean up temporary files
        try {
          fs.unlinkSync(tempDocxPath);
          fs.unlinkSync(tempPdfPath);
        } catch (cleanupError) {
          console.warn('Could not clean up temp files:', cleanupError);
        }
        
        return { success: true, filePath: result.filePath };
      }
      
      // Clean up if user canceled
      try {
        fs.unlinkSync(tempDocxPath);
        fs.unlinkSync(tempPdfPath);
      } catch (cleanupError) {
        console.warn('Could not clean up temp files:', cleanupError);
      }
    }
    
    return { success: false, error: 'Save operation canceled' };
  } catch (error) {
    console.error('Error generating document:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to extract placeholders from text
function extractPlaceholders(text) {
  const regex = /\{(.*?)\}/g;
  const matches = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  
  return Array.from(new Set(matches));
}

// Helper function to convert DOCX to PDF using LibreOffice
function convertToPdf(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    let command;
    
    if (process.platform === 'win32') {
      // Windows
      command = `soffice --headless --convert-to pdf --outdir "${require('path').dirname(outputPath)}" "${inputPath}"`;
    } else if (process.platform === 'darwin') {
      // macOS
      command = `/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir "${require('path').dirname(outputPath)}" "${inputPath}"`;
    } else {
      // Linux
      command = `libreoffice --headless --convert-to pdf --outdir "${require('path').dirname(outputPath)}" "${inputPath}"`;
    }

    console.log('Running LibreOffice command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('LibreOffice conversion error:', error);
        console.error('STDERR:', stderr);
        
        // Fallback: try alternative command formats
        const fallbackCommand = command.replace('soffice', 'libreoffice');
        console.log('Trying fallback command:', fallbackCommand);
        
        exec(fallbackCommand, (fallbackError) => {
          if (fallbackError) {
            reject(new Error(`LibreOffice conversion failed. Please ensure LibreOffice is installed. Error: ${fallbackError.message}`));
          } else {
            resolve();
          }
        });
      } else {
        console.log('LibreOffice conversion successful:', stdout);
        resolve();
      }
    });
  });
}