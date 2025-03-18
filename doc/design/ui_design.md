# UI/UX Design Specification
## Version 1.0

### 1. Design System

#### 1.1 Color Palette
```scss
// Primary Colors
$primary: #000000;
$secondary: #FFFFFF;
$accent: #666666;

// Neutral Colors
$background: #000000;
$card: #1A1A1A;
$border: #333333;

// Text Colors
$text-primary: #FFFFFF;
$text-secondary: #CCCCCC;
$text-tertiary: #888888;

// Status Colors
$success: #FFFFFF;
$warning: #CCCCCC;
$error: #FF0000;
$info: #888888;
```

#### 1.2 Typography
```scss
// Font Families
$font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto;
$font-secondary: "SF Pro Display", "Helvetica Neue";
$font-monospace: "SF Mono", "Courier New";

// Font Sizes
$font-size: (
  xs: 12px,
  s: 14px,
  m: 16px,
  l: 18px,
  xl: 24px,
  xxl: 32px
);

// Font Weights
$font-weight: (
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700
);
```

#### 1.3 Spacing System
```scss
// Spacing Scale
$spacing: (
  xs: 4px,
  s: 8px,
  m: 16px,
  l: 24px,
  xl: 32px,
  xxl: 48px
);

// Layout
$layout: (
  border-radius: (
    s: 4px,
    m: 8px,
    l: 16px,
    xl: 24px
  ),
  container: (
    s: 600px,
    m: 960px,
    l: 1200px
  )
);
```

### 2. Component Library

#### 2.1 Core Components
```jsx
// Button Component
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline';
  size: 'small' | 'medium' | 'large';
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
}

// Input Component
interface InputProps {
  type: 'text' | 'number' | 'password';
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

// Card Component
interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}
```

#### 2.2 Custom Components
```jsx
// Timer Display
interface TimerDisplayProps {
  duration: number;
  progress: number;
  isActive: boolean;
}

// Sound Theme Selector
interface SoundThemeSelectorProps {
  themes: SoundTheme[];
  selectedTheme: string;
  onSelect: (theme: string) => void;
}

// Progress Circle
interface ProgressCircleProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}
```

### 3. Screen Designs

#### 3.1 Meditation Screen
```jsx
// Screen Layout
const MeditationScreen = {
  header: {
    title: "MEDITATION",
    leftButton: "back",
    rightButton: "settings"
  },
  content: {
    timer: {
      size: TIMER_SIZE,
      animation: "breathe"
    },
    controls: {
      position: "bottom",
      layout: "horizontal"
    }
  }
};

// Animation Specifications
const breatheAnimation = {
  duration: 8000,
  easing: Easing.inOut(Easing.sin),
  scale: [1, 1.05]
};
```

#### 3.2 Task Screen
```jsx
// Screen Layout
const TaskScreen = {
  header: {
    title: "TASKS",
    rightButton: "add"
  },
  content: {
    list: {
      style: "grouped",
      separatorStyle: "line"
    },
    emptyState: {
      icon: "task",
      message: "No tasks yet"
    }
  }
};

// Task Item Layout
const TaskItem = {
  layout: "horizontal",
  leading: "checkbox",
  trailing: "disclosure",
  swipeActions: ["complete", "delete"]
};
```

#### 3.3 Journal Screen
```jsx
// Screen Layout
const JournalScreen = {
  header: {
    title: "JOURNAL",
    rightButton: "new"
  },
  content: {
    list: {
      style: "timeline",
      groupBy: "date"
    },
    editor: {
      toolbar: ["bold", "italic", "bullet"],
      placeholder: "Write your thoughts..."
    }
  }
};
```

### 4. Navigation Flow

#### 4.1 Tab Navigation
```jsx
const TabNavigation = {
  tabs: [
    {
      name: "Meditation",
      icon: "mindfulness",
      screen: MeditationScreen
    },
    {
      name: "Tasks",
      icon: "task",
      screen: TaskScreen
    },
    {
      name: "Journal",
      icon: "book",
      screen: JournalScreen
    }
  ],
  style: {
    position: "bottom",
    height: 60,
    background: "$background"
  }
};
```

#### 4.2 Stack Navigation
```jsx
const StackNavigation = {
  screens: [
    {
      name: "Home",
      component: TabNavigation
    },
    {
      name: "Settings",
      component: SettingsScreen
    },
    {
      name: "TaskDetail",
      component: TaskDetailScreen
    },
    {
      name: "JournalEntry",
      component: JournalEntryScreen
    }
  ],
  options: {
    headerShown: false,
    animation: "slide_from_right"
  }
};
```

### 5. Interaction Patterns

#### 5.1 Gestures
```typescript
const GesturePatterns = {
  swipe: {
    task: {
      left: ["complete"],
      right: ["delete"]
    },
    journal: {
      left: ["archive"],
      right: ["delete"]
    }
  },
  longPress: {
    task: ["show_menu"],
    journal: ["show_options"]
  }
};
```

#### 5.2 Animations
```typescript
const AnimationPatterns = {
  transition: {
    duration: 300,
    easing: Easing.inOut(Easing.ease)
  },
  feedback: {
    duration: 100,
    scale: 0.95
  },
  progress: {
    duration: 1000,
    easing: Easing.linear
  }
};
```

### 6. Accessibility

#### 6.1 Guidelines
```typescript
const AccessibilityGuidelines = {
  minimumTapArea: {
    width: 44,
    height: 44
  },
  textContrast: {
    minimum: 4.5,
    recommended: 7
  },
  animations: {
    reduceMotion: true,
    duration: "user-preference"
  }
};
```

#### 6.2 Implementation
```jsx
// Accessible Component Example
const AccessibleButton = {
  role: "button",
  label: "descriptive label",
  hints: ["double tap to activate"],
  traits: ["button"],
  actions: {
    activate: () => {}
  }
};
```

### 7. Responsive Design

#### 7.1 Breakpoints
```scss
$breakpoints: (
  small: 320px,
  medium: 768px,
  large: 1024px,
  xlarge: 1280px
);
```

#### 7.2 Layout Grids
```scss
$grid: (
  columns: (
    small: 4,
    medium: 8,
    large: 12
  ),
  gutter: (
    small: 16px,
    medium: 24px,
    large: 32px
  )
);
```

### 8. Dark Mode Support

#### 8.1 Color Mapping
```scss
$colors-dark: (
  background: #000000,
  card: #1A1A1A,
  text-primary: #FFFFFF,
  text-secondary: #CCCCCC
);

$colors-light: (
  background: #FFFFFF,
  card: #F5F5F5,
  text-primary: #000000,
  text-secondary: #666666
);
```

#### 8.2 Implementation
```typescript
const ThemeProvider = {
  dark: {
    colors: colorsDark,
    styles: stylesDark
  },
  light: {
    colors: colorsLight,
    styles: stylesLight
  }
};
```

### 9. Design Assets

#### 9.1 Icon System
```typescript
const IconSystem = {
  type: "SVG",
  sizes: [16, 24, 32],
  weights: ["regular", "filled"],
  color: "currentColor"
};
```

#### 9.2 Image Assets
```typescript
const ImageAssets = {
  format: "PNG",
  scales: ["@1x", "@2x", "@3x"],
  directory: "/assets/images"
};
```
