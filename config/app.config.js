

export const appConfig = {
  e2b: {
    timeoutMinutes: 30,
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },
    vitePort: 5173,
    viteStartupDelay: 7000,
    cssRebuildDelay: 2000,
    defaultTemplate: undefined,
  },

  ai: {
    defaultModel: 'moonshotai/kimi-k2-instruct',
    availableModels: [
      'openai/gpt-5',
      'moonshotai/kimi-k2-instruct',
      'anthropic/claude-sonnet-4-20250514'
    ],
    modelDisplayNames: {
      'openai/gpt-5': 'GPT-5',
      'moonshotai/kimi-k2-instruct': 'Kimi K2 Instruct',
      'anthropic/claude-sonnet-4-20250514': 'Sonnet 4'
    },
    defaultTemperature: 0.7,
    maxTokens: 8000,
    truncationRecoveryMaxTokens: 4000,
  },

  codeApplication: {
    defaultRefreshDelay: 2000,
    packageInstallRefreshDelay: 5000,
    enableTruncationRecovery: false,
    maxTruncationRecoveryAttempts: 1,
  },

  ui: {
    showModelSelector: true,
    showStatusIndicator: true,
    animationDuration: 200,
    toastDuration: 3000,
    maxChatMessages: 100,
    maxRecentMessagesContext: 20,
  },

  dev: {
    enableDebugLogging: true,
    enablePerformanceMonitoring: false,
    logApiResponses: true,
  },

  packages: {
    useLegacyPeerDeps: true,
    installTimeout: 60000,
    autoRestartVite: true,
  },

  files: {
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      '.next/**',
      'dist/**',
      'build/**',
      '*.log',
      '.DS_Store'
    ],
    maxFileSize: 1024 * 1024,
    textFileExtensions: [
      '.js', '.jsx', '.ts', '.tsx',
      '.css', '.scss', '.sass',
      '.html', '.xml', '.svg',
      '.json', '.yml', '.yaml',
      '.md', '.txt', '.env',
      '.gitignore', '.dockerignore'
    ],
  },

  api: {
    maxRetries: 3,
    retryDelay: 1000,
    requestTimeout: 30000,
  }
};

export function getConfig(key) {
  return appConfig[key];
}

export function getConfigValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], appConfig);
}

// Default export for compatibility
export default appConfig;
