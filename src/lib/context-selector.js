import { FileManifest, EditIntent, EditType } from '../types/file-manifest';
import { analyzeEditIntent } from './edit-intent-analyzer';
import { getEditExamplesPrompt, getComponentPatternPrompt } from './edit-examples';

export const FileContext = {
  primaryFiles: [], 
  contextFiles: [], 
  systemPrompt: '',   
  editIntent: ''
}

/**
 * Select files and build context based on user prompt
 */
export function selectFilesForEdit(
  userPrompt,
  manifest,
  extractedBusinessInfo = null,
  documentDesignPrompt = null
) {
  const editIntent = analyzeEditIntent(userPrompt, manifest);
  
  const primaryFiles = editIntent.targetFiles;
  const allFiles = Object.keys(manifest.files);
  let contextFiles = allFiles.filter(file => !primaryFiles.includes(file));
  
  const keyFiles = [];
  
  const appFile = allFiles.find(f => f.endsWith('App.jsx') || f.endsWith('App.tsx'));
  if (appFile && !primaryFiles.includes(appFile)) {
    keyFiles.push(appFile);
  }
  
  const tailwindConfig = allFiles.find(f => f.endsWith('tailwind.config.js') || f.endsWith('tailwind.config.ts'));
  if (tailwindConfig && !primaryFiles.includes(tailwindConfig)) {
    keyFiles.push(tailwindConfig);
  }
  
  const indexCss = allFiles.find(f => f.endsWith('index.css') || f.endsWith('globals.css'));
  if (indexCss && !primaryFiles.includes(indexCss)) {
    keyFiles.push(indexCss);
  }
  
  const packageJson = allFiles.find(f => f.endsWith('package.json'));
  if (packageJson && !primaryFiles.includes(packageJson)) {
    keyFiles.push(packageJson);
  }
  
  contextFiles = [...keyFiles, ...contextFiles.filter(f => !keyFiles.includes(f))];
  
  const systemPrompt = buildSystemPrompt(
    userPrompt,
    editIntent,
    primaryFiles,
    contextFiles,
    manifest,
    extractedBusinessInfo,
    documentDesignPrompt
  );
  
  return {
    primaryFiles,
    contextFiles,
    systemPrompt,
    editIntent,
  };
}

/**
 * Build an enhanced system prompt with file structure context
 */
