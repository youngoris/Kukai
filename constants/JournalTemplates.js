/**
 * JournalTemplates.js
 * Contains templates for journal entries
 */

// Default template (minimal structure)
export const DEFAULT_TEMPLATE = `# Today's Journal

_Write freely about your day..._

`;

// Gratitude template
export const GRATITUDE_TEMPLATE = `# Gratitude Journal

## Three things I'm grateful for today:
1. 
2. 
3. 

## One person I appreciate today:

## Something beautiful I noticed today:

`;

// Reflection template
export const REFLECTION_TEMPLATE = `# Daily Reflection

## What went well today?

## What could have gone better?

## What did I learn today?

## How am I feeling?

## One step I'll take tomorrow:

`;

// Achievement template
export const ACHIEVEMENT_TEMPLATE = `# Achievement Journal

## Today's wins (big or small):
- 

## Challenges I overcame:

## Progress on goals:
- [ ] Goal 1:
- [ ] Goal 2:
- [ ] Goal 3:

## What did I do to take care of myself today?

`;

// Morning template
export const MORNING_TEMPLATE = `# Morning Reflection

## I feel...

## Top 3 priorities for today:
1. 
2. 
3. 

## One thing that would make today great:

## Daily affirmation:

`;

// Evening template
export const EVENING_TEMPLATE = `# Evening Reflection

## Three good things that happened today:
1. 
2. 
3. 

## Something I could have done better:

## What I'm looking forward to tomorrow:

`;

// Detailed template with comprehensive sections
export const DETAILED_TEMPLATE = `# Daily Journal

## Morning
### How I feel starting the day:

### Today's top 3 priorities:
1. 
2. 
3. 

## Day Review
### Memorable moments:

### Challenges faced:

### Solutions found:

## Evening
### Accomplishments:

### Learnings:

### Gratitude:

### Tomorrow's focus:

`;

// Get template content by template ID
export const getTemplateContent = (templateId) => {
  switch (templateId) {
    case 'default':
      return DEFAULT_TEMPLATE;
    case 'gratitude':
      return GRATITUDE_TEMPLATE;
    case 'reflection':
      return REFLECTION_TEMPLATE;
    case 'achievement':
      return ACHIEVEMENT_TEMPLATE;
    case 'morning':
      return MORNING_TEMPLATE;
    case 'evening':
      return EVENING_TEMPLATE;
    case 'detailed':
      return DETAILED_TEMPLATE;
    default:
      return DEFAULT_TEMPLATE;
  }
};

// All available templates for selection
export const AVAILABLE_TEMPLATES = [
  { value: 'default', label: 'Default' },
  { value: 'gratitude', label: 'Gratitude' },
  { value: 'reflection', label: 'Reflection' },
  { value: 'achievement', label: 'Achievement' }, 
  { value: 'evening', label: 'Evening' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'custom', label: 'Custom' }
]; 