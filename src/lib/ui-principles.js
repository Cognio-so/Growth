// Updated UI principles based on the provided guidelines
export const UI_DESIGN_PRINCIPLES = {
  layout: {
    grid: "Use a simple 12-column grid system to keep things neat and balanced",
    alignment: "Keep elements aligned and organized like a clean desk - everything lines up nicely, no matter the screen size",
    spacing: "Use consistent spacing scale (multiples of 4px or 8px: 8px, 16px, 24px, 64px, 96px)"
  },
  typography: {
    fonts: "Pick 1-2 font families maximum (one for headlines, one for body text)",
    fontChoices: "Stick to 1-2 font families with up to 3 weights (regular, bold, light)",
    readability: "Go for at least 16px for body text - bump it up a bit on mobile (16-18px minimum)",
    lineHeight: "Space lines out at 1.4-1.6 times the font size - gives text room to breathe",
    letterSpacing: "Keep normal text tight (~0em), but for all-caps headings, add a tiny bit (0.05-0.1em)",
    alignment: "Left-align body text for smooth reading; center short bits like titles or quotes",
    contrast: "Make sure text pops against the background - dark text on light or vice versa",
    hierarchy: "Play with size, weight, and spacing to guide the eye - big bold titles and smaller body text"
  },
  colors: {
    rule: "60-30-10 rule: 60% neutral, 30% main color, 10% accent",
    primary: "Your brand's main vibe - bold buttons, links, or highlights that scream 'this is us!'",
    secondary: "The sidekick to your primary color, perfect for subtle accents. Sprinkle it lightly",
    background: "Keep it chill with neutral tones like light gray, white, or dark gray for a clean look",
    text: "Make sure it stands out sharp against the background",
    accent: "A fun pop for alerts, badges, or special touches. Go bold but don't overdo it",
    states: "Green for 'Yay, it worked!', red for 'Oops, error!', yellow for warnings"
  },
  spacing: {
    scale: "Stick to multiples of 4px or 8px (like 8, 16, 24px) - keeps everything tidy",
    groups: "Keep things that belong together close, with tight gaps (8-16px)",
    sections: "Give big sections breathing room with wider gaps (64-96px)",
    text: "Use enough line height and paragraph spacing so text doesn't feel cramped",
    buttons: "Leave room around your CTAs - makes them stand out and easier to click",
    principle: "More space means less clutter, helping users focus and enjoy the experience"
  },
  hierarchy: {
    visual: "Guide people's eyes naturally: big, bold stuff grabs attention first, then smaller details",
    importance: "Use size, color, and placement to highlight what matters most"
  },
  navigation: {
    simplicity: "Keep it simple and consistent with familiar navigation patterns",
    limits: "Stick to 5-7 main items and group related links logically",
    visibility: "Highlight the current page or section",
    responsive: "Work seamlessly across devices, be keyboard-friendly, and support screen readers",
    search: "Include a prominent search bar for content-rich websites"
  },
  buttons: {
    visibility: "Use bold, contrasting colors and subtle shadows to stand out",
    labels: "Clear, action-oriented labels like 'Sign Up' or 'Shop Now'",
    sizing: "Aim for 44x44px minimum (mobile-friendly) with 8-16px padding",
    feedback: "Include hover effects or quick animations (200-300ms)",
    accessibility: "Ensure high contrast (4.5:1) and keyboard-friendly focus states"
  },
  icons: {
    consistency: "Use consistent stroke width, corner radius, and perspective",
    grid: "Maintain uniform icon grid (24x24px or 32x32px)",
    alignment: "Align icons to text baselines when inline with labels",
    quality: "Use crisp vector icons (SVGs)"
  },
  motion: {
    purpose: "Animations should be purposeful, consistent, and timed appropriately (200ms to 500ms)",
    easing: "Use natural easing functions for fluid transitions",
    subtlety: "Keep animations subtle to avoid overwhelming users",
    accessibility: "Respect motion preferences for accessibility",
    performance: "Use efficient properties like transform and opacity"
  },
  forms: {
    styling: "Clear input field styling (normal, focused, error, success)",
    spacing: "Consistent spacing and label placements",
    validation: "Clear error messages and validation patterns"
  },
  consistency: {
    reuse: "Reuse colors, fonts, and button styles everywhere",
    trust: "Builds trust and feels familiar",
    guide: "Use a style guide to keep things on track"
  },
  feedback: {
    interactions: "Add hover effects or loading animations to show users what's happening",
    reassurance: "Think 'Message Sent!' pop-ups or buttons that glow when clicked"
  },
  responsiveness: {
    approach: "Start designing for phones first, then scale up (mobile-first)",
    breakpoints: "Use breakpoints (768px, 1024px) to tweak layouts",
    universal: "Make sure everything looks great and works smoothly on all screens"
  }
};

export function getUIPrinciplesPrompt() {
  return `
## UI/UX DESIGN PRINCIPLES - FOLLOW THESE GUIDELINES STRICTLY

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
- Accent Color: A fun pop for alerts, badges, or special touches. Go bold but don't overdo it - like hot sauce, a little goes a long way
- State Colors: Green for "Yay, it worked!", red for "Oops, error!", yellow for warnings

### 4. Spacing & White Space
- Use a Spacing Scale: Stick to multiples of 4px or 8px (like 8, 16, 24px) - keeps everything tidy and consistent
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

## IMPLEMENTATION REQUIREMENTS

When creating React components:
1. **ALWAYS** use Tailwind CSS classes that follow these exact principles
2. **ALWAYS** implement mobile-first responsive design
3. **ALWAYS** use semantic HTML5 elements
4. **ALWAYS** ensure accessibility (ARIA labels, keyboard navigation)
5. **ALWAYS** follow the 60-30-10 color rule and spacing scale
6. **ALWAYS** create smooth animations and transitions (200-500ms)
7. **ALWAYS** maintain visual hierarchy and consistency
8. **ALWAYS** use the 12-column grid system approach
9. **ALWAYS** ensure 16-18px minimum text size
10. **ALWAYS** implement proper button sizing (44x44px minimum)

CRITICAL: Every component you create MUST follow these UI/UX principles exactly as specified. This is non-negotiable.
`;
}