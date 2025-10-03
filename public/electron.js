const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Log file for debugging in production
const logFile = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Override console methods to write to log file in production
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  originalConsoleLog(...args);
  logStream.write(`[LOG ${new Date().toISOString()}] ${message}\n`);
};

console.error = (...args) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  originalConsoleError(...args);
  logStream.write(`[ERROR ${new Date().toISOString()}] ${message}\n`);
};

console.log('=== Application Starting ===');
console.log('Log file location:', logFile);
console.log('App path:', app.getAppPath());
console.log('Platform:', process.platform);

let mainWindow;

function createWindow() {
  // Get the correct preload path
  const isDev = process.env.ELECTRON_IS_DEV === 'true';
  const preloadPath = path.join(__dirname, 'preload.js');
  
  console.log('=== Electron Starting ===');
  console.log('Is development:', isDev);
  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));
  console.log('__dirname:', __dirname);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: preloadPath,
    },
    show: false // Don't show until ready
  });

  console.log('Window created, loading content...');

  if (isDev) {
    console.log('Loading dev URL: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from build folder
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Loading production file:', indexPath);
    console.log('Index.html exists:', fs.existsSync(indexPath));
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      // Try to show error to user
      mainWindow.show();
      mainWindow.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="font-family: Arial; padding: 40px; text-align: center;">
          <h1 style="color: red;">Failed to Load Application</h1>
          <p>Error: ${err.message}</p>
          <p>Path: ${indexPath}</p>
        </div>';
      `);
    });
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });

  // Add timeout to force show window if it takes too long
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Force showing window after timeout');
      mainWindow.show();
      // Show error dialog if window still doesn't show
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Loading Issue',
        message: 'The application took longer than expected to load. Check the log file at: ' + logFile,
        buttons: ['OK']
      });
    }
  }, 5000);

  // Log any load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle app ready with error catching
app.whenReady().then(() => {
  console.log('=== App Ready ===');
  console.log('Platform:', process.platform);
  console.log('App path:', app.getAppPath());
  console.log('User data:', app.getPath('userData'));
  
  try {
    createWindow();
  } catch (error) {
    console.error('Error creating window:', error);
    // Try to show a basic error dialog
    dialog.showErrorBox('Startup Error', `Failed to create window: ${error.message}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error('App failed to ready:', error);
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Log uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Application Error', `An error occurred: ${error.message}`);
});

// Quit when all windows are closed - important for Windows installer
app.on('before-quit', () => {
  // Force quit all windows
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});

// Handle second instance for Windows (prevent multiple instances)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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

// Generate preview of filled document without saving
ipcMain.handle('generate-preview', async (event, options) => {
  const { filePath, values } = options;
  
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

    // Generate the filled document buffer
    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    
    // Return the buffer as an array for preview
    return { success: true, buffer: Array.from(new Uint8Array(buffer)) };
  } catch (error) {
    console.error('Error generating preview:', error);
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