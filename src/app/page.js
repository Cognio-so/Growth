'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { Textarea } from '../../components/ui/textarea';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  FiFile,
  FiGithub,
  FiChevronRight,
  FiChevronDown,
  BsFolderFill,
  BsFolder2Open,
  SiJavascript,
  SiReact,
  SiCss3,
  SiJson
} from '../lib/icons';
import { motion, AnimatePresence } from 'framer-motion';
import CodeApplicationProgress from '../../components/CodeApplicationProgress';
import appConfig from '../../config/app.config';
import { Button } from '../../components/ui/button';
import ProgressStages from '../../components/ProgressStages';
import DocumentUpload from '../../components/DocumentUpload';

// Create a wrapper component that uses useSearchParams
function AISandboxPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [sandboxData, setSandboxData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      content: 'Welcome! I can help you generate code with full context of your sandbox files and structure. Just start chatting - I\'ll automatically create a sandbox for you if needed!\n\nTip: If you see package errors like "react-router-dom not found", just type "npm install" or "check packages" to automatically install missing packages.',
      type: 'system',
      timestamp: new Date()
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiEnabled] = useState(true);
  const [aiModel, setAiModel] = useState(() => {
    const modelParam = searchParams.get('model');
    return appConfig.ai.availableModels.includes(modelParam || '') ? modelParam : appConfig.ai.defaultModel;
  });
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['app', 'src', 'src/components']));
  const [selectedFile, setSelectedFile] = useState(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [loadingStage, setLoadingStage] = useState(null);
  const [sandboxFiles, setSandboxFiles] = useState({});
  const [fileStructure, setFileStructure] = useState('');
  const [progressStages, setProgressStages] = useState({
    currentStage: null,
    stages: [
      { id: 'scraping', label: 'Scraping', description: 'Gathering website content and structure', completed: false },
      { id: 'gathering', label: 'Gathering Content', description: 'Analyzing and organizing content', completed: false },
      { id: 'guidelines', label: 'Following Growth 99 Guidelines', description: 'Applying UI/UX design principles', completed: false },
      { id: 'generating', label: 'Generating Content', description: 'Creating React components and code', completed: false },
      { id: 'applying', label: 'Applying', description: 'Deploying code to sandbox', completed: false },
      { id: 'ready', label: 'Ready', description: 'Your app is ready to view', completed: false }
    ]
  });

  const iframeRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const codeDisplayRef = useRef(null);

  const [codeApplicationState, setCodeApplicationState] = useState({
    stage: null
  });

  const [generationProgress, setGenerationProgress] = useState({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    thinkingText: '',
    thinkingDuration: 0,
    currentFile: { path: '', content: '', type: '' },
    files: [],
    lastProcessedPosition: 0,
    isEdit: false
  });

  const [conversationContext, setConversationContext] = useState({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0,
    scrapedWebsites: [],
    appliedCode: []
  });

  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [extractedBusinessInfo, setExtractedBusinessInfo] = useState(null);
  const [documentDesignPrompt, setDocumentDesignPrompt] = useState('');
  const [showExtractedDataReview, setShowExtractedDataReview] = useState(false);
  const [editableExtractedInfo, setEditableExtractedInfo] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const initializePage = async () => {

      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' })
        });
        console.log('[home] Cleared old conversation data on mount');
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
        if (isMounted) {
          addChatMessage('Failed to clear old conversation data.', 'error');
        }
      }

      if (!isMounted) return;


      const sandboxIdParam = searchParams.get('sandbox');

      setLoading(true);
      try {
        if (sandboxIdParam) {
          console.log('[home] Attempting to restore sandbox:', sandboxIdParam);

          await createSandbox(true);
        } else {
          console.log('[home] No sandbox in URL, creating new sandbox automatically...');
          await createSandbox(true);
        }
      } catch (error) {
        console.error('[ai-sandbox] Failed to create or restore sandbox:', error);
        if (isMounted) {
          addChatMessage('Failed to create or restore sandbox.', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializePage();

    return () => {
      isMounted = false;
    };
  }, []); // Run only on mount

  useEffect(() => {

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen]);


  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = 'https://' + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {

    checkSandboxStatus();


    const handleFocus = () => {
      checkSandboxStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);


  const updateStatus = (text, active) => {
    setStatus({ text, active });
  };

  const log = (message, type = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content, type, metadata) => {
    setChatMessages(prev => {

      if (type === 'system' && prev.length > 0) { 
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.type === 'system' && lastMessage.content === content) {
          return prev;
        }
      }
      return [...prev, { content, type, timestamp: new Date(), metadata }];
    });
  };

  const checkAndInstallPackages = async () => {
    if (!sandboxData) {
      addChatMessage('No active sandbox. Create a sandbox first!', 'system');
      return;
    }


    addChatMessage('Sandbox is ready. Vite configuration is handled by the template.', 'system');
  };

  const handleSurfaceError = (errors) => {



    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
  };

  const installPackages = async (packages) => {
    if (!sandboxData) {
      addChatMessage('No active sandbox. Create a sandbox first!', 'system');
      return;
    }

    try {
      const response = await fetch('/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      });

      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'command':

                  if (!data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                case 'output':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'error':
                  if (data.message && data.message !== 'undefined') {
                    addChatMessage(data.message, 'command', { commandType: 'error' });
                  }
                  break;
                case 'warning':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'success':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                case 'status':
                  addChatMessage(data.message, 'system');
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      addChatMessage(`Failed to install packages: ${error.message}`, 'system');
    }
  };

  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();

      if (data.active && data.healthy && data.sandboxData) {
        setSandboxData(data.sandboxData);
        updateStatus('Sandbox active', true);
      } else if (data.active && !data.healthy) {
        updateStatus('Sandbox not responding', false);
      } else {
        setSandboxData(null);
        updateStatus('No sandbox', false);
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      setSandboxData(null);
      updateStatus('Error', false);
    }
  };

  const createSandbox = async (fromHomeScreen = false) => {
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus('Creating sandbox...', false);
    setResponseArea([]);
    setScreenshotError(null);

    try {
      const response = await fetch('/api/create-ai-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      console.log('[createSandbox] Response data:', data);

      if (data.success) {
        setSandboxData(data);
        updateStatus('Sandbox active', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);

        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        newParams.set('model', aiModel);
        router.push(`/?${newParams.toString()}`, { scroll: false });

        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);

        if (data.structure) {
          displayStructure(data.structure);
        }

        setTimeout(fetchSandboxFiles, 1000);

        setTimeout(async () => {
          try {
            console.log('[createSandbox] Ensuring Vite server is running...');
            
            // Add check to ensure sandbox is ready
            if (!global.activeSandbox) {
              console.log('[createSandbox] Sandbox not ready yet, skipping Vite restart');
              return;
            }
            
            const restartResponse = await fetch('/api/restart-vite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });

            if (restartResponse.ok) {
              const restartData = await restartResponse.json();
              if (restartData.success) {
                console.log('[createSandbox] Vite server started successfully');
              }
            }
          } catch (error) {
            console.error('[createSandbox] Error starting Vite server:', error);
          }
        }, 2000);

        if (!fromHomeScreen) {
          addChatMessage(`Sandbox created! ID: ${data.sandboxId}. I now have context of your sandbox and can help you build your app. Just ask me to create components and I'll automatically apply them!

Tip: I automatically detect and install npm packages from your code imports (like react-router-dom, axios, etc.)`, 'system');
        }

        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[createSandbox] Error:', error);
      updateStatus('Error', false);
      log(`Failed to create sandbox: ${error.message}`, 'error');
      addChatMessage(`Failed to create sandbox: ${error.message}`, 'system');
    } finally {
      setLoading(false);
    }
  };

  const displayStructure = (structure) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || 'No structure available');
    }
  };

  const applyGeneratedCode = async (code, isEdit = false) => {
    setLoadingStage('applying');
    log('Applying AI-generated code...');

    try {
      setCodeApplicationState({ stage: 'analyzing' });

      const pendingPackages = ((window).pendingPackages || []).filter((pkg) => pkg && typeof pkg === 'string');
      if (pendingPackages.length > 0) {
        console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
        (window).pendingPackages = [];
      }

      const response = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: sandboxData?.sandboxId // Pass the sandbox ID to ensure proper connection
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'start':
                  setCodeApplicationState({ stage: 'analyzing' });
                  break;

                case 'step':
                  if (data.message.includes('Installing') && data.packages) {
                    setCodeApplicationState({
                      stage: 'installing',
                      packages: data.packages
                    });
                  } else if (data.message.includes('Creating files') || data.message.includes('Applying')) {
                    setCodeApplicationState({
                      stage: 'applying',
                      filesGenerated: results.filesCreated
                    });
                  }
                  break;

                case 'package-progress':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({
                      ...prev,
                      installedPackages: data.installedPackages
                    }));
                  }
                  break;

                case 'command':

                  if (data.command && !data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;

                case 'success':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({
                      ...prev,
                      installedPackages: data.installedPackages
                    }));
                  }
                  break;

                case 'file-progress':

                  break;

                case 'file-complete':

                  break;

                case 'command-progress':
                  addChatMessage(`${data.action} command: ${data.command}`, 'command', { commandType: 'input' });
                  break;

                case 'command-output':
                  addChatMessage(data.output, 'command', {
                    commandType: data.stream === 'stderr' ? 'error' : 'output'
                  });
                  break;

                case 'command-complete':
                  if (data.success) {
                    addChatMessage(`Command completed successfully`, 'system');
                  } else {
                    addChatMessage(`Command failed with exit code ${data.exitCode}`, 'system');
                  }
                  break;

                case 'complete':
                  finalData = data;
                  setCodeApplicationState({ stage: 'complete' });

                  setTimeout(() => {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  break;

                case 'error':
                  addChatMessage(`Error: ${data.message || data.error || 'Unknown error'}`, 'system');
                  break;

                case 'warning':
                  addChatMessage(`${data.message}`, 'system');
                  break;

                case 'info':

                  if (data.message) {
                    addChatMessage(data.message, 'system');
                  }
                  break;
              }
            } catch (e) {

            }
          }
        }
      }


      if (finalData && finalData.type === 'complete') {
        const data = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message
        };

        if (data.success) {
          const { results } = data;


          if (results.packagesInstalled?.length > 0) {
            log(`Packages installed: ${results.packagesInstalled.join(', ')}`);
          }

          if (results.filesCreated?.length > 0) {
            log('Files created:');
            results.filesCreated.forEach((file) => {
              log(`  ${file}`, 'command');
            });


            if (sandboxData?.sandboxId && results.filesCreated.length > 0) {

              setTimeout(() => {

                if (iframeRef.current) {
                  iframeRef.current.src = iframeRef.current.src;
                }
              }, 1000);
            }
          }

          if (results.filesUpdated?.length > 0) {
            log('Files updated:');
            results.filesUpdated.forEach((file) => {
              log(`  ${file}`, 'command');
            });
          }


          setConversationContext(prev => ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
              timestamp: new Date()
            }]
          }));

          if (results.commandsExecuted?.length > 0) {
            log('Commands executed:');
            results.commandsExecuted.forEach((cmd) => {
              log(`  $ ${cmd}`, 'command');
            });
          }

          if (results.errors?.length > 0) {
            results.errors.forEach((err) => {
              log(err, 'error');
            });
          }

          if (data.structure) {
            displayStructure(data.structure);
          }

          if (data.explanation) {
            log(data.explanation);
          }

          if (data.autoCompleted) {
            log('Auto-generating missing components...', 'command');

            if (data.autoCompletedComponents) {
              setTimeout(() => {
                log('Auto-generated missing components:', 'info');
                data.autoCompletedComponents.forEach((comp) => {
                  log(`  ${comp}`, 'command');
                });
              }, 1000);
            }
          } else if (data.warning) {
            log(data.warning, 'error');

            if (data.missingImports && data.missingImports.length > 0) {
              const missingList = data.missingImports.join(', ');
              addChatMessage(
                `Ask me to "create the missing components: ${missingList}" to fix these import errors.`,
                'system'
              );
            }
          }

          log('Code applied successfully!');
          console.log('[applyGeneratedCode] Response data:', data);
          console.log('[applyGeneratedCode] Debug info:', data.debug);
          console.log('[applyGeneratedCode] Current sandboxData:', sandboxData);
          
          // Add null checks before logging iframe info
          if (iframeRef.current) {
            console.log('[applyGeneratedCode] Current iframe element:', iframeRef.current);
            console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current.src);
          } else {
            console.log('[applyGeneratedCode] Current iframe element: null (not yet created)');
            console.log('[applyGeneratedCode] Current iframe src: undefined');
          }

          if (results.filesCreated?.length > 0) {
            setConversationContext(prev => ({
              ...prev,
              appliedCode: [...prev.appliedCode, {
                files: results.filesCreated,
                timestamp: new Date()
              }]
            }));



            if (isEdit) {
              addChatMessage(`Edit applied successfully!`, 'system');
            } else {
              // Check if this is part of a generation flow (has recent AI recreation message)
              const recentMessages = chatMessages.slice(-5);
              const isPartOfGeneration = recentMessages.some(m =>
                m.content.includes('AI recreation generated') ||
                m.content.includes('Code generated')
              );

              // Don't show files if part of generation flow to avoid duplication
              if (isPartOfGeneration) {
                addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, 'system');
              } else {
                addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, 'system', {
                  appliedFiles: results.filesCreated
                });
              }
            }

            // If there are failed packages, add a message about checking for errors
            if (results.packagesFailed?.length > 0) {
              addChatMessage(`⚠️ Some packages failed to install. Check the error banner above for details.`, 'system');
            }

            // Fetch updated file structure
            await fetchSandboxFiles();

            // Automatically check and install any missing packages
            await checkAndInstallPackages();

            // Test build to ensure everything compiles correctly
            // Skip build test for now - it's causing errors with undefined activeSandbox
            // The build test was trying to access global.activeSandbox from the frontend,
            // but that's only available in the backend API routes
            console.log('[build-test] Skipping build test - would need API endpoint');

            // Vite error checking removed - handled by template setup
          }

          // Single iframe refresh mechanism - remove all others
          if (iframeRef.current && sandboxData?.url) {
            const packagesInstalled = results?.packagesInstalled?.length > 0 || data.results?.packagesInstalled?.length > 0;
            const refreshDelay = packagesInstalled ? 3000 : 1500; // Reduced delays
            
            console.log(`[applyGeneratedCode] Scheduling iframe refresh in ${refreshDelay}ms (packages installed: ${packagesInstalled})`);
            
            setTimeout(() => {
              if (iframeRef.current && sandboxData?.url) {
                console.log('[applyGeneratedCode] Refreshing iframe...');
                
                // Simple src change with timestamp - let Vite HMR handle the rest
                const urlWithTimestamp = `${sandboxData.url}?t=${Date.now()}&refresh=true`;
                iframeRef.current.src = urlWithTimestamp;
                
                console.log('[applyGeneratedCode] Iframe refresh initiated');
              }
            }, refreshDelay);
          }

          // TO HERE
        } else {
          throw new Error(finalData?.error || 'Failed to apply code');
        }
      } else {

        addChatMessage('Code application may have partially succeeded. Check the preview.', 'system');
      }
    } catch (error) {
      log(`Failed to apply code: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev => ({
        ...prev,
        isEdit: false
      }));
      setLoadingStage('ready');
      setTimeout(() => {
        setLoadingStage(null);
      }, 2000);
    }
  };

  const fetchSandboxFiles = async () => {
    if (!sandboxData) return;

    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  };

  const restartViteServer = async () => {
    try {
      addChatMessage('Restarting Vite dev server...', 'system');

      const response = await fetch('/api/restart-vite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          addChatMessage('✓ Vite dev server restarted successfully!', 'system');

          // Refresh the iframe after a short delay
          setTimeout(() => {
            if (iframeRef.current && sandboxData?.url) {
              iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
            }
          }, 2000);
        } else {
          addChatMessage(`Failed to restart Vite: ${data.error}`, 'error');
        }
      } else {
        addChatMessage('Failed to restart Vite server', 'error');
      }
    } catch (error) {
      console.error('[restartViteServer] Error:', error);
      addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const applyCode = async () => {
    const code = promptInput.trim();
    if (!code) {
      log('Please enter some code first', 'error');
      addChatMessage('No code to apply. Please generate code first.', 'system');
      return;
    }

    // Prevent double clicks
    if (loading) {
      console.log('[applyCode] Already loading, skipping...');
      return;
    }

    // Determine if this is an edit based on whether we have applied code before
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(code, isEdit);
  };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
      return (
        /* Generation Tab Content */
        <div className="absolute inset-0 flex overflow-hidden">
          {/* File Explorer - Hide during edits */}
          {!generationProgress.isEdit && (
            <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
              <div className="p-3 bg-gray-100 text-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BsFolderFill className="w-4 h-4" />
                  <span className="text-sm font-medium">Explorer</span>
                </div>
              </div>

              {/* File Tree */}
              <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                <div className="text-sm">
                  {/* Root app folder */}
                  <div
                    className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                    onClick={() => toggleFolder('app')}
                  >
                    {expandedFolders.has('app') ? (
                      <FiChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <FiChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                    {expandedFolders.has('app') ? (
                      <BsFolder2Open className="w-4 h-4 text-blue-500" />
                    ) : (
                      <BsFolderFill className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="font-medium text-gray-800">app</span>
                  </div>

                  {expandedFolders.has('app') && (
                    <div className="ml-4">
                      {/* Group files by directory */}
                      {(() => {
                        const fileTree = {};

                        // Create a map of edited files
                        const editedFiles = new Set(
                          generationProgress.files
                            .filter(f => f.edited)
                            .map(f => f.path)
                        );

                        // Process all files from generation progress
                        generationProgress.files.forEach(file => {
                          const parts = file.path.split('/');
                          const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                          const fileName = parts[parts.length - 1];

                          if (!fileTree[dir]) fileTree[dir] = [];
                          fileTree[dir].push({
                            name: fileName,
                            edited: file.edited || false
                          });
                        });

                        return Object.entries(fileTree).map(([dir, files]) => (
                          <div key={dir} className="mb-1">
                            {dir && (
                              <div
                                className="flex items-center gap-1 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                                onClick={() => toggleFolder(dir)}
                              >
                                {expandedFolders.has(dir) ? (
                                  <FiChevronDown className="w-4 h-4 text-gray-600" />
                                ) : (
                                  <FiChevronRight className="w-4 h-4 text-gray-600" />
                                )}
                                {expandedFolders.has(dir) ? (
                                  <BsFolder2Open className="w-4 h-4 text-yellow-600" />
                                ) : (
                                  <BsFolderFill className="w-4 h-4 text-yellow-600" />
                                )}
                                <span className="text-gray-700">{dir.split('/').pop()}</span>
                              </div>
                            )}
                            {(!dir || expandedFolders.has(dir)) && (
                              <div className={dir ? 'ml-6' : ''}>
                                {files.sort((a, b) => a.name.localeCompare(b.name)).map(fileInfo => {
                                  const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                  const isSelected = selectedFile === fullPath;

                                  return (
                                    <div
                                      key={fullPath}
                                      className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-all ${isSelected
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      onClick={() => handleFileClick(fullPath)}
                                    >
                                      {getFileIcon(fileInfo.name)}
                                      <span className={`text-xs flex items-center gap-1 ${isSelected ? 'font-medium' : ''}`}>
                                        {fileInfo.name}
                                        {fileInfo.edited && (
                                          <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-blue-400' : 'bg-orange-500 text-white'
                                            }`}>✓</span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Code Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thinking Mode Display - Only show during active generation */}
            {generationProgress.isGenerating && (generationProgress.isThinking || generationProgress.thinkingText) && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-purple-600 font-medium flex items-center gap-2">
                    {generationProgress.isThinking ? (
                      <>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                        AI is thinking...
                      </>
                    ) : (
                      <>
                        <span className="text-purple-600">✓</span>
                        Thought for {generationProgress.thinkingDuration || 0} seconds
                      </>
                    )}
                  </div>
                </div>
                {generationProgress.thinkingText && (
                  <div className="bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide">
                    <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                      {generationProgress.thinkingText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Live Code Display */}
            <div className="flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide" ref={codeDisplayRef}>
                {/* Show selected file if one is selected */}
                {selectedFile ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(selectedFile)}
                          <span className="font-mono text-sm">{selectedFile}</span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="hover:bg-black/20 p-1 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="bg-gray-900 border border-gray-700 rounded">
                        <SyntaxHighlighter
                          language={(() => {
                            const ext = selectedFile.split('.').pop()?.toLowerCase();
                            if (ext === 'css') return 'css';
                            if (ext === 'json') return 'json';
                            if (ext === 'html') return 'html';
                            return 'jsx';
                          })()}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {(() => {
                            // Find the file content from generated files
                            const file = generationProgress.files.find(f => f.path === selectedFile);
                            return file?.content || '// File content will appear here';
                          })()}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                ) : /* If no files parsed yet, show loading or raw stream */
                  generationProgress.files.length === 0 && !generationProgress.currentFile ? (
                    generationProgress.isThinking ? (
                      // Beautiful loading state while thinking
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="mb-8 relative">
                            <div className="w-24 h-24 mx-auto">
                              <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-spin border-t-transparent"></div>
                            </div>
                          </div>
                          <h3 className="text-xl font-medium text-white mb-2">AI is analyzing your request</h3>
                          <p className="text-gray-400 text-sm">{generationProgress.status || 'Preparing to generate code...'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100 text-gray-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">Streaming code...</span>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-900 rounded">
                          <SyntaxHighlighter
                            language="jsx"
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.875rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                          >
                            {generationProgress.streamedCode || 'Starting code generation...'}
                          </SyntaxHighlighter>
                          <span className="inline-block w-2 h-4 bg-orange-400 ml-1 animate-pulse" />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {/* Show current file being generated */}
                      {generationProgress.currentFile && (
                        <div className="bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="font-mono text-sm">{generationProgress.currentFile.path}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${generationProgress.currentFile.type === 'css' ? 'bg-blue-600 text-white' :
                                generationProgress.currentFile.type === 'javascript' ? 'bg-yellow-600 text-white' :
                                  generationProgress.currentFile.type === 'json' ? 'bg-green-600 text-white' :
                                    'bg-gray-200 text-gray-700'
                                }`}>
                                {generationProgress.currentFile.type === 'javascript' ? 'JSX' : generationProgress.currentFile.type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-900 border border-gray-700 rounded">
                            <SyntaxHighlighter
                              language={
                                generationProgress.currentFile.type === 'css' ? 'css' :
                                  generationProgress.currentFile.type === 'json' ? 'json' :
                                    generationProgress.currentFile.type === 'html' ? 'html' :
                                      'jsx'
                              }
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={true}
                            >
                              {generationProgress.currentFile.content}
                            </SyntaxHighlighter>
                            <span className="inline-block w-2 h-3 bg-orange-400 ml-4 mb-4 animate-pulse" />
                          </div>
                        </div>
                      )}

                      {/* Show completed files */}
                      {generationProgress.files.map((file, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-mono text-sm">{file.path}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${file.type === 'css' ? 'bg-blue-600 text-white' :
                              file.type === 'javascript' ? 'bg-yellow-600 text-white' :
                                file.type === 'json' ? 'bg-green-600 text-white' :
                                  'bg-gray-200 text-gray-700'
                              }`}>
                              {file.type === 'javascript' ? 'JSX' : file.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="bg-gray-900 border border-gray-700  max-h-48 overflow-y-auto scrollbar-hide">
                            <SyntaxHighlighter
                              language={
                                file.type === 'css' ? 'css' :
                                  file.type === 'json' ? 'json' :
                                    file.type === 'html' ? 'html' :
                                      'jsx'
                              }
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={true}
                              wrapLongLines={true}
                            >
                              {file.content}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      ))}

                      {/* Show remaining raw stream if there's content after the last file */}
                      {!generationProgress.currentFile && generationProgress.streamedCode.length > 0 && (
                        <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              <span className="font-mono text-sm">Processing...</span>
                            </div>
                          </div>
                          <div className="bg-gray-900 border border-gray-700 rounded">
                            <SyntaxHighlighter
                              language="jsx"
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={false}
                            >
                              {(() => {
                                // Show only the tail of the stream after the last file
                                const lastFileEnd = generationProgress.files.length > 0
                                  ? generationProgress.streamedCode.lastIndexOf('</file>') + 7
                                  : 0;
                                let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();

                                // Remove explanation tags and content
                                remainingContent = remainingContent.replace(/<explanation>[\s\S]*?<\/explanation>/g, '').trim();

                                // If only whitespace or nothing left, show waiting message
                                return remainingContent || 'Waiting for next file...';
                              })()}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* Progress indicator */}
            {generationProgress.components.length > 0 && (
              <div className="mx-6 mb-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                    style={{
                      width: `${(generationProgress.currentComponent / Math.max(generationProgress.components.length, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'preview') {
      return renderPreviewContent();
    }
    return null;
  };

  const renderPreviewContent = () => {
    // Show screenshot with progress overlay when scraping
    if (urlScreenshot && (loading || generationProgress.isGenerating || !sandboxData?.url || isPreparingDesign)) {
      return (
        <div className="relative w-full h-full bg-gray-100">
          <img
            src={urlScreenshot}
            alt="Website preview"
            className="w-full h-full object-contain"
          />
          {(generationProgress.isGenerating || isPreparingDesign || loadingStage) && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="bg-black/90 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
                <ProgressStages currentStage={loadingStage || 'scraping'} />
              </div>
            </div>
          )}
        </div>
      );
    }

    // Show progress stages when in any loading state
    if (loadingStage || (generationProgress.isGenerating && !generationProgress.isEdit)) {
      return (
        <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <ProgressStages currentStage={loadingStage || 'generating'} />
        </div>
      );
    }

    // Show sandbox iframe when ready
    if (sandboxData?.url && !loading) {
      return (
        <div className="relative w-full h-full">
          <iframe
            ref={iframeRef}
            src={sandboxData.url}
            className="w-full h-full border-none"
            title="Design Assistant Sandbox"
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
          {/* Refresh button */}
          <button
            onClick={() => {
              if (iframeRef.current && sandboxData?.url) {
                console.log('[Manual Refresh] Forcing iframe reload...');
                const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
                iframeRef.current.src = newSrc;
              }
            }}
            className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-3 rounded-xl shadow-lg transition-all duration-200 hover:scale-105"
            title="Refresh sandbox"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      );
    }

    // Show initial state
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Ready to Create</h3>
          <p className="text-gray-300">Start by entering a website URL or describing your app idea</p>
        </div>
      </div>
    );
  };

  const sendChatMessage = async () => {
    const message = aiChatInput.trim();
    if (!message) return;

    if (!aiEnabled) {
      addChatMessage('AI is disabled. Please enable it first.', 'system');
      return;
    }

    addChatMessage(message, 'user');
    setAiChatInput('');

    // Check for special commands
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === 'check packages' || lowerMessage === 'install packages' || lowerMessage === 'npm install') {
      if (!sandboxData) {
        addChatMessage('No active sandbox. Create a sandbox first!', 'system');
        return;
      }
      await checkAndInstallPackages();
      return;
    }

    // Start sandbox creation in parallel if needed
    let sandboxPromise = null;
    let sandboxCreating = false;

    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage('Creating sandbox while I plan your app...', 'system');
      sandboxPromise = createSandbox(true).catch((error) => {
        addChatMessage(`Failed to create sandbox: ${error.message}`, 'system');
        throw error;
      });
    }

    const isEdit = conversationContext.appliedCode.length > 0;

    try {
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: true,
        status: 'Starting AI generation...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: true,
        thinkingText: 'Analyzing your request...',
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        isEdit: isEdit,
        files: prev.files
      }));

      console.log('[chat] Using backend file cache for context');

      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? 'pending' : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating,
        extractedBusinessInfo: extractedBusinessInfo,
        documentDesignPrompt: documentDesignPrompt
      };

      console.log('[chat] Sending context to AI:');
      console.log('[chat] - sandboxId:', fullContext.sandboxId);
      console.log('[chat] - isEdit:', conversationContext.appliedCode.length > 0);
      console.log('[chat] - hasDocumentPrompt:', !!documentDesignPrompt);
      console.log('[chat] - message:', message.substring(0, 100) + '...');

      let finalPrompt = message;
      
      // Check if this is a document-based generation
      const isDocumentGeneration = documentDesignPrompt && (
        message === documentDesignPrompt || 
        message.includes('Create a modern, professional website') ||
        message.includes('BUSINESS INFORMATION:') ||
        message.includes('UI/UX DESIGN PRINCIPLES TO FOLLOW:')
      );
      
      if (isDocumentGeneration) {
        console.log('[chat] Detected document-based generation');
        finalPrompt = `Generate a website based on the uploaded business document requirements:

${documentDesignPrompt}

Please create a complete React application following the UI/UX design principles and the extracted business information.`;
      }

      console.log('[chat] Final prompt length:', finalPrompt.length);

      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: aiModel,
          context: fullContext,
          isEdit: conversationContext.appliedCode.length > 0,
          url: null // No URL provided - will use random CSV schema
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';

                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        updatedState.currentFile = {
                          path: filePath,
                          content: partialContent,
                          type: fileType
                        };
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: 'Generated App.jsx structure'
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, {
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'package') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));

                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));

                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[generate-code] Packages to install from tools:', data.packagesToInstall);
                    (window).pendingPackages = data.packagesToInstall;
                  }

                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles = [];
                  let fileMatch;

                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                      fileExt === 'css' ? 'css' :
                        fileExt === 'json' ? 'json' :
                          fileExt === 'html' ? 'html' : 'text';

                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }

                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''}!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    files: prev.files.length > 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      if (generatedCode) {
        const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }

        if (isEdit && generatedFiles.length > 0) {
          const editedFileNames = generatedFiles.map(f => f.split('/').pop()).join(', ');
          addChatMessage(
            explanation || `Updated ${editedFileNames}`,
            'ai',
            {
              appliedFiles: [generatedFiles[0]] // Only show the first edited file
            }
          );
        } else {
          addChatMessage(explanation || 'Code generated!', 'ai', {
            appliedFiles: generatedFiles
          });
        }

        setPromptInput(generatedCode);

        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            await sandboxPromise;
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
          } catch {
            addChatMessage('Sandbox creation failed. Cannot apply code.', 'system');
            return;
          }
        }

        if (sandboxData && generatedCode) {
          await applyGeneratedCode(generatedCode, isEdit);
        }
      }

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined
      }));

      setTimeout(() => {
        setActiveTab('preview');
      }, 1000);
    } catch (error) {
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Thinking...'));
      addChatMessage(`Error: ${error.message}`, 'system');

      setGenerationProgress({
        isGenerating: false,
        status: '',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0
      });
      setActiveTab('preview');
    }
  };


  const downloadZip = async () => {
    if (!sandboxData) {
      addChatMessage('No active sandbox to download. Create a sandbox first!', 'system');
      return;
    }

    setLoading(true);
    log('Creating zip file...');
    addChatMessage('Creating ZIP file of your Vite app...', 'system');

    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        log('Zip file created!');
        addChatMessage('ZIP file created! Download starting...', 'system');

        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addChatMessage(
          'Your Vite app has been downloaded! To run it locally:\n' +
          '1. Unzip the file\n' +
          '2. Run: npm install\n' +
          '3. Run: npm run dev\n' +
          '4. Open http://localhost:5173',
          'system'
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      log(`Failed to create zip: ${error.message}`, 'error');
      addChatMessage(`Failed to create ZIP: ${error.message}`, 'system');
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () => {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage('No previous generation to re-apply', 'system');
      return;
    }

    if (!sandboxData) {
      addChatMessage('Please create a sandbox first', 'system');
      return;
    }

    addChatMessage('Re-applying last generation...', 'system');
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };


  useEffect(() => {
    if (codeDisplayRef.current && generationProgress.isStreaming) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath) => {
    setSelectedFile(filePath);
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'jsx' || ext === 'js') {
      return <SiJavascript className="w-4 h-4 text-yellow-500" />;
    } else if (ext === 'tsx' || ext === 'ts') {
      return <SiReact className="w-4 h-4 text-blue-500" />;
    } else if (ext === 'css') {
      return <SiCss3 className="w-4 h-4 text-blue-500" />;
    } else if (ext === 'json') {
      return <SiJson className="w-4 h-4 text-gray-600" />;
    } else {
      return <FiFile className="w-4 h-4 text-gray-600" />;
    }
  };

  const clearChatHistory = () => {
    setChatMessages([{
      content: 'Chat history cleared. How can I help you?',
      type: 'system',
      timestamp: new Date()
    }]);
  };


  const cloneWebsite = async () => {
    let url = urlInput.trim();
    if (!url) {
      setUrlStatus(prev => [...prev, 'Please enter a URL']);
      return;
    }

    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    setUrlStatus([`Using: ${url}`, 'Starting to scrape...']);

    setUrlOverlayVisible(false);

    const cleanUrl = url.replace(/^https?:\/\//i, '');
    addChatMessage(`Starting to clone ${cleanUrl}...`, 'system');

    captureUrlScreenshot(url);

    try {
      addChatMessage('Scraping website content...', 'system');
      const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!scrapeResponse.ok) {
        throw new Error(`Scraping failed: ${scrapeResponse.status}`);
      }

      const scrapeData = await scrapeResponse.json();

      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Failed to scrape website');
      }

      addChatMessage(`Scraped ${scrapeData.content.length} characters from ${url}`, 'system');

      setIsPreparingDesign(false);
      setActiveTab('generation');

      setConversationContext(prev => ({
        ...prev,
        scrapedWebsites: [...prev.scrapedWebsites, {
          url,
          content: scrapeData,
          timestamp: new Date()
        }],
        currentProject: `Clone of ${url}`
      }));

      let sandboxPromise = null;
      if (!sandboxData) {
        addChatMessage('Creating sandbox while generating your React app...', 'system');
        sandboxPromise = createSandbox(true);
      }

      addChatMessage('Analyzing and generating React recreation...', 'system');

      const recreatePrompt = `I scraped this website and want you to recreate it as a modern React application.

URL: ${url}

SCRAPED CONTENT:
${scrapeData.content}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : ''}

REQUIREMENTS:
1. Create a COMPLETE React application with App.jsx as the main component
2. App.jsx MUST import and render all other components
3. Recreate the main sections and layout from the scraped content
4. ${homeContextInput ? `Apply the user's context/theme: "${homeContextInput}"` : `Use a modern dark theme with excellent contrast:
   - Background: #0a0a0a
   - Text: #ffffff
   - Links: #60a5fa
   - Accent: #3b82f6`}
5. Make it fully responsive
6. Include hover effects and smooth transitions
7. Create separate components for major sections (Header, Hero, Features, etc.)
8. Use semantic HTML5 elements

IMPORTANT CONSTRAINTS:
- DO NOT use React Router or any routing libraries
- Use regular <a> tags with href="#section" for navigation, NOT Link or NavLink components
- This is a single-page application, no routing needed
- ALWAYS create src/App.jsx that imports ALL components
- Each component should be in src/components/
- Use Tailwind CSS for ALL styling (no custom CSS files)
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports

IMAGE HANDLING RULES:
- When the scraped content includes images, USE THE ORIGINAL IMAGE URLS whenever appropriate
- Keep existing images from the scraped site (logos, product images, hero images, icons, etc.)
- Use the actual image URLs provided in the scraped content, not placeholders
- Only use placeholder images or generic services when no real images are available
- For company logos and brand images, ALWAYS use the original URLs to maintain brand identity
- If scraped data contains image URLs, include them in your img tags
- Example: If you see "https://example.com/logo.png" in the scraped content, use that exact URL

Focus on the key sections and content, making it clean and modern while preserving visual assets.`;

      setGenerationProgress(prev => ({
        isGenerating: true,
        status: 'Initializing AI...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: true,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: prev.files || [],
        currentFile: undefined,
        lastProcessedPosition: 0
      }));

      setActiveTab('generation');

      const aiResponse = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: recreatePrompt,
          model: aiModel,
          context: {
            sandboxId: sandboxData?.id,
            structure: structureContent,
            conversationContext: conversationContext
          }
        })
      });

      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';

                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        updatedState.currentFile = {
                          path: filePath,
                          content: partialContent,
                          type: fileType
                        };
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: 'Generated App.jsx structure'
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, {
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'package') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));

                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));

                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[generate-code] Packages to install from tools:', data.packagesToInstall);
                    (window).pendingPackages = data.packagesToInstall;
                  }

                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles = [];
                  let fileMatch;

                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                      fileExt === 'css' ? 'css' :
                        fileExt === 'json' ? 'json' :
                          fileExt === 'html' ? 'html' : 'text';

                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }

                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''}!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    files: prev.files.length > 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit
      }));

      if (generatedCode) {
        addChatMessage('AI recreation generated!', 'system');

        if (explanation && explanation.trim()) {
          addChatMessage(explanation, 'ai');
        }

        setPromptInput(generatedCode);
        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            await sandboxPromise;
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
          } catch (error) {
            addChatMessage('Sandbox creation failed. Cannot apply code.', 'system');
            throw error;
          }
        }

        await applyGeneratedCode(generatedCode, false);

        addChatMessage(
          `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`,
          'ai',
          {
            scrapedUrl: url,
            scrapedContent: scrapeData,
            generatedCode: generatedCode
          }
        );

        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null);

        setTimeout(() => {
          setActiveTab('preview');
        }, 1000);
      } else {
        throw new Error('Failed to generate recreation');
      }

    } catch (error) {
      addChatMessage(`Failed to clone website: ${error.message}`, 'system');
      setUrlStatus([]);
      setIsPreparingDesign(false);
      setUrlScreenshot(null);
      setTargetUrl('');
      setScreenshotError(null);
      setLoadingStage(null);
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: '',
        files: prev.files
      }));
      setActiveTab('preview');
    }
  };

  const captureUrlScreenshot = async (url) => {
    setLoadingStage('scraping');
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (data.success && data.screenshot) {
        setUrlScreenshot(data.screenshot);
        setIsPreparingDesign(true);
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        if (activeTab !== 'preview') {
          setActiveTab('preview');
        }
      } else {
        setScreenshotError(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleHomeScreenSubmit = async (e) => {
    e.preventDefault();
    const input = homeUrlInput.trim();
    if (!input) return;

    setHomeScreenFading(true);
    setChatMessages([]);

    // Check if input is a URL
    const isUrl = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(input);
    
    if (isUrl) {
      // Handle URL input - will scrape and use design schema if available
      let displayUrl = input;
      if (!displayUrl.match(/^https?:\/\//i)) {
        displayUrl = 'https://' + displayUrl;
      }
      const cleanUrl = displayUrl.replace(/^https?:\/\//i, '');
      addChatMessage(`Starting to clone ${cleanUrl}...`, 'system');

      const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve();

      if (!sandboxData) {
        captureUrlScreenshot(displayUrl);
      }

      setLoadingStage('gathering');
      setActiveTab('preview');

      setTimeout(async () => {
        setShowHomeScreen(false);
        setHomeScreenFading(false);

        await sandboxPromise;

        setUrlInput(input);
        setUrlOverlayVisible(false);
        setUrlStatus(['Scraping website content...']);

        try {
          let url = input;
          if (!url.match(/^https?:\/\//i)) {
            url = 'https://' + url;
          }

          const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });

          if (!scrapeResponse.ok) {
            throw new Error('Failed to scrape website');
          }

          const scrapeData = await scrapeResponse.json();

          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape website');
          }

          setUrlStatus(['Website scraped successfully!', 'Generating React app...']);

          setIsPreparingDesign(false);
          setUrlScreenshot(null);
          setTargetUrl('');

          setLoadingStage('planning');

          setTimeout(() => {
            setLoadingStage('generating');
            setActiveTab('generation');
          }, 1500);

          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, {
              url: url,
              content: scrapeData,
              timestamp: new Date()
            }],
            currentProject: `${url} Clone`
          }));

          const prompt = `I want to recreate the ${url} website as a complete React application based on the scraped content below.

${JSON.stringify(scrapeData, null, 2)}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Implement ALL sections and features from the original site
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Ensure all text content matches the original
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${homeContextInput ? '- Apply the user\'s context/theme requirements throughout the application' : ''}

Focus on the key sections and content, making it clean and modern.`;

          setGenerationProgress(prev => ({
            isGenerating: true,
            status: 'Initializing AI...',
            components: [],
            currentComponent: 0,
            streamedCode: '',
            isStreaming: true,
            isThinking: false,
            thinkingText: undefined,
            thinkingDuration: undefined,
            files: prev.files || [],
            currentFile: undefined,
            lastProcessedPosition: 0
          }));

          const aiResponse = await fetch('/api/generate-ai-code-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              model: aiModel,
              context: {
                sandboxId: sandboxData?.sandboxId,
                structure: structureContent,
                conversationContext: conversationContext
              },
              url: url // Pass the URL to trigger scraping
            })
          });

          if (!aiResponse.ok || !aiResponse.body) {
            throw new Error('Failed to generate code');
          }

          const reader = aiResponse.body.getReader();
          const decoder = new TextDecoder();
          let generatedCode = '';
          let explanation = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'status') {
                    setGenerationProgress(prev => ({ ...prev, status: data.message }));
                  } else if (data.type === 'thinking') {
                    setGenerationProgress(prev => ({
                      ...prev,
                      isThinking: true,
                      thinkingText: (prev.thinkingText || '') + data.text
                    }));
                  } else if (data.type === 'thinking_complete') {
                    setGenerationProgress(prev => ({
                      ...prev,
                      isThinking: false,
                      thinkingDuration: data.duration
                    }));
                  } else if (data.type === 'conversation') {
                    let text = data.text || '';

                    text = text.replace(/<package>[^<]*<\/package>/g, '');
                    text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                    if (!text.includes('<file') && !text.includes('import React') &&
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                      addChatMessage(text.trim(), 'ai');
                    }
                  } else if (data.type === 'stream' && data.raw) {
                    setGenerationProgress(prev => {
                      const newStreamedCode = prev.streamedCode + data.text;

                      const updatedState = {
                        ...prev,
                        streamedCode: newStreamedCode,
                        isStreaming: true,
                        isThinking: false,
                        status: 'Generating code...'
                      };

                      const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                      let match;
                      const processedFiles = new Set(prev.files.map(f => f.path));

                      while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                        const filePath = match[1];
                        const fileContent = match[2];

                        if (!processedFiles.has(filePath)) {
                          const fileExt = filePath.split('.').pop() || '';
                          const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                            fileExt === 'css' ? 'css' :
                              fileExt === 'json' ? 'json' :
                                fileExt === 'html' ? 'html' : 'text';

                          const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                          if (existingFileIndex >= 0) {
                            updatedState.files = [
                              ...updatedState.files.slice(0, existingFileIndex),
                              {
                                ...updatedState.files[existingFileIndex],
                                content: fileContent.trim(),
                                type: fileType,
                                completed: true,
                                edited: true
                              },
                              ...updatedState.files.slice(existingFileIndex + 1)
                            ];
                          } else {
                            updatedState.files = [...updatedState.files, {
                              path: filePath,
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: false
                            }];
                          }

                          if (!prev.isEdit) {
                            updatedState.status = `Completed ${filePath}`;
                          }
                          processedFiles.add(filePath);
                        }
                      }

                      const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                      if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                        const filePath = lastFileMatch[1];
                        const partialContent = lastFileMatch[2];

                        if (!processedFiles.has(filePath)) {
                          const fileExt = filePath.split('.').pop() || '';
                          const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                            fileExt === 'css' ? 'css' :
                              fileExt === 'json' ? 'json' :
                                fileExt === 'html' ? 'html' : 'text';

                          const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                          if (existingFileIndex >= 0) {
                            updatedState.files = [
                              ...updatedState.files.slice(0, existingFileIndex),
                              {
                                ...updatedState.files[existingFileIndex],
                                content: partialContent.trim(),
                                type: fileType,
                                completed: true,
                                edited: true
                              },
                              ...updatedState.files.slice(existingFileIndex + 1)
                            ];
                          } else {
                            updatedState.files = [...updatedState.files, {
                              path: filePath,
                              content: partialContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: false
                            }];
                          }

                          if (!prev.isEdit) {
                            updatedState.status = `Completed ${filePath}`;
                          }
                          processedFiles.add(filePath);
                        }
                      } else {
                        updatedState.currentFile = undefined;
                      }

                      return updatedState;
                    });
                  } else if (data.type === 'complete') {
                    generatedCode = data.generatedCode;
                    explanation = data.explanation;

                    setConversationContext(prev => ({
                      ...prev,
                      lastGeneratedCode: generatedCode
                    }));
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }

          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: 'Generation complete!'
          }));

          if (generatedCode) {
            addChatMessage('AI recreation generated!', 'system');

            if (explanation && explanation.trim()) {
              addChatMessage(explanation, 'ai');
            }

            setPromptInput(generatedCode);

            await applyGeneratedCode(generatedCode, false);

            addChatMessage(
              `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`,
              'ai',
              {
                scrapedUrl: url,
                scrapedContent: scrapeData,
                generatedCode: generatedCode
              }
            );

            setConversationContext(prev => ({
              ...prev,
              generatedComponents: [],
              appliedCode: [...prev.appliedCode, {
                files: [],
                timestamp: new Date()
              }]
            }));
          } else {
            throw new Error('Failed to generate recreation');
          }

          setUrlInput('');
          setUrlStatus([]);
          setHomeContextInput('');

          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: 'Generation complete!'
          }));

          setUrlScreenshot(null);
          setIsPreparingDesign(false);
          setTargetUrl('');
          setScreenshotError(null);
          setLoadingStage(null);

          setTimeout(() => {
            setActiveTab('preview');
          }, 1000);
        } catch (error) {
          addChatMessage(`Failed to clone website: ${error.message}`, 'system');
          setUrlStatus([]);
          setIsPreparingDesign(false);
          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: '',
            files: prev.files
          }));
        }
      }, 500);
    } else {
      // Handle non-URL input - will use random CSV schema without scraping
      addChatMessage(`Creating a website based on your description: "${input}"`, 'system');

      const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve();

      setLoadingStage('planning');
      setActiveTab('preview');

      setTimeout(async () => {
        setShowHomeScreen(false);
        setHomeScreenFading(false);

        await sandboxPromise;

        setLoadingStage('generating');
        setActiveTab('generation');

        try {
          setConversationContext(prev => ({
            ...prev,
            currentProject: `Custom Website: ${input}`
          }));

          const prompt = `Create a modern, professional website based on this description:

"${input}"

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Use a random design schema from the CSV file for inspiration
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${homeContextInput ? '- Apply the user\'s context/theme requirements throughout the application' : ''}

Focus on creating a beautiful, functional website based on the description.`;

          setGenerationProgress(prev => ({
            isGenerating: true,
            status: 'Initializing AI...',
            components: [],
            currentComponent: 0,
            streamedCode: '',
            isStreaming: true,
            isThinking: false,
            thinkingText: undefined,
            thinkingDuration: undefined,
            files: prev.files || [],
            currentFile: undefined,
            lastProcessedPosition: 0
          }));

          const aiResponse = await fetch('/api/generate-ai-code-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              model: aiModel,
              context: {
                sandboxId: sandboxData?.sandboxId,
                structure: structureContent,
                conversationContext: conversationContext
              },
              url: null // No URL - will use random CSV schema
            })
          });

          if (!aiResponse.ok || !aiResponse.body) {
            throw new Error('Failed to generate code');
          }

          const reader = aiResponse.body.getReader();
          const decoder = new TextDecoder();
          let generatedCode = '';
          let explanation = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === 'status') {
                    setGenerationProgress(prev => ({ ...prev, status: data.message }));
                  } else if (data.type === 'thinking') {
                    setGenerationProgress(prev => ({
                      ...prev,
                      isThinking: true,
                      thinkingText: (prev.thinkingText || '') + data.text
                    }));
                  } else if (data.type === 'thinking_complete') {
                    setGenerationProgress(prev => ({
                      ...prev,
                      isThinking: false,
                      thinkingDuration: data.duration
                    }));
                  } else if (data.type === 'conversation') {
                    let text = data.text || '';

                    text = text.replace(/<package>[^<]*<\/package>/g, '');
                    text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                    if (!text.includes('<file') && !text.includes('import React') &&
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                      addChatMessage(text.trim(), 'ai');
                    }
                  } else if (data.type === 'stream' && data.raw) {
                    setGenerationProgress(prev => {
                      const newStreamedCode = prev.streamedCode + data.text;

                      const updatedState = {
                        ...prev,
                        streamedCode: newStreamedCode,
                        isStreaming: true,
                        isThinking: false,
                        status: 'Generating code...'
                      };

                      const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                      let match;
                      const processedFiles = new Set(prev.files.map(f => f.path));

                      while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                        const filePath = match[1];
                        const fileContent = match[2];

                        if (!processedFiles.has(filePath)) {
                          const fileExt = filePath.split('.').pop() || '';
                          const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                            fileExt === 'css' ? 'css' :
                              fileExt === 'json' ? 'json' :
                                fileExt === 'html' ? 'html' : 'text';

                          const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                          if (existingFileIndex >= 0) {
                            updatedState.files = [
                              ...updatedState.files.slice(0, existingFileIndex),
                              {
                                ...updatedState.files[existingFileIndex],
                                content: fileContent.trim(),
                                type: fileType,
                                completed: true,
                                edited: true
                              },
                              ...updatedState.files.slice(existingFileIndex + 1)
                            ];
                          } else {
                            updatedState.files = [...updatedState.files, {
                              path: filePath,
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: false
                            }];
                          }

                          if (!prev.isEdit) {
                            updatedState.status = `Completed ${filePath}`;
                          }
                          processedFiles.add(filePath);
                        }
                      }

                      const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                      if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                        const filePath = lastFileMatch[1];
                        const partialContent = lastFileMatch[2];

                        if (!processedFiles.has(filePath)) {
                          const fileExt = filePath.split('.').pop() || '';
                          const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                            fileExt === 'css' ? 'css' :
                              fileExt === 'json' ? 'json' :
                                fileExt === 'html' ? 'html' : 'text';

                          const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                          if (existingFileIndex >= 0) {
                            updatedState.files = [
                              ...updatedState.files.slice(0, existingFileIndex),
                              {
                                ...updatedState.files[existingFileIndex],
                                content: partialContent.trim(),
                                type: fileType,
                                completed: true,
                                edited: true
                              },
                              ...updatedState.files.slice(existingFileIndex + 1)
                            ];
                          } else {
                            updatedState.files = [...updatedState.files, {
                              path: filePath,
                              content: partialContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: false
                            }];
                          }

                          if (!prev.isEdit) {
                            updatedState.status = `Completed ${filePath}`;
                          }
                          processedFiles.add(filePath);
                        }
                      } else {
                        updatedState.currentFile = undefined;
                      }

                      return updatedState;
                    });
                  } else if (data.type === 'complete') {
                    generatedCode = data.generatedCode;
                    explanation = data.explanation;

                    setConversationContext(prev => ({
                      ...prev,
                      lastGeneratedCode: generatedCode
                    }));
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }

          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: 'Generation complete!'
          }));

          if (generatedCode) {
            addChatMessage('AI website generated!', 'system');

            if (explanation && explanation.trim()) {
              addChatMessage(explanation, 'ai');
            }

            setPromptInput(generatedCode);

            await applyGeneratedCode(generatedCode, false);

            addChatMessage(
              `Successfully created a website based on your description: "${input}"${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}!`,
              'ai',
              {
                generatedCode: generatedCode
              }
            );

            setConversationContext(prev => ({
              ...prev,
              generatedComponents: [],
              appliedCode: [...prev.appliedCode, {
                files: [],
                timestamp: new Date()
              }]
            }));
          } else {
            throw new Error('Failed to generate website');
          }

          setHomeContextInput('');

          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: 'Generation complete!'
          }));

          setLoadingStage(null);

          setTimeout(() => {
            setActiveTab('preview');
          }, 1000);
        } catch (error) {
          addChatMessage(`Failed to generate website: ${error.message}`, 'system');
          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            isStreaming: false,
            status: '',
            files: prev.files
          }));
        }
      }, 500);
    }
  };

  const handleDocumentProcessed = (extractedInfo, designPrompt) => {
    setExtractedBusinessInfo(extractedInfo);
    setDocumentDesignPrompt(designPrompt);
    setShowDocumentUpload(false);
    
    // Initialize editable data with the extracted info
    setEditableExtractedInfo(extractedInfo);
    
    // Add a chat message about the extracted information
    addChatMessage(`Document processed! Extracted business information:
• Business Name: ${extractedInfo.businessName || 'Not found'}
• Unique Value: ${extractedInfo.uniqueValueProposition || 'Not found'}
• Color Palette: ${extractedInfo.colorPalette || 'Not found'}
• Font Preference: ${extractedInfo.preferredFont || 'Not found'}

I'll now generate a website based on these requirements and our UI design principles.`, 'system');
    
    // Show extracted data review modal instead of auto-generating
    setShowExtractedDataReview(true);
  };

  const handleDocumentError = (error) => {
    addChatMessage(`Document upload error: ${error}`, 'error');
  };

  const handleExtractedDataReview = () => {
    setShowExtractedDataReview(false);
    
    // Update the extracted info with any edits
    if (editableExtractedInfo) {
      setExtractedBusinessInfo(editableExtractedInfo);
      const updatedDesignPrompt = generateDesignPrompt(editableExtractedInfo);
      setDocumentDesignPrompt(updatedDesignPrompt);
    }
    
    // Get the current prompt
    const currentPrompt = editableExtractedInfo ? 
      generateDesignPrompt(editableExtractedInfo) : 
      documentDesignPrompt;
    
    // Follow the same flow as text input generation
    addChatMessage(`Generating website from uploaded document requirements`, 'system');

    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve();

    setLoadingStage('planning');
    setActiveTab('preview');

    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);

      await sandboxPromise;

      setLoadingStage('generating');
      setActiveTab('generation');

      try {
        setConversationContext(prev => ({
          ...prev,
          currentProject: `Document-Based Website: ${extractedBusinessInfo?.businessName || 'Business'}`
        }));

        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Initializing AI...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));

        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: currentPrompt,
            model: aiModel,
            context: {
              sandboxId: sandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext,
              extractedBusinessInfo: extractedBusinessInfo,
              documentDesignPrompt: documentDesignPrompt
            }
          })
        });

        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error('Failed to generate code');
        }

        // Same streaming logic as text input
        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';
        let explanation = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';

                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: partialContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: partialContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        if (generatedCode) {
          addChatMessage('AI website generated!', 'system');

          if (explanation && explanation.trim()) {
            addChatMessage(explanation, 'ai');
          }

          setPromptInput(generatedCode);

          await applyGeneratedCode(generatedCode, false);

          addChatMessage(
            `Successfully created a website based on your uploaded document requirements!`,
            'ai',
            {
              generatedCode: generatedCode
            }
          );

          setConversationContext(prev => ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, {
              files: [],
              timestamp: new Date()
            }]
          }));
        } else {
          throw new Error('Failed to generate website');
        }

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        setLoadingStage(null);

        setTimeout(() => {
          setActiveTab('preview');
        }, 1000);
      } catch (error) {
        addChatMessage(`Failed to generate website: ${error.message}`, 'system');
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '',
          files: prev.files
        }));
      }
    }, 500);
  };

  const generateDesignPrompt = (extractedInfo) => {
    const { businessName, uniqueValueProposition, competitors, colorPalette, preferredFont } = extractedInfo;
    
    return `Create a modern, professional website for ${businessName || 'this business'} based on the following extracted information:

BUSINESS INFORMATION:
- Business Name: ${businessName || 'Not specified'}
- Unique Value Proposition: ${uniqueValueProposition || 'Not specified'}
- Competitors: ${competitors || 'Not specified'}

DESIGN REQUIREMENTS:
- Color Palette: ${colorPalette || 'Professional and modern colors'}
- Preferred Font: ${preferredFont || 'Clean, readable fonts'}

UI/UX DESIGN PRINCIPLES TO FOLLOW:
1. Layout & Grids: Use a simple 12-column grid system for balanced, responsive layouts
2. Typography: Use 1-2 font families with clear hierarchy (H1 for main titles, H2-H4 for structure, 16-18px body text)
3. Color: Follow 60-30-10 rule (60% neutral, 30% main color, 10% accent). Ensure high contrast for readability
4. Spacing: Use consistent spacing scale (8px, 16px, 24px, 64px) with proper white space
5. Visual Hierarchy: Guide user attention with size, color, and placement
6. Navigation: Simple, consistent navigation with 5-7 main items
7. Buttons & CTAs: Bold, contrasting colors with clear action-oriented labels
8. Icons & Images: Crisp vector icons and high-quality images
9. Motion: Subtle animations (200-500ms) with natural easing
10. Responsiveness: Mobile-first design that scales to all screen sizes

REQUIREMENTS:
- Create a complete React application with modern design
- Use Tailwind CSS for all styling
- Make it fully responsive
- Include hover effects and smooth transitions
- Create separate components for major sections (Header, Hero, About, Services, etc.)
- Use semantic HTML5 elements
- Ensure accessibility and performance
- Create a professional, trustworthy appearance that reflects the business's unique value proposition

Focus on creating a website that embodies the business's brand identity and effectively communicates their unique value proposition to potential customers.`;
  };

  // Add this function temporarily to test CSV parsing
  const testCsvParsing = async () => {
    try {
      const response = await fetch('/api/test-csv-parsing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      console.log('CSV Test Results:', data);
    } catch (error) {
      console.error('CSV Test Error:', error);
    }
  };

  // Call this in useEffect or a button click to test
  // testCsvParsing();

  // Add the redesign function after the existing functions
  const handleRedesign = async () => {
    if (!sandboxData) {
      addChatMessage('No active sandbox. Create a sandbox first!', 'system');
      return;
    }

    setGenerationProgress(prev => ({
      isGenerating: true,
      status: 'Analyzing request and selecting different design schema...',
      components: [],
      currentComponent: 0,
      streamedCode: '',
      isStreaming: true,
      isThinking: false,
      thinkingText: undefined,
      thinkingDuration: undefined,
      files: prev.files || [],
      currentFile: undefined,
      lastProcessedPosition: 0
    }));

    setActiveTab('generation');

    try {
      // Enhanced redesign prompt with stronger instructions for complete UI/UX restructuring
      const redesignPrompt = `🚨 COMPLETE REBUILD & REPLACE: Recreate this website from scratch with a new design, new content, and new functionality.

**CRITICAL INSTRUCTIONS - OVERRIDE ALL PREVIOUS CONTEXT:**
1.  **DELETE & REPLACE:** Your first action is to completely remove/delete all existing files.
2.  **SELECT A DESIGN SCHEMA:** Choose a random design schema from the CSV file to define the new visual style.
3.  **REBUILD FROM SCRATCH:** Generate entirely new files from a blank slate.
4.  **REPLACE ALL VISUALS:** Using the new schema, create a new visual identity—colors, typography, spacing, layout, and components.
5.  **REPLACE ALL CONTENT & FUNCTIONALITY:** Discard all original text and features. Generate new, relevant placeholder content and introduce improved functionalities appropriate for the new design.
6.  **ENSURE RESPONSIVENESS:** The new build must be modern and fully responsive.

**EXECUTION WORKFLOW - FULL-SCOPE REIMAGINATION:**
- **FILE OPERATION:** Discard all old code and files entirely. Start fresh.
- **NEW SCHEMA ANALYSIS:** Thoroughly analyze the chosen schema to build the new design system.
- **REBUILD ALL COMPONENTS:** Recreate the Header, Hero, body sections, and Footer with new layouts and features.
- **GENERATE NEW CONTENT:** Populate the new components with relevant, high-quality placeholder text and images.
- **IMPLEMENT NEW STYLES:** Apply the new schema's colors, typography, and spacing rules consistently.
- **GENERATE NEW, COMPLETE FILE(S):** Output the full code for the brand-new website.

**MANDATORY:** This is a "tear-down and rebuild" operation. Nothing from the original implementation—visuals, content, or functionality—should be preserved. Create a completely new product.`;

      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: redesignPrompt,
          model: aiModel,
          context: {
            sandboxId: sandboxData?.sandboxId,
            structure: structureContent,
            conversationContext: conversationContext,
            currentFiles: sandboxFiles
          },
          isEdit: false, // Changed from true to false - this prevents the system from providing existing files and preservation instructions
          url: null // Ensure we use intelligent CSV schema selection
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';

                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Redesigning with intelligent schema...'
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        updatedState.status = `Redesigned ${filePath}`;
                        processedFiles.add(filePath);
                      }
                    }

                    return updatedState;
                  });
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Redesigned ${data.name}`,
                    components: [...prev.components, {
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));

                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));

                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[redesign] Packages to install:', data.packagesToInstall);
                    (window).pendingPackages = data.packagesToInstall;
                  }

                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles = [];
                  let fileMatch;

                  while ((fileMatch = fileRegex.exec(generatedCode)) !== null) {
                    parsedFiles.push({
                      path: fileMatch[1],
                      content: fileMatch[2].trim()
                    });
                  }

                  if (parsedFiles.length > 0) {
                    console.log('[redesign] Applying generated code with', parsedFiles.length, 'files');
                    await applyGeneratedCode(generatedCode, true);
                    addChatMessage(`Successfully redesigned the website using intelligent schema! ${parsedFiles.length} files updated.`, 'system');
                  } else {
                    addChatMessage('Redesign completed but no files were generated. Please try again.', 'system');
                  }

                  if (explanation && explanation.trim()) {
                    addChatMessage(explanation, 'ai');
                  }
                }
              } catch (e) {
                console.error('Error parsing streaming data:', e);
              }
            }
          }
        }
      }

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Redesign complete!'
      }));

    } catch (error) {
      console.error('Redesign error:', error);
      addChatMessage(`Redesign failed: ${error.message}`, 'system');
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Redesign failed'
      }));
    }
  };

  return (
    <div className="font-sans bg-background text-foreground h-screen flex flex-col">
      {showHomeScreen && (
        <div className={`fixed inset-0 z-50 transition-opacity duration-500 ${homeScreenFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-white overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-orange-400/50 via-orange-300/30 to-transparent rounded-full blur-[80px] animate-[sunPulse_4s_ease-in-out_infinite]" />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-radial from-yellow-300/40 via-orange-400/30 to-transparent rounded-full blur-[40px] animate-[sunPulse_4s_ease-in-out_infinite_0.5s]" />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-gradient-radial from-orange-200/20 to-transparent rounded-full blur-[120px]" />

            <div className="absolute bottom-0 left-1/2 w-[800px] h-[800px] animate-[orbShrink_3s_ease-out_forwards]" style={{ transform: 'translateX(-50%) translateY(45%)' }}>
              <div className="relative w-full h-full">
                <div className="absolute inset-0 bg-orange-600 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
                <div className="absolute inset-16 bg-orange-500 rounded-full blur-[80px] opacity-40 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="absolute inset-32 bg-orange-400 rounded-full blur-[60px] opacity-50 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                <div className="absolute inset-48 bg-yellow-300 rounded-full blur-[40px] opacity-60"></div>
              </div>
            </div>
          </div>


          <button
            onClick={() => {
              setHomeScreenFading(true);
              setTimeout(() => {
                setShowHomeScreen(false);
                setHomeScreenFading(false);
              }, 500);
            }}
            className="absolute top-8 right-8 text-gray-500 hover:text-gray-700 transition-all duration-300 opacity-0 hover:opacity-100 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-sm"
            style={{ opacity: 0 }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="absolute top-0 left-0 right-0 z-20 px-6 py-4 flex items-center justify-between animate-[fadeIn_0.8s_ease-out]">
            <img
              src="/logo-growth99.svg"
              alt="growth99"
              className="h-8 w-auto"
            />
          </div>

          <div className="relative z-10 h-full flex items-center justify-center px-4">
            <div className="text-center max-w-4xl min-w-[600px] mx-auto">
              <div className="text-center">
                <h1 className="text-[2.5rem] lg:text-[3.8rem] text-center text-[#36322F] font-semibold tracking-tight leading-[0.9] animate-[fadeIn_0.8s_ease-out]">
                  <span className="hidden md:inline">Design Assistant</span>
                  <span className="md:hidden">Design Assistant</span>
                </h1>
                <motion.p
                  className="text-base lg:text-lg max-w-lg mx-auto mt-2.5 text-zinc-500 text-center text-balance"
                  animate={{
                    opacity: showStyleSelector ? 0.7 : 1
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  Re-imagine any website, in seconds.
                </motion.p>
              </div>

              <form onSubmit={handleHomeScreenSubmit} className="mt-5 max-w-3xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative group">
                    <input
                      value={homeUrlInput}
                      onChange={(e) => setHomeUrlInput(e.target.value)}
                      placeholder="" // Remove the native placeholder
                      className="h-[3.25rem] w-full focus-visible:outline-none focus-visible:ring-orange-500 focus-visible:ring-2 rounded-[18px] text-sm text-[#36322F] px-4 py-3 pr-12 border-[.75px] border-border bg-white"
                      style={{
                        boxShadow: '0 0 0 1px #e3e1de66, 0 1px 2px #5f4a2e14, 0 4px 6px #5f4a2e0a, 0 40px 40px -24px #684b2514',
                        filter: 'drop-shadow(rgba(249, 224, 184, 0.3) -0.731317px -0.731317px 35.6517px)'
                      }}
                      autoFocus
                    />
                    <div
                      aria-hidden="true"
                      className={`absolute top-1/2 -translate-y-1/2 left-4 pointer-events-none text-sm text-opacity-50 text-start transition-opacity ${homeUrlInput ? 'opacity-0' : 'opacity-100'}`}
                    >
                      <span className="text-[#605A57]/50 text-xs" style={{ fontFamily: 'monospace' }}>
                        https://example.com or "Create a modern portfolio website"
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={!homeUrlInput.trim()}
                      className="absolute top-1/2 transform -translate-y-1/2 right-2 flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-zinc-500 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Generate Website"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <polyline points="9 10 4 15 9 20"></polyline>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
                      </svg>
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Upload button clicked');
                      setShowDocumentUpload(true);
                    }}
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-[18px] hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-lg"
                    style={{
                      boxShadow: '0 0 0 1px #e3e1de66, 0 1px 2px #5f4a2e14, 0 4px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    Upload Doc
                  </button>
                </div>
              </form>

              <div className="mt-6 flex items-center justify-center animate-[fadeIn_1s_ease-out]">
                <select
                  value={aiModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setAiModel(newModel);
                    const params = new URLSearchParams(searchParams);
                    params.set('model', newModel);
                    if (sandboxData?.sandboxId) {
                      params.set('sandbox', sandboxData.sandboxId);
                    }
                    router.push(`/?${params.toString()}`);
                  }}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#36322F] focus:border-transparent"
                  style={{
                    boxShadow: '0 0 0 1px #e3e1de66, 0 1px 2px #5f4a2e14'
                  }}
                >
                  {appConfig.ai.availableModels.map(model => (
                    <option key={model} value={model}>
                      {appConfig.ai.modelDisplayNames[model] || model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card px-4 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/logo-growth99.svg"
            alt="growth99"
            className="h-8 w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={aiModel}
            onChange={(e) => {
              const newModel = e.target.value;
              setAiModel(newModel);
              const params = new URLSearchParams(searchParams);
              params.set('model', newModel);
              if (sandboxData?.sandboxId) {
                params.set('sandbox', sandboxData.sandboxId);
              }
              router.push(`/?${params.toString()}`);
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#36322F] focus:border-transparent"
          >
            {appConfig.ai.availableModels.map(model => (
              <option key={model} value={model}>
                {appConfig.ai.modelDisplayNames[model] || model}
              </option>
            ))}
          </select>
          
          {/* Add Redesign Button */}
          {sandboxData && (
            <Button
              variant="code"
              onClick={handleRedesign}
              size="sm"
              title="Redesign with intelligent schema"
              disabled={generationProgress.isGenerating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Redesign
            </Button>
          )}
          
          <Button
            variant="code"
            onClick={() => createSandbox()}
            size="sm"
            title="Create new sandbox"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
          <Button
            variant="code"
            onClick={reapplyLastGeneration}
            size="sm"
            title="Re-apply last generation"
            disabled={!conversationContext.lastGeneratedCode || !sandboxData}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
          <Button
            variant="code"
            onClick={downloadZip}
            disabled={!sandboxData}
            size="sm"
            title="Download your Vite app as ZIP"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </Button>
          <div className="inline-flex items-center gap-2 bg-[#36322F] text-white px-3 py-1.5 rounded-[10px] text-sm font-medium [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)]">
            <span id="status-text">{status.text}</span>
            <div className={`w-2 h-2 rounded-full ${status.active ? 'bg-green-500' : 'bg-gray-500'}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 max-w-[400px] flex flex-col border-r border-border bg-background">
          {conversationContext.scrapedWebsites?.length > 0 && (
            <div className="p-4 bg-card">
              <div className="flex flex-col gap-2">
                {conversationContext.scrapedWebsites.map((site, idx) => {
                  const metadata = site.content?.metadata || {};
                  const sourceURL = metadata.sourceURL || site.url;
                  const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=32`;
                  const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;

                  return (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <img
                        src={favicon}
                        alt={siteName}
                        className="w-4 h-4 rounded"
                        onError={(e) => {
                          e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=32`;
                        }}
                      />
                      <a
                        href={sourceURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black hover:text-gray-700 truncate max-w-[250px]"
                        title={sourceURL}
                      >
                        {siteName}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 scrollbar-hide" ref={chatMessagesRef}>
            {chatMessages.map((msg, idx) => {
              const isGenerationComplete = msg.content.includes('Successfully recreated') ||
                msg.content.includes('AI recreation generated!') ||
                msg.content.includes('Code generated!');

              const completedFiles = msg.metadata?.appliedFiles || [];

              return (
                <div key={idx} className="block">
                  <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className="block">
                      <div className={`block rounded-[10px] px-4 py-2 ${msg.type === 'user' ? 'bg-[#36322F] text-white ml-auto max-w-[80%]' :
                        msg.type === 'ai' ? 'bg-gray-100 text-gray-900 mr-auto max-w-[80%]' :
                          msg.type === 'system' ? 'bg-[#36322F] text-white text-sm' :
                            msg.type === 'command' ? 'bg-[#36322F] text-white font-mono text-sm' :
                              msg.type === 'error' ? 'bg-red-900 text-red-100 text-sm border border-red-700' :
                                'bg-[#36322F] text-white text-sm'
                        }`}>
                        {msg.type === 'command' ? (
                          <div className="flex items-start gap-2">
                            <span className={`text-xs ${msg.metadata?.commandType === 'input' ? 'text-blue-400' :
                              msg.metadata?.commandType === 'error' ? 'text-red-400' :
                                msg.metadata?.commandType === 'success' ? 'text-green-400' :
                                  'text-gray-400'
                              }`}>
                              {msg.metadata?.commandType === 'input' ? '$' : '>'}
                            </span>
                            <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                          </div>
                        ) : msg.type === 'error' ? (
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold mb-1">Build Errors Detected</div>
                              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                              <div className="mt-2 text-xs opacity-70">Press 'F' or click the Fix button above to resolve</div>
                            </div>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>

                      {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                        <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                          <div className="text-xs font-medium mb-1 text-gray-700">
                            {msg.content.includes('Applied') ? 'Files Updated:' : 'Generated Files:'}
                          </div>
                          <div className="flex flex-wrap items-start gap-1">
                            {msg.metadata.appliedFiles.map((filePath, fileIdx) => {
                              const fileName = filePath.split('/').pop() || filePath;
                              const fileExt = fileName.split('.').pop() || '';
                              const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                fileExt === 'css' ? 'css' :
                                  fileExt === 'json' ? 'json' : 'text';

                              return (
                                <div
                                  key={`applied-${fileIdx}`}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                                  style={{ animationDelay: `${fileIdx * 30}ms` }}
                                >
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${fileType === 'css' ? 'bg-blue-400' :
                                    fileType === 'javascript' ? 'bg-yellow-400' :
                                      fileType === 'json' ? 'bg-green-400' :
                                        'bg-gray-400'
                                    }`} />
                                  {fileName}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {isGenerationComplete && generationProgress.files.length > 0 && idx === chatMessages.length - 1 && !msg.metadata?.appliedFiles && !chatMessages.some(m => m.metadata?.appliedFiles) && (
                        <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                          <div className="text-xs font-medium mb-1 text-gray-700">Generated Files:</div>
                          <div className="flex flex-wrap items-start gap-1">
                            {generationProgress.files.map((file, fileIdx) => (
                              <div
                                key={`complete-${fileIdx}`}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                                style={{ animationDelay: `${fileIdx * 30}ms` }}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${file.type === 'css' ? 'bg-blue-400' :
                                  file.type === 'javascript' ? 'bg-yellow-400' :
                                    file.type === 'json' ? 'bg-green-400' :
                                      'bg-gray-400'
                                  }`} />
                                {file.path.split('/').pop()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {codeApplicationState.stage && (
              <CodeApplicationProgress state={codeApplicationState} />
            )}

            {generationProgress.isGenerating && (
              <div className="inline-block bg-gray-100 rounded-lg p-3">
                <div className="text-sm font-medium mb-2 text-gray-700">
                  {generationProgress.status}
                </div>
                <div className="flex flex-wrap items-start gap-1">
                  {generationProgress.files.map((file, idx) => (
                    <div
                      key={`file-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      {file.path.split('/').pop()}
                    </div>
                  ))}

                  {generationProgress.currentFile && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-xs animate-pulse"
                      style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {generationProgress.currentFile.path.split('/').pop()}
                    </div>
                  )}
                </div>

                {generationProgress.streamedCode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 border-t border-gray-300 pt-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-gray-600">AI Response Stream</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded max-h-32 overflow-y-auto scrollbar-hide">
                      <SyntaxHighlighter
                        language="jsx"
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          padding: '0.75rem',
                          fontSize: '11px',
                          lineHeight: '1.5',
                          background: 'transparent',
                          maxHeight: '8rem',
                          overflow: 'hidden'
                        }}
                      >
                        {(() => {
                          const lastContent = generationProgress.streamedCode.slice(-1000);
                          const startIndex = lastContent.indexOf('<');
                          return startIndex !== -1 ? lastContent.slice(startIndex) : lastContent;
                        })()}
                      </SyntaxHighlighter>
                      <span className="inline-block w-2 h-3 bg-orange-400 ml-3 mb-3 animate-pulse" />
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border bg-card">
            <div className="relative">
              <Textarea
                className="min-h-[60px] pr-12 resize-y border-2 border-black focus:outline-none"
                placeholder=""
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                rows={3}
              />
              <button
                onClick={sendChatMessage}
                className="absolute right-2 bottom-2 p-2 bg-[#36322F] text-white rounded-[10px] hover:bg-[#4a4542] [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] transition-all duration-200"
                title="Send message (Enter)"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 bg-card border-b border-border flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex bg-[#36322F] rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('generation')}
                  className={`p-2 rounded-md transition-all ${activeTab === 'generation'
                    ? 'bg-black text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  title="Code"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`p-2 rounded-md transition-all ${activeTab === 'preview'
                    ? 'bg-black text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  title="Preview"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0) && (
                <div className="flex items-center gap-3">
                  {!generationProgress.isEdit && (
                    <div className="text-gray-600 text-sm">
                      {generationProgress.files.length} files generated
                    </div>
                  )}
                  <div className={`inline-flex items-center justify-center whitespace-nowrap rounded-[10px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#36322F] text-white hover:bg-[#36322F] [box-shadow:inset_0px_-2px_0px_0px_#171310,_0px_1px_6px_0px_rgba(58,_33,_8,_58%)] hover:translate-y-[1px] hover:scale-[0.98] hover:[box-shadow:inset_0px_-1px_0px_0px_#171310,_0px_1px_3px_0px_rgba(58,_33,_8,_40%)] active:translate-y-[2px] active:scale-[0.97] active:[box-shadow:inset_0px_1px_1px_0px_#171310,_0px_1px_2px_0px_rgba(58,_33,_8,_30%)] disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:scale-100 h-8 px-3 py-1 text-sm gap-2`}>
                    {generationProgress.isGenerating ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                        {generationProgress.isEdit ? 'Editing code' : 'Live code generation'}
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-gray-500 rounded-full" />
                        COMPLETE
                      </>
                    )}
                  </div>
                </div>
              )}
              {sandboxData && !generationProgress.isGenerating && (
                <>
                  <Button
                    variant="code"
                    size="sm"
                    asChild
                  >
                    <a
                      href={sandboxData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in new tab"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {renderMainContent()}
          </div>
        </div>
      </div>

      {showDocumentUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Upload Business Document</h2>
              <button
                onClick={() => {
                  console.log('Closing modal');
                  setShowDocumentUpload(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <DocumentUpload
              onDocumentProcessed={(info, prompt) => {
                console.log('Document processed:', info);
                handleDocumentProcessed(info, prompt);
              }}
              onError={(error) => {
                console.log('Document error:', error);
                handleDocumentError(error);
              }}
            />
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">What information will be extracted?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Business Name</li>
                <li>• Unique Value Proposition</li>
                <li>• Competitors and Their Websites</li>
                <li>• Color Palette Scheme</li>
                <li>• Preferred Font Style</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {showExtractedDataReview && extractedBusinessInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Review Extracted Business Information</h2>
              <button
                onClick={() => setShowExtractedDataReview(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Extracted Data Display */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Extracted Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                    <input
                      type="text"
                      value={editableExtractedInfo?.businessName || extractedBusinessInfo.businessName || ''}
                      onChange={(e) => setEditableExtractedInfo(prev => ({
                        ...prev,
                        ...extractedBusinessInfo,
                        businessName: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter business name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unique Value Proposition</label>
                    <textarea
                      value={editableExtractedInfo?.uniqueValueProposition || extractedBusinessInfo.uniqueValueProposition || ''}
                      onChange={(e) => setEditableExtractedInfo(prev => ({
                        ...prev,
                        ...extractedBusinessInfo,
                        uniqueValueProposition: e.target.value
                      }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="What makes your business unique?"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Competitors</label>
                    <input
                      type="text"
                      value={editableExtractedInfo?.competitors || extractedBusinessInfo.competitors || ''}
                      onChange={(e) => setEditableExtractedInfo(prev => ({
                        ...prev,
                        ...extractedBusinessInfo,
                        competitors: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="List your main competitors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color Palette</label>
                    <input
                      type="text"
                      value={editableExtractedInfo?.colorPalette || extractedBusinessInfo.colorPalette || ''}
                      onChange={(e) => setEditableExtractedInfo(prev => ({
                        ...prev,
                        ...extractedBusinessInfo,
                        colorPalette: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Blue, white, and gray"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Font</label>
                    <input
                      type="text"
                      value={editableExtractedInfo?.preferredFont || extractedBusinessInfo.preferredFont || ''}
                      onChange={(e) => setEditableExtractedInfo(prev => ({
                        ...prev,
                        ...extractedBusinessInfo,
                        preferredFont: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="e.g., Clean, modern sans-serif"
                    />
                  </div>
                </div>
              </div>
              
              {/* Design Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Design Preview</h3>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                    <span className="font-medium text-gray-900">
                      {editableExtractedInfo?.businessName || extractedBusinessInfo.businessName || 'Your Business'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <strong>Value Proposition:</strong><br/>
                    {editableExtractedInfo?.uniqueValueProposition || extractedBusinessInfo.uniqueValueProposition || 'Professional services and solutions'}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <strong>Style:</strong> {editableExtractedInfo?.colorPalette || extractedBusinessInfo.colorPalette || 'Professional and modern colors'} with {editableExtractedInfo?.preferredFont || extractedBusinessInfo.preferredFont || 'clean, readable fonts'}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <strong>Competition:</strong> {editableExtractedInfo?.competitors || extractedBusinessInfo.competitors || 'Industry competitors'}
                  </div>
                </div>
                
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-medium text-orange-900 mb-2">What will be generated:</h4>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Modern, responsive website design</li>
                    <li>• Professional color scheme based on your preferences</li>
                    <li>• Typography matching your font requirements</li>
                    <li>• Sections highlighting your unique value proposition</li>
                    <li>• Mobile-first, accessible design</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowExtractedDataReview(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtractedDataReview}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
              >
                Generate Website
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main component with Suspense boundary
export default function AISandboxPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">Loading...</h3>
          <p className="text-gray-300">Preparing your AI sandbox</p>
        </div>
      </div>
    }>
      <AISandboxPageContent />
    </Suspense>
  );
}