function buildSystemPrompt(
  userPrompt,
  editIntent,
  primaryFiles,
  contextFiles,
  manifest,
  extractedBusinessInfo = null,
  documentDesignPrompt = null
) {
  const sections = [];
  
  // Add document-based business information if available
  if (extractedBusinessInfo && documentDesignPrompt) {
    sections.push(`## 📄 DOCUMENT-BASED BUSINESS REQUIREMENTS

### Extracted Business Information:
- **Business Name:** ${extractedBusinessInfo.businessName || 'Not specified'}
- **Unique Value Proposition:** ${extractedBusinessInfo.uniqueValueProposition || 'Not specified'}
- **Competitors:** ${extractedBusinessInfo.competitors || 'Not specified'}
- **Color Palette:** ${extractedBusinessInfo.colorPalette || 'Professional and modern colors'}
- **Preferred Font:** ${extractedBusinessInfo.preferredFont || 'Clean, readable fonts'}

### Design Requirements from Document:
${documentDesignPrompt}

**CRITICAL:** The website you create MUST reflect the business's unique value proposition and brand identity as specified above. Use the extracted color palette and font preferences when possible, while following the UI design principles below.`);
  }
  
  // Add UI Design Principles section with the exact guidelines
  sections.push(`## UI/UX DESIGN PRINCIPLES - FOLLOW THESE GUIDELINES STRICTLY

### 1. Layout & Grids
- Use a simple 12-column grid system to keep things neat and balanced
- Keep elements aligned and organized like a clean desk - everything lines up nicely, no matter the screen size
- Avoid wonky, misaligned stuff; it throws people off

### 2. Typography
- Pick 1-2 font families maximum (one for headlines, one for body text) to keep it clean
- Make your main title pop (H1), use subheadings (H2-H4) for structure
- Body text: Go for at least 16px - bump it up to 16-18px on mobile for easy reading
- Line Height: Space lines out at 1.4-1.6 times the font size - gives text room to breathe
- Letter Spacing: Keep normal text tight (~0em), but for all-caps headings, add a tiny bit (0.05-0.1em)
- Alignment: Left-align body text for smooth reading; center short bits like titles or quotes
- Contrast: Make sure text pops against the background - dark text on light or vice versa
- Hierarchy: Play with size, weight, and spacing to guide the eye - big bold titles and smaller body text
- Consistency: Set a type scale and stick with it across the site for a unified feel

### 3. Color System
- Follow 60-30-10 rule: 60% neutral, 30% main color, 10% accent
- Primary Color: Your brand's main vibe - bold buttons, links, or highlights that scream "this is us!"
- Secondary Color: The sidekick to your primary color, perfect for subtle accents. Sprinkle it lightly
- Background Color: Keep it chill with neutral tones like light gray, white, or dark gray for a clean look
- Text Color: Make sure it stands out sharp against the background
- Accent Color: A fun pop for alerts, badges, or special touches. Go bold but don't overdo it
- State Colors: Green for "Yay, it worked!", red for "Oops, error!", yellow for warnings

### 4. Spacing & White Space
- Use a Spacing Scale: Stick to multiples of 4px or 8px (like 8, 16, 24px) - keeps everything tidy
- Group Related Stuff: Keep things that belong together close, with tight gaps (8-16px)
- Separate Sections: Give big sections breathing room with wider gaps (64-96px)
- Make Text Easy to Read: Use enough line height and paragraph spacing so text doesn't feel cramped
- Give Buttons Space: Leave room around your CTAs - makes them stand out and easier to click
- Avoid a Messy Look: More space means less clutter, helping users focus and enjoy the experience

### 5. Visual Hierarchy
- Guide people's eyes naturally: big, bold stuff grabs attention first, then smaller details
- Use size, color, and placement to highlight what matters most, like key info or buttons right up top

### 6. Navigation Systems
- Keep it Simple and Consistent: Use familiar navigation patterns with clear, concise labels
- Limit and Organize Menu Items: Stick to 5-7 main items and group related links logically
- Ensure Visibility and Feedback: Highlight the current page or section
- Make it Responsive and Accessible: Work seamlessly across devices, be keyboard-friendly, and support screen readers
- Add Search for Larger Sites: Include a prominent search bar for content-rich websites

### 7. Buttons & CTAs
- Make Them Pop: Use bold, contrasting colors and subtle shadows to stand out. Keep it clear, not flashy
- Clear, Action-Oriented Labels: Stick to short, snappy text like "Sign Up" or "Shop Now"
- Right Size & Spacing: Aim for 44x44px minimum (mobile-friendly), with 8-16px padding and 24px gaps around
- Add Feedback: Include hover effects or quick animations (200-300ms) to show clicks
- Stay Accessible & Consistent: Ensure high contrast (4.5:1), keyboard-friendly focus states, and uniform styles

### 8. Icons & Images
- Use consistent stroke width, corner radius, and perspective for icons
- Maintain uniform icon grid (typically 24x24px or 32x32px)
- Align icons to text baselines when inline with labels
- Go for crisp vector icons (SVGs) and high-resolution but optimized images
- Match your brand's vibe - whether it's warm, professional, or luxe
- Skip blurry or generic stock photos; they cheapen the look

### 9. Motion & Animation Guidelines
- Purposeful animations (200ms to 500ms duration)
- Use natural easing functions for fluid transitions
- Keep animations subtle to avoid overwhelming users
- Respect motion preferences for accessibility
- Use efficient properties like transform and opacity for performance

### 10. Form Design & Validation
- Clear input field styling (normal, focused, error, success)
- Consistent spacing and label placements
- Clear error messages and validation patterns

### 11. Consistency
- Reuse colors, fonts, and button styles everywhere
- Builds trust and feels familiar, like walking into your favorite coffee shop
- Use a style guide to keep things on track

### 12. Feedback & Interactions
- Add little touches like hover effects or loading animations to show users what's happening
- Think "Message Sent!" pop-ups or buttons that glow when clicked - it's fun and reassuring

### 13. Responsiveness
- Start designing for phones first, then scale up (mobile-first approach)
- Use breakpoints (768px, 1024px) to tweak layouts
- Make sure everything looks great and works smoothly on all screens

CRITICAL IMPLEMENTATION REQUIREMENTS:
1. **ALWAYS** use Tailwind CSS classes that follow these exact principles
2. **ALWAYS** implement mobile-first responsive design
3. **ALWAYS** use semantic HTML5 elements
4. **ALWAYS** ensure accessibility (ARIA labels, keyboard navigation)
5. **ALWAYS** follow the 60-30-10 color rule and spacing scale (8px, 16px, 24px, 64px, 96px)
6. **ALWAYS** create smooth animations and transitions (200-500ms)
7. **ALWAYS** maintain visual hierarchy and consistency
8. **ALWAYS** use the 12-column grid system approach
9. **ALWAYS** ensure 16-18px minimum text size
10. **ALWAYS** implement proper button sizing (44x44px minimum)

CRITICAL: Every component you create MUST follow these UI/UX principles exactly as specified. This is non-negotiable.`);

  if (editIntent.type !== EditType.FULL_REBUILD) {
    sections.push(getEditExamplesPrompt());
  }
  
  sections.push(`## Edit Intent
Type: ${editIntent.type}
Description: ${editIntent.description}
Confidence: ${(editIntent.confidence * 100).toFixed(0)}%

User Request: "${userPrompt}"`);
  
  sections.push(buildFileStructureSection(manifest));
  
  const fileList = Object.keys(manifest.files).map(f => f.replace('/home/user/app/', '')).join('\n');
  sections.push(getComponentPatternPrompt(fileList));
  
  if (primaryFiles.length > 0) {
    sections.push(`## Files to Edit
${primaryFiles.map(f => {
  const fileInfo = manifest.files[f];
  return `- ${f}${fileInfo?.componentInfo ? ` (${fileInfo.componentInfo.name} component)` : ''}`;
}).join('\n')}`);
  }
  
  if (contextFiles.length > 0) {
    sections.push(`## Context Files (for reference only)
${contextFiles.map(f => {
  const fileInfo = manifest.files[f];
  return `- ${f}${fileInfo?.componentInfo ? ` (${fileInfo.componentInfo.name} component)` : ''}`;
}).join('\n')}`);
  }
  
  sections.push(buildEditInstructions(editIntent.type));
  
  if (editIntent.type === EditType.UPDATE_COMPONENT || 
      editIntent.type === EditType.ADD_FEATURE) {
    sections.push(buildComponentRelationships(primaryFiles, manifest));
  }
  
  return sections.join('\n\n');
}

