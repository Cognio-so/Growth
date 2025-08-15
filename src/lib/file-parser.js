import { FileInfo, ImportInfo, ComponentInfo } from '../types/file-manifest';

/**
 * Parse a JavaScript/JSX file to extract imports, exports, and component info
 */
export function parseJavaScriptFile(content, filePath) {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const componentInfo = extractComponentInfo(content, filePath);
  const fileType = determineFileType(filePath, content);

  return {
    imports,
    exports,
    componentInfo,
    type: fileType,
  };
}

/**
 * Extract import statements from file content
 */
function extractImports(content) {
  const imports = [];

  const importRegex = /import\s+(?:(.+?)\s+from\s+)?['"](.+?)['"]/g;
  const matches = content.matchAll(importRegex);

  for (const match of matches) {
    const [, importClause, source] = match;
    const importInfo = {
      source,
      imports: [],
      isLocal: source.startsWith('./') || source.startsWith('../') || source.startsWith('@/'),
    };

    if (importClause) {
      const defaultMatch = importClause.match(/^(\w+)(?:,|$)/);
      if (defaultMatch) {
        importInfo.defaultImport = defaultMatch[1];
      }

      const namedMatch = importClause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        importInfo.imports = namedMatch[1]
          .split(',')
          .map(imp => imp.trim())
          .map(imp => imp.split(/\s+as\s+/)[0].trim());
      }
    }

    imports.push(importInfo);
  }

  return imports;
}

/**
 * Extract export statements from file content
 */
function extractExports(content) {
  const exports = [];

  if (/export\s+default\s+/m.test(content)) {
    const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push(`default:${defaultExportMatch[1]}`);
    } else {
      exports.push('default');
    }
  }

  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  const namedMatches = content.matchAll(namedExportRegex);

  for (const match of namedMatches) {
    exports.push(match[1]);
  }

  const exportBlockRegex = /export\s+\{([^}]+)\}/g;
  const blockMatches = content.matchAll(exportBlockRegex);

  for (const match of blockMatches) {
    const names = match[1]
      .split(',')
      .map(exp => exp.trim())
      .map(exp => exp.split(/\s+as\s+/)[0].trim());
    exports.push(...names);
  }

  return exports;
}

/**
 * Extract React component information
 */
function extractComponentInfo(content, filePath) {
  const hasJSX = /<[A-Z]\w*|<[a-z]+\s+[^>]*\/?>/.test(content);
  if (!hasJSX && !content.includes('React')) return undefined;

  let componentName = '';

  const funcComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*\(/);
  if (funcComponentMatch) {
    componentName = funcComponentMatch[1];
  } else {
    const arrowComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?(?:const|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[^=])*=>/);
    if (arrowComponentMatch) {
      componentName = arrowComponentMatch[1];
    }
  }


  if (!componentName) {
    const fileName = filePath.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '');
    if (fileName && /^[A-Z]/.test(fileName)) {
      componentName = fileName;
    }
  }

  if (!componentName) return undefined;

  const hooks = [];
  const hookRegex = /use[A-Z]\w*/g;
  const hookMatches = content.matchAll(hookRegex);
  for (const match of hookMatches) {
    if (!hooks.includes(match[0])) {
      hooks.push(match[0]);
    }
  }

  const hasState = hooks.includes('useState') || hooks.includes('useReducer');

  const childComponents = [];
  const componentRegex = /<([A-Z]\w*)[^>]*(?:\/?>|>)/g;
  const componentMatches = content.matchAll(componentRegex);

  for (const match of componentMatches) {
    const comp = match[1];
    if (!childComponents.includes(comp) && comp !== componentName) {
      childComponents.push(comp);
    }
  }

  return {
    name: componentName,
    hooks,
    hasState,
    childComponents,
  };
}

/**
 * Determine file type based on path and content
 */
function determineFileType(
  filePath,
  content
) {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  const dirPath = filePath.toLowerCase();

  if (fileName.endsWith('.css')) return 'style';

  if (fileName.includes('config') ||
    fileName === 'vite.config.js' ||
    fileName === 'tailwind.config.js' ||
    fileName === 'postcss.config.js') {
    return 'config';
  }

  if (dirPath.includes('/hooks/') || fileName.startsWith('use')) {
    return 'hook';
  }

  if (dirPath.includes('/context/') || fileName.includes('context')) {
    return 'context';
  }

  if (fileName.includes('layout') || content.includes('children')) {
    return 'layout';
  }

  if (dirPath.includes('/pages/') ||
    content.includes('useRouter') ||
    content.includes('useParams')) {
    return 'page';
  }

  if (dirPath.includes('/utils/') ||
    dirPath.includes('/lib/') ||
    !content.includes('export default')) {
    return 'utility';
  }

  return 'component';
}

/**
 * Build component dependency tree
 */
export function buildComponentTree(files) {
  const tree = {};

  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo) {
      const componentName = fileInfo.componentInfo.name;
      tree[componentName] = {
        file: path,
        imports: [],
        importedBy: [],
        type: fileInfo.type === 'page' ? 'page' :
          fileInfo.type === 'layout' ? 'layout' : 'component',
      };
    }
  }

  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo && fileInfo.imports) {
      const componentName = fileInfo.componentInfo.name;

      for (const imp of fileInfo.imports) {
        if (imp.isLocal && imp.defaultImport) {
          if (tree[imp.defaultImport]) {
            tree[componentName].imports.push(imp.defaultImport);
            tree[imp.defaultImport].importedBy.push(componentName);
          }
        }
      }
    }
  }

  return tree;
}