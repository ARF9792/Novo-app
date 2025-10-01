import React, { useState, useEffect } from 'react';

import { 
  FileText, 
  Upload, 
  Download, 
  Check, 
  AlertCircle, 
  Zap,
  ArrowRight,
  FileCheck,
  Edit3,
  FolderOpen
} from 'lucide-react';
import './DocPreview.css';
// Import mammoth directly instead of using window.mammoth
import * as mammoth from 'mammoth';

function App() {
  const [filePath, setFilePath] = useState(null);
  const [fileName, setFileName] = useState('');
  const [placeholders, setPlaceholders] = useState([]);
  const [values, setValues] = useState({});
  const [step, setStep] = useState(1);
  const [outputFormat, setOutputFormat] = useState('docx');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [docPreview, setDocPreview] = useState('');
  const [electronAPI, setElectronAPI] = useState(null);

  // Check if electronAPI is available
  useEffect(() => {
    if (window.electronAPI) {
      setElectronAPI(window.electronAPI);
      console.log('Electron API is available');
    } else {
      console.error('Electron API is not available');
      setError('Application not running in Electron environment. Please run using: npm run dev');
    }
  }, []);

  const handleFileSelect = async () => {
    if (!electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const path = await electronAPI.openFileDialog();
      if (path) {
        setFilePath(path);
        setFileName(path.split(/[\\/]/).pop());
        setStep(1);
        setPlaceholders([]);
        setValues({});
        
        // Generate preview for DOCX files
        if (path.endsWith('.docx')) {
          try {
            const arrayBufferData = await electronAPI.readFile(path);
            if (arrayBufferData) {
              // Convert array data to ArrayBuffer
              const arrayBuffer = new Uint8Array(arrayBufferData).buffer;
              const result = await mammoth.convertToHtml({ arrayBuffer });
              setDocPreview(result.value || '<p>Preview not available</p>');
            }
          } catch (previewError) {
            console.warn('Preview generation failed:', previewError);
            setDocPreview('<p>Preview not available</p>');
          }
        } else {
          setDocPreview('');
        }
      }
    } catch (error) {
      setError('Failed to select file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processTemplate = async () => {
    if (!filePath || !electronAPI) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await electronAPI.processFile(filePath);
      
      if (result.success) {
        setPlaceholders(result.placeholders);
        setStep(2);
      } else {
        setError('Failed to process template: ' + result.error);
      }
    } catch (error) {
      setError('Failed to process template: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key, value) => {
    setValues({ ...values, [key]: value });
  };

  const generateDocument = async () => {
    if (!filePath || !electronAPI) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await electronAPI.generateDocument({
        filePath,
        values,
        outputFormat
      });

      if (result.success) {
        setSuccess(`Document generated successfully: ${result.filePath}`);
        setStep(3);
      } else {
        setError('Failed to generate document: ' + result.error);
      }
    } catch (error) {
      setError('Failed to generate document: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setFilePath(null);
    setFileName('');
    setPlaceholders([]);
    setValues({});
    setStep(1);
    setError(null);
    setSuccess(null);
    setDocPreview('');
  };

  const getStepIcon = (stepNumber) => {
    if (step > stepNumber) return <Check className="w-5 h-5 text-white" />;
    return <span className="text-sm font-semibold">{stepNumber}</span>;
  };

  const getStepClass = (stepNumber) => {
    if (step > stepNumber) return "bg-green-500 border-green-500";
    if (step === stepNumber) return "bg-blue-500 border-blue-500 text-white";
    return "bg-gray-100 border-gray-300 text-gray-400";
  };

  if (!electronAPI) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Application Error
          </h2>
          <p className="text-gray-600 mb-4">
            This application must be run in Electron. Please use:
          </p>
          <code className="bg-gray-100 px-3 py-2 rounded text-sm block mb-4">
            npm run dev
          </code>
          <p className="text-sm text-gray-500">
            If you're already using npm run dev, check the console for errors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-2xl mb-6">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Contract Template Editor
          </h1>
          <p className="text-gray-600">Desktop Application</p>
        </div>

        {/* Rest of your component remains the same */}
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            {/* Step 1 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${getStepClass(1)}`}>
                {getStepIcon(1)}
              </div>
              <span className="ml-3 font-medium text-gray-700">Select Template</span>
            </div>
            
            <ArrowRight className="w-5 h-5 text-gray-400" />
            
            {/* Step 2 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${getStepClass(2)}`}>
                {getStepIcon(2)}
              </div>
              <span className="ml-3 font-medium text-gray-700">Fill Placeholders</span>
            </div>
            
            <ArrowRight className="w-5 h-5 text-gray-400" />
            
            {/* Step 3 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${getStepClass(3)}`}>
                {getStepIcon(3)}
              </div>
              <span className="ml-3 font-medium text-gray-700">Generate</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center">
            <Check className="w-5 h-5 text-green-500 mr-3" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            
            {/* Step 1: Template Selection */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Select Your Template
                  </h2>
                  <p className="text-gray-600">
                    Choose a .docx template file from your computer
                  </p>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={handleFileSelect}
                    disabled={loading}
                    className="inline-flex items-center px-6 py-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FolderOpen className="w-5 h-5 mr-3" />
                    {loading ? 'Loading...' : 'Select Template File'}
                  </button>
                </div>

                {fileName && (
                  <div className="text-center">
                    <p className="text-gray-700">
                      <strong>Selected file:</strong> {fileName}
                    </p>
                    
                    {filePath && (
                      <button 
                        onClick={processTemplate}
                        disabled={loading}
                        className="mt-4 inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Detect Placeholders
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Preview */}
                {docPreview && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Template Preview:</h3>
                    <div
                      className="docx-preview"
                      dangerouslySetInnerHTML={{ __html: docPreview }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Fill Placeholders */}
            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Fill in the Details
                  </h2>
                  <p className="text-gray-600">
                    Enter values for the placeholders found in your template
                  </p>
                </div>

                {placeholders.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No placeholders found in this template.</p>
                    <button 
                      onClick={resetApp}
                      className="mt-4 text-blue-600 hover:text-blue-800"
                    >
                      Select a different file
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-6 md:grid-cols-2">
                      {placeholders.map((placeholder) => (
                        <div key={placeholder} className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            <Edit3 className="w-3 h-3 inline mr-1" />
                            {placeholder}
                          </label>
                          <input 
                            type="text" 
                            value={values[placeholder] || ''} 
                            onChange={(e) => handleValueChange(placeholder, e.target.value)}
                            placeholder={`Enter ${placeholder}`}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Output format selector */}
                    <div className="flex items-center justify-center gap-4 pt-4">
                      <label className="text-sm font-medium text-gray-700">Output Format:</label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="docx">Word Document (.docx)</option>
                        <option value="pdf">PDF Document (.pdf)</option>
                      </select>
                    </div>

                    <div className="flex justify-center pt-4 gap-4">
                      <button 
                        onClick={resetApp}
                        className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all duration-200"
                      >
                        Back
                      </button>
                      <button 
                        onClick={generateDocument}
                        disabled={loading || placeholders.length === 0}
                        className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-5 h-5 mr-3" />
                            Generate Document
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center space-y-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Document Generated Successfully!
                </h2>
                
                <p className="text-gray-600">
                  Your contract has been generated and saved to your computer.
                </p>

                <div className="flex justify-center gap-4 pt-4">
                  <button 
                    onClick={resetApp}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 text-white font-medium rounded-xl hover:from-blue-600 hover:to-teal-600 transition-all duration-200"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Another Contract
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Contract Generator Desktop Application</p>
          <p className="mt-1">
            {outputFormat === 'pdf' && 'PDF conversion requires LibreOffice to be installed on your system.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;