/**
 * Build file structure overview section
 */
function buildFileStructureSection(manifest) {
  const allFiles = Object.entries(manifest.files)
    .map(([path]) => path.replace('/home/user/app/', ''))
    .filter(path => !path.includes('node_modules'))
    .sort();
  
  const componentFiles = Object.entries(manifest.files)
    .filter(([, info]) => info.type === 'component' || info.type === 'page')
    .map(([path, info]) => ({
      path: path.replace('/home/user/app/', ''),
      name: info.componentInfo?.name || path.split('/').pop(),
      type: info.type,
    }));
  
  return `## 🚨 EXISTING PROJECT FILES - DO NOT CREATE NEW FILES WITH SIMILAR NAMES 🚨

### ALL PROJECT FILES (${allFiles.length} files)
\`\`\`
${allFiles.join('\n')}
\`\`\`

### Component Files (USE THESE EXACT NAMES)
${componentFiles.map(f => 
  `- ${f.name} → ${f.path} (${f.type})`
).join('\n')}

### CRITICAL: Component Relationships
**ALWAYS CHECK App.jsx FIRST** to understand what components exist and how they're imported!

Common component overlaps to watch for:
- "nav" or "navigation" → Often INSIDE Header.jsx, not a separate file
- "menu" → Usually part of Header/Nav, not separate
- "logo" → Typically in Header, not standalone

When user says "nav" or "navigation":
1. First check if Header.jsx exists
2. Look inside Header.jsx for navigation elements
3. Only create Nav.jsx if navigation doesn't exist anywhere

Entry Point: ${manifest.entryPoint}

### Routes
${manifest.routes.map(r => 
  `- ${r.path} → ${r.component.split('/').pop()}`
).join('\n') || 'No routes detected'}`;
}

/**
 * Build edit-type specific instructions
 */
