'use client';

import { useState, useRef } from 'react';
import { Button } from './ui/button';

export default function DocumentUpload({ onDocumentProcessed, onError }) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    // Check file type - only allow PDF, DOCX, MD, and TXT
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      onError('Please upload a .pdf, .docx, .md, or .txt file');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Show success message with extraction count
        const extractionMessage = data.extractedCount > 0 
          ? `Successfully extracted ${data.extractedCount} out of ${data.totalFields} business information fields!`
          : 'Document processed with fallback values. Please review the extracted information.';
        
        console.log('Document processed:', data.extractedInfo, extractionMessage);
        onDocumentProcessed(data.extractedInfo, data.designPrompt);
      } else {
        onError(data.error || 'Failed to process document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          dragActive 
            ? 'border-orange-500 bg-orange-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-orange-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" 
              />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload Business Document
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload your Growth 99 onboarding form or business document to automatically extract design requirements
            </p>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported formats: .pdf, .docx, .md, .txt</p>
              <p>Max file size: 10MB</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                'Choose File'
              )}
            </Button>
            
            <span className="text-sm text-gray-500">or drag and drop</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.md,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
