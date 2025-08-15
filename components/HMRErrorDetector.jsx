import { useEffect, useRef } from 'react';


export default function HMRErrorDetector({ iframeRef, onErrorDetected }) {
  const checkIntervalRef = useRef(null);

  useEffect(() => {
    const checkForHMRErrors = () => {
      if (!iframeRef.current) return;

      try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (!iframeDoc) return;

        const errorOverlay = iframeDoc.querySelector('vite-error-overlay');
        if (errorOverlay) {
          const messageElement = errorOverlay.shadowRoot?.querySelector('.message-body');
          if (messageElement) {
            const errorText = messageElement.textContent || '';

            const importMatch = errorText.match(/Failed to resolve import "([^"]+)"/);
            if (importMatch) {
              const packageName = importMatch[1];
              if (!packageName.startsWith('.')) {
                let finalPackage = packageName;
                if (packageName.startsWith('@')) {
                  const parts = packageName.split('/');
                  finalPackage = parts.length >= 2 ? parts.slice(0, 2).join('/') : packageName;
                } else {
                  finalPackage = packageName.split('/')[0];
                }

                onErrorDetected([{
                  type: 'npm-missing',
                  message: `Failed to resolve import "${packageName}"`,
                  package: finalPackage
                }]);
              }
            }
          }
        }
      } catch (error) {
      }
    };

    checkForHMRErrors();
    checkIntervalRef.current = setInterval(checkForHMRErrors, 2000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [iframeRef, onErrorDetected]);

  return null;
}