function buildEditInstructions(editType) {
  const instructions = {
    [EditType.UPDATE_COMPONENT]: `## SURGICAL EDIT INSTRUCTIONS
- You MUST preserve 99% of the original code
- ONLY edit the specific component(s) mentioned
- Make ONLY the minimal change requested
- DO NOT rewrite or refactor unless explicitly asked
- DO NOT remove any existing code unless explicitly asked
- DO NOT change formatting or structure
- Preserve all imports and exports
- Maintain the existing code style
- Return the COMPLETE file with the surgical change applied
- Think of yourself as a surgeon making a precise incision, not an artist repainting
- MUST follow the UI Design Principles for any new or modified elements`,
    
    [EditType.ADD_FEATURE]: `## Instructions
- Create new components in appropriate directories
- IMPORTANT: Update parent components to import and use the new component
- Update routing if adding new pages
- Follow existing patterns and conventions
- Add necessary styles to match existing design
- MUST follow the UI Design Principles exactly
- Example workflow:
  1. Create NewComponent.jsx following UI guidelines
  2. Import it in the parent: import NewComponent from './NewComponent'
  3. Use it in the parent's render: <NewComponent />`,
    
    [EditType.FIX_ISSUE]: `## Instructions
- Identify and fix the specific issue
- Test the fix doesn't break other functionality
- Preserve existing behavior except for the bug
- Add error handling if needed
- MUST follow the UI Design Principles for any UI fixes`,
    
    [EditType.UPDATE_STYLE]: `## SURGICAL STYLE EDIT INSTRUCTIONS
- Change ONLY the specific style/class mentioned
- If user says "change background to blue", change ONLY the background class
- DO NOT touch any other styles, classes, or attributes
- DO NOT refactor or "improve" the styling
- DO NOT change the component structure
- Preserve ALL other classes and styles exactly as they are
- Return the COMPLETE file with only the specific style change
- MUST ensure the change follows the UI Design Principles (spacing scale, color rules, etc.)`,
    
    [EditType.REFACTOR]: `## Instructions
- Improve code quality without changing functionality
- Follow project conventions
- Maintain all existing features
- Improve readability and maintainability
- MUST follow the UI Design Principles`,
    
    [EditType.FULL_REBUILD]: `## Instructions
- You may rebuild the entire application
- Keep the same core functionality
- Improve upon the existing design
- Use modern best practices
- MUST follow ALL UI Design Principles exactly`,
    
    [EditType.ADD_DEPENDENCY]: `## Instructions
- Update package.json with new dependency
- Add necessary import statements
- Configure the dependency if needed
- Update any build configuration`,
  };
  
  return instructions[editType] || instructions[EditType.UPDATE_COMPONENT];
}

/**
 * Build component relationship information
 */
function buildComponentRelationships(
  files,
  manifest
) {
  const relationships = ['## Component Relationships'];
  
  for (const file of files) {
    const fileInfo = manifest.files[file];
    if (!fileInfo?.componentInfo) continue;
    
    const componentName = fileInfo.componentInfo.name;
    const treeNode = manifest.componentTree[componentName];
    
    if (treeNode) {
      relationships.push(`\n### ${componentName}`);
      
      if (treeNode.imports.length > 0) {
        relationships.push(`Imports: ${treeNode.imports.join(', ')}`);
      }
      
      if (treeNode.importedBy.length > 0) {
        relationships.push(`Used by: ${treeNode.importedBy.join(', ')}`);
      }
      
      if (fileInfo.componentInfo.childComponents?.length) {
        relationships.push(`Renders: ${fileInfo.componentInfo.childComponents.join(', ')}`);
      }
    }
  }
  
  return relationships.join('\n');
}

/**
 * Get file content for selected files
 */
export async function getFileContents(
  files,
  manifest
) {
  const contents = {};
  
  for (const file of files) {
    const fileInfo = manifest.files[file];
    if (fileInfo) {
      contents[file] = fileInfo.content;
    }
  }
  
  return contents;
}

/**
 * Format files for AI context
 */
export function formatFilesForAI(
  primaryFiles,
  contextFiles
) {
  const sections = [];
  
  // Add primary files
  sections.push('## Files to Edit (ONLY OUTPUT THESE FILES)\n');
  sections.push('🚨 You MUST ONLY generate the files listed below. Do NOT generate any other files! 🚨\n');
  sections.push('⚠️ CRITICAL: Return the COMPLETE file - NEVER truncate with "..." or skip any lines! ⚠️\n');
  sections.push('The file MUST include ALL imports, ALL functions, ALL JSX, and ALL closing tags.\n');
  sections.push('MUST follow the UI Design Principles exactly for any modifications.\n\n');
  for (const [path, content] of Object.entries(primaryFiles)) {
    sections.push(`### ${path}
**IMPORTANT: This is the COMPLETE file. Your output must include EVERY line shown below, modified only where necessary.**
\`\`\`${getFileExtension(path)}
${content}
\`\`\`
`);
  }
  
  // Add context files if any - but truncate large files
  if (Object.keys(contextFiles).length > 0) {
    sections.push('\n## Context Files (Reference Only - Do Not Edit)\n');
    for (const [path, content] of Object.entries(contextFiles)) {
      // Truncate very large context files to save tokens
      let truncatedContent = content;
      if (content.length > 2000) {
        truncatedContent = content.substring(0, 2000) + '\n// ... [truncated for context length]';
      }
      
      sections.push(`### ${path}
\`\`\`${getFileExtension(path)}
${truncatedContent}
\`\`\`
`);
    }
  }
  
  return sections.join('\n');
}

/**
 * Get file extension for syntax highlighting
 */
function getFileExtension(path) {
  const ext = path.split('.').pop() || '';
  const mapping = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'css': 'css',
    'json': 'json',
  };
  return mapping[ext] || ext;
}