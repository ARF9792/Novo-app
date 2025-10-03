import React, { useState, useEffect, useMemo } from 'react';

import { 
  FileText, 
  Upload, 
  Download, 
  Check, 
  CheckCircle2,
  AlertCircle, 
  Zap,
  ArrowRight,
  FileCheck,
  Edit3,
  FolderOpen,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  Clock,
  Minus,
  Search,
  ChevronDown,
  ChevronUp
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
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [showAddTemplateDialog, setShowAddTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateForSave, setSelectedTemplateForSave] = useState(null);
  const [finalDocPreview, setFinalDocPreview] = useState('');
  const [generatedDocBuffer, setGeneratedDocBuffer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentTemplates, setRecentTemplates] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check if electronAPI is available
  useEffect(() => {
    if (window.electronAPI) {
      setElectronAPI(window.electronAPI);
      console.log('Electron API is available');
      loadSavedTemplates();
      loadRecentTemplates();
    } else {
      console.error('Electron API is not available');
      setError('Application not running in Electron environment. Please run using: npm run dev');
    }
  }, []);

  // Load saved templates from localStorage
  const loadSavedTemplates = () => {
    try {
      const saved = localStorage.getItem('savedTemplates');
      if (saved) {
        setSavedTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved templates:', error);
    }
  };

  // Load recent templates from localStorage
  const loadRecentTemplates = () => {
    try {
      const recent = localStorage.getItem('recentTemplates');
      if (recent) {
        setRecentTemplates(JSON.parse(recent));
      }
    } catch (error) {
      console.error('Failed to load recent templates:', error);
    }
  };

  // Add to recent templates
  const addToRecent = (template) => {
    const recent = [template.id, ...recentTemplates.filter(id => id !== template.id)].slice(0, 3);
    setRecentTemplates(recent);
    localStorage.setItem('recentTemplates', JSON.stringify(recent));
  };

  // Auto-dismiss error notification
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        setTimeout(() => setError(null), 300); // Wait for fade out animation
      }, 2000); // Show for 2 seconds
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (success) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setTimeout(() => setSuccess(null), 300); // Wait for fade out animation
      }, 2000); // Show for 2 seconds
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Cmd/Ctrl + Enter to proceed
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (step === 1 && filePath) {
          processTemplate();
        } else if (step === 2 && placeholders.length > 0) {
          generatePreview();
        } else if (step === 3) {
          generateDocument();
        }
      }
      
      // Escape to go back
      if (e.key === 'Escape' && step > 1 && step < 4) {
        if (step === 2) setStep(1);
        if (step === 3) setStep(2);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [step, filePath, placeholders, electronAPI]);

  // Save templates to localStorage
  const saveTemplatesToStorage = (templates) => {
    try {
      localStorage.setItem('savedTemplates', JSON.stringify(templates));
      setSavedTemplates(templates);
    } catch (error) {
      console.error('Failed to save templates:', error);
      setError('Failed to save templates');
    }
  };

  // Add a new saved template
  const handleAddTemplate = async () => {
    if (!electronAPI) {
      setError('Electron API not available');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const path = await electronAPI.openFileDialog();
      if (path) {
        setSelectedTemplateForSave(path);
        setShowAddTemplateDialog(true);
      }
    } catch (error) {
      setError('Failed to select file: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Save template with custom name
  const confirmSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      setError('Please enter a template name');
      return;
    }

    if (!selectedTemplateForSave) {
      setError('No file selected');
      return;
    }

    const newTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      path: selectedTemplateForSave,
      addedDate: new Date().toISOString()
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    saveTemplatesToStorage(updatedTemplates);
    
    setShowAddTemplateDialog(false);
    setNewTemplateName('');
    setSelectedTemplateForSave(null);
    setSuccess(`Template "${newTemplate.name}" saved successfully!`);
  };

  // Delete a saved template
  const handleDeleteTemplate = (templateId) => {
    const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
    saveTemplatesToStorage(updatedTemplates);
    setSuccess('Template removed from saved list');
    setDeleteConfirm(null);
  };

  // Select a saved template
  const handleSelectSavedTemplate = async (template) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      setFilePath(template.path);
      setFileName(template.name);
      setStep(1);
      setPlaceholders([]);
      setValues({});
      
      // Generate preview for DOCX files
      if (template.path.endsWith('.docx')) {
        try {
          const arrayBufferData = await electronAPI.readFile(template.path);
          if (arrayBufferData) {
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
      
      addToRecent(template);
      setSuccess(`Template "${template.name}" loaded successfully!`);
    } catch (error) {
      setError('Failed to load template: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  // Generate preview of the filled document
  const generatePreview = async () => {
    if (!filePath || !electronAPI) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await electronAPI.generatePreview({
        filePath,
        values
      });

      if (result.success && result.buffer) {
        // Convert buffer to ArrayBuffer and generate HTML preview
        const arrayBuffer = new Uint8Array(result.buffer).buffer;
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        setFinalDocPreview(htmlResult.value || '<p>Preview not available</p>');
        setGeneratedDocBuffer(result.buffer);
        setStep(3); // Move to preview step
      } else {
        setError('Failed to generate preview: ' + result.error);
      }
    } catch (error) {
      setError('Failed to generate preview: ' + error.message);
    } finally {
      setLoading(false);
    }
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
        setStep(4); // Move to success step
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
    setFinalDocPreview('');
    setGeneratedDocBuffer(null);
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
      <div className="min-h-screen bg-primary-50 flex items-center justify-center">
        <div className="card-professional p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-heading text-xl mb-3">
            Application Error
          </h2>
          <p className="text-body mb-4">
            This application must be run in Electron. Please use:
          </p>
          <code className="bg-gray-100 px-3 py-2 rounded text-sm block mb-4 font-mono">
            npm run dev
          </code>
          <p className="text-caption">
            If you're already using npm run dev, check the console for errors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-50">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        {/* Professional Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-12 h-12 bg-navy-800 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-heading text-3xl">
                  Contract Template Editor
                </h1>
                <p className="text-caption mt-1">Professional Document Generation</p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-caption">Desktop Application</p>
                <p className="text-xs text-gray-400">Version 1.0</p>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Progress Steps */}
        <div className="card-professional p-6 mb-6">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {[
              { num: 1, label: 'Template Selection', icon: FolderOpen },
              { num: 2, label: 'Data Entry', icon: Edit3 },
              { num: 3, label: 'Document Preview', icon: Eye },
              { num: 4, label: 'Export Document', icon: Download }
            ].map((item, index) => (
              <React.Fragment key={item.num}>
                <div className="flex flex-col items-center flex-1">
                  <div className={`
                    relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 mb-3
                    ${step > item.num ? 'bg-accent-600 text-white' : ''}
                    ${step === item.num ? 'bg-navy-800 text-white ring-2 ring-navy-300' : ''}
                    ${step < item.num ? 'bg-gray-100 text-gray-400 border border-gray-300' : ''}
                  `}>
                    {step > item.num ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <item.icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`
                      text-xs font-medium mb-1
                      ${step >= item.num ? 'text-navy-900' : 'text-gray-400'}
                    `}>
                      Step {item.num}
                    </div>
                    <div className={`
                      text-sm font-medium
                      ${step >= item.num ? 'text-navy-700' : 'text-gray-400'}
                    `}>
                      {item.label}
                    </div>
                  </div>
                </div>
                
                {index < 3 && (
                  <div className={`
                    flex-1 h-px mx-4 transition-all duration-300 max-w-[100px]
                    ${step > item.num ? 'bg-accent-600' : 'bg-gray-200'}
                  `} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>



        {/* Professional Main Content */}
        <div className="card-professional overflow-hidden">
          <div className="p-8">
            
            {/* Step 1: Professional Template Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-heading text-2xl mb-2">
                    Template Selection
                  </h2>
                  <p className="text-body">
                    Choose from your saved templates or browse for a new document
                  </p>
                </div>

                {/* Professional Saved Templates Section */}
                {savedTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-subheading text-lg flex items-center">
                        <Save className="w-5 h-5 mr-3 text-navy-600" />
                        Saved Templates
                      </h3>
                      <button
                        onClick={handleAddTemplate}
                        disabled={loading}
                        className="btn-primary disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Template
                      </button>
                    </div>

                    {/* Professional All Templates - Expandable List */}
                    <div id="templates-dropdown" className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowAllTemplates(!showAllTemplates)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                      >
                        <div className="flex items-center">
                          <h4 className="text-subheading text-base">All Templates ({savedTemplates.length})</h4>
                        </div>
                        {showAllTemplates ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      
                      {showAllTemplates && (
                        <div className="bg-white">
                          {(() => {
                            return (
                              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {savedTemplates.map((template, index) => (
                                  <div
                                    key={template.id}
                                    className="group hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                                    onClick={() => {
                                      handleSelectSavedTemplate(template);
                                      setShowAllTemplates(false);
                                      // Scroll to the file selection section
                                      setTimeout(() => {
                                        document.getElementById('file-selection-section')?.scrollIntoView({ 
                                          behavior: 'smooth', 
                                          block: 'center' 
                                        });
                                      }, 100);
                                    }}
                                  >
                                    <div className="flex items-center justify-between p-4">
                                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        <div className="bg-gray-100 rounded-lg p-2 flex-shrink-0">
                                          <FileText className="w-4 h-4 text-navy-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium text-navy-900 truncate">
                                            {template.name}
                                          </h4>
                                          <p className="text-xs text-gray-500 truncate">
                                            {template.path.split(/[\\/]/).pop()} • Added {new Date(template.addedDate || Date.now()).toLocaleDateString()}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirm(template.id);
                                          }}
                                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200"
                                          title="Remove template"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                        <ArrowRight className="w-4 h-4 text-navy-600" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="relative my-8">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-6 bg-white text-caption font-medium">or browse for new file</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional Add Template Button (if no templates saved) */}
                {savedTemplates.length === 0 && (
                  <div className="mb-8">
                    <button
                      onClick={handleAddTemplate}
                      disabled={loading}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-navy-400 hover:bg-primary-50 transition-all duration-200 disabled:opacity-50 group"
                    >
                      <div className="bg-primary-100 group-hover:bg-navy-100 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 transition-all duration-200">
                        <Plus className="w-8 h-8 text-primary-400 group-hover:text-navy-600 transition-colors duration-200" />
                      </div>
                      <p className="text-subheading text-lg mb-1">Add Your First Template</p>
                      <p className="text-caption">Save templates for quick access later</p>
                    </button>
                  </div>
                )}

                <div id="file-selection-section" className="text-center">
                  <button 
                    onClick={handleFileSelect}
                    disabled={loading}
                    className="btn-primary px-8 py-4 text-base disabled:cursor-not-allowed"
                  >
                    <FolderOpen className="w-5 h-5 mr-3" />
                    {loading ? 'Loading...' : 'Browse for Template File'}
                  </button>
                </div>

                {fileName && (
                  <div className="mt-6 p-6 bg-primary-50 border border-primary-200 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-3">
                        <FileText className="w-5 h-5 text-accent-600 mr-2" />
                        <p className="text-body font-medium">Selected Template</p>
                      </div>
                      <p className="text-navy-900 font-semibold mb-4">
                        {fileName}
                      </p>
                      
                      {filePath && (
                        <button 
                          onClick={processTemplate}
                          disabled={loading}
                          className="btn-primary disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processing Template...
                            </>
                          ) : (
                            <>
                              Continue to Data Entry
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Professional Loading Preview */}
                {loading && step === 1 && (
                  <div className="mt-8 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3 card-professional p-6">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-3 bg-gray-200 rounded w-4/6"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                )}
                {docPreview && !loading && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-blue-500" />
                      Template Preview:
                    </h3>
                    <div
                      className="docx-preview border border-gray-200 rounded-xl p-4 bg-white"
                      dangerouslySetInnerHTML={{ __html: docPreview }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Professional Data Entry */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-heading text-2xl mb-2">
                    Data Entry
                  </h2>
                  <p className="text-body">
                    Enter values for the placeholders identified in your template
                  </p>
                </div>

                {/* Professional Progress Indicator */}
                {placeholders.length > 0 && (
                  <div className="bg-primary-50 border-l-4 border-accent-500 rounded-r-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-body font-medium">
                        Completion Progress: {placeholders.filter(p => values[p] && values[p].trim() !== '').length} of {placeholders.length} fields
                      </span>
                      <span className="text-lg font-semibold text-accent-600">
                        {Math.round((placeholders.filter(p => values[p] && values[p].trim() !== '').length / placeholders.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-accent-600 h-full transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${Math.round((placeholders.filter(p => values[p] && values[p].trim() !== '').length / placeholders.length) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {placeholders.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="bg-gray-100 w-20 h-20 rounded-lg flex items-center justify-center mx-auto mb-6">
                      <FileText className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-subheading text-xl mb-3">No Placeholders Detected</h3>
                    <p className="text-body mb-8 max-w-md mx-auto leading-relaxed">
                      This template doesn't contain any placeholders. Ensure your template uses the {'{'}placeholder{'}'} format for dynamic content.
                    </p>
                    <button 
                      onClick={resetApp}
                      className="btn-secondary"
                    >
                      <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                      Select Different Template
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-6 lg:grid-cols-2">
                      {placeholders.map((placeholder) => {
                        const isFilled = values[placeholder] && values[placeholder].trim() !== '';
                        return (
                          <div key={placeholder} className="space-y-3">
                            <label className="flex items-center justify-between">
                              <span className="text-subheading text-sm flex items-center">
                                <Edit3 className="w-4 h-4 mr-2 text-navy-500" />
                                {placeholder}
                              </span>
                              {isFilled && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Complete
                                </span>
                              )}
                            </label>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={values[placeholder] || ''} 
                                onChange={(e) => handleValueChange(placeholder, e.target.value)}
                                placeholder={`Enter ${placeholder.toLowerCase()}`}
                                className={`input-professional ${
                                  isFilled 
                                    ? 'border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500' 
                                    : ''
                                }`}
                              />
                              {isFilled && (
                                <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between pt-8">
                      <button 
                        onClick={resetApp}
                        className="btn-secondary"
                      >
                        ← Back to Templates
                      </button>
                      <button 
                        onClick={generatePreview}
                        disabled={loading || placeholders.length === 0}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                            Generating Preview...
                          </>
                        ) : (
                          <>
                            <Eye className="w-5 h-5 mr-3" />
                            Preview Document
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Professional Document Preview */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-heading text-2xl mb-2">
                    Document Preview
                  </h2>
                  <p className="text-body">
                    Review your completed document before final export
                  </p>
                </div>

                {/* Professional Loading Preview */}
                {loading && step === 3 && (
                  <div className="card-professional p-6 animate-pulse">
                    <div className="flex items-center justify-between mb-6">
                      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-8 bg-gray-200 rounded w-24"></div>
                    </div>
                    <div className="space-y-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/5"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                )}

                {/* Professional Document Preview */}
                {finalDocPreview && !loading && (
                  <div className="card-professional p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-subheading text-lg flex items-center">
                        <Eye className="w-5 h-5 mr-3 text-navy-600" />
                        Generated Document
                      </h3>
                      
                      {/* Professional Zoom Controls */}
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1">
                        <button
                          onClick={() => setPreviewZoom(Math.max(50, previewZoom - 10))}
                          className="p-2 hover:bg-white rounded transition-all shadow-sm"
                          title="Zoom Out"
                        >
                          <Minus className="w-4 h-4 text-gray-600" />
                        </button>
                        <span className="px-3 text-sm font-medium text-navy-700 min-w-[4rem] text-center">
                          {previewZoom}%
                        </span>
                        <button
                          onClick={() => setPreviewZoom(Math.min(200, previewZoom + 10))}
                          className="p-2 hover:bg-white rounded transition-all shadow-sm"
                          title="Zoom In"
                        >
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-[500px] overflow-y-auto border border-gray-200 rounded-lg">
                      <div
                        className="docx-preview transition-transform duration-200"
                        style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top left' }}
                        dangerouslySetInnerHTML={{ __html: finalDocPreview }}
                      />
                    </div>
                  </div>
                )}

                {/* Professional Export Options */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-subheading text-base mb-1 block">Export Format</label>
                      <p className="text-caption">Choose your final document format</p>
                    </div>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="input-professional min-w-[200px]"
                    >
                      <option value="docx">Microsoft Word (.docx)</option>
                      <option value="pdf">Adobe PDF (.pdf)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <button 
                    onClick={() => setStep(2)}
                    className="btn-secondary"
                  >
                    ← Edit Details
                  </button>
                  <button 
                    onClick={generateDocument}
                    disabled={loading}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed bg-green-700 hover:bg-green-800 focus:ring-green-500"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                        Exporting Document...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-3" />
                        Export Document
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Professional Success */}
            {step === 4 && (
              <div className="text-center space-y-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-lg mb-6">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                
                <div>
                  <h2 className="text-heading text-2xl mb-3">
                    Document Export Complete
                  </h2>
                  
                  <p className="text-body max-w-md mx-auto leading-relaxed">
                    Your contract document has been successfully generated and exported to your selected location.
                  </p>
                </div>

                <div className="flex justify-center gap-4 pt-6">
                  <button 
                    onClick={resetApp}
                    className="btn-primary"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Another Contract
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Professional Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-caption font-medium">Contract Template Editor v1.0</p>
          <p className="text-xs text-gray-400 mt-1">
            {outputFormat === 'pdf' && 'PDF export requires LibreOffice installation'}
          </p>
        </div>
      </div>

      {/* Professional Add Template Dialog */}
      {showAddTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-professional-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowAddTemplateDialog(false);
                setNewTemplateName('');
                setSelectedTemplateForSave(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-navy-100 rounded-lg mb-4">
                <Save className="w-6 h-6 text-navy-600" />
              </div>
              <h3 className="text-heading text-xl mb-2">
                Save Template
              </h3>
              <p className="text-body text-sm">
                Provide a descriptive name for easy identification
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-subheading text-sm mb-3">
                Template Name
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Employment Agreement, Service Contract"
                className="input-professional"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    confirmSaveTemplate();
                  }
                }}
              />
            </div>

            {selectedTemplateForSave && (
              <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
                <p className="text-xs font-medium text-navy-600 mb-1">Selected File</p>
                <p className="text-sm text-navy-900 truncate font-medium">
                  {selectedTemplateForSave.split(/[\\/]/).pop()}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddTemplateDialog(false);
                  setNewTemplateName('');
                  setSelectedTemplateForSave(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveTemplate}
                disabled={!newTemplateName.trim()}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-professional-xl max-w-md w-full p-6 relative">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-heading text-xl mb-2">
                Delete Template
              </h3>
              <p className="text-body text-sm">
                This action will permanently remove the template from your saved list. The original file will not be affected.
              </p>
            </div>

            {savedTemplates.find(t => t.id === deleteConfirm) && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-900 mb-1">
                  {savedTemplates.find(t => t.id === deleteConfirm).name}
                </p>
                <p className="text-xs text-red-600 truncate">
                  {savedTemplates.find(t => t.id === deleteConfirm).path.split(/[\\/]/).pop()}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteTemplate(deleteConfirm);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none">
        {/* Error Toast */}
        {error && (
          <div 
            className={`pointer-events-auto transform transition-all duration-300 ease-out ${
              showError 
                ? 'translate-x-0 opacity-100' 
                : 'translate-x-full opacity-0'
            }`}
          >
            <div className="bg-white rounded-lg shadow-professional-xl border-l-4 border-red-500 p-4 min-w-[320px] max-w-md">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-red-900 text-sm mb-1">Error</h4>
                  <p className="text-red-800 text-sm leading-relaxed">{error}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowError(false);
                    setTimeout(() => setError(null), 300);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1 bg-red-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 animate-progress"
                  style={{ animation: 'progress 2s linear' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {success && (
          <div 
            className={`pointer-events-auto transform transition-all duration-300 ease-out ${
              showSuccess 
                ? 'translate-x-0 opacity-100' 
                : 'translate-x-full opacity-0'
            }`}
          >
            <div className="bg-white rounded-lg shadow-professional-xl border-l-4 border-green-500 p-4 min-w-[320px] max-w-md">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-green-900 text-sm mb-1">Success</h4>
                  <p className="text-green-800 text-sm leading-relaxed">{success}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowSuccess(false);
                    setTimeout(() => setSuccess(null), 300);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1 bg-green-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 animate-progress"
                  style={{ animation: 'progress 2s linear' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;