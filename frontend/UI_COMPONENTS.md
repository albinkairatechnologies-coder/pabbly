# 🎨 FlowChat UI Component Library

## Modern, Enhanced Design System

Your frontend has been upgraded with a comprehensive, modern design system featuring:

---

## 🎯 Design Principles

- **Modern & Clean**: Gradient backgrounds, smooth animations, glass morphism
- **Accessible**: WCAG compliant colors, keyboard navigation, screen reader support
- **Responsive**: Mobile-first design, works on all screen sizes
- **Performant**: Optimized animations, lazy loading, minimal re-renders
- **Consistent**: Unified spacing, typography, and color system

---

## 🎨 Color Palette

### Brand Colors
- `brand-50` to `brand-950` - Green gradient scale
- Primary: `#16a34a` (brand-600)
- Light: `#22c55e` (brand-500)
- Dark: `#15803d` (brand-700)

### Gray Scale
- `gray-50` to `gray-950` - Neutral colors
- Perfect for text, borders, backgrounds

### Semantic Colors
- Success: Green
- Error: Red
- Warning: Yellow
- Info: Blue

---

## 📦 Components

### 1. Button
**Enhanced with gradients, multiple variants, and sizes**

```tsx
import Button from './components/ui/Button';

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="danger">Danger</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="success">Success</Button>
<Button variant="outline">Outline</Button>

// Sizes
<Button size="xs">Extra Small</Button>
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With icons
<Button icon={<Plus size={16} />}>Add New</Button>

// Loading state
<Button loading>Processing...</Button>

// Full width
<Button fullWidth>Full Width Button</Button>
```

---

### 2. Input
**Enhanced with icons, better validation, and modern styling**

```tsx
import Input from './components/ui/Input';
import { Mail, Lock } from 'lucide-react';

// Basic
<Input label="Email" placeholder="Enter email" />

// With icons
<Input 
  label="Email" 
  leftIcon={<Mail size={16} />}
  placeholder="you@example.com"
/>

// With validation
<Input 
  label="Password"
  type="password"
  error="Password is required"
  rightIcon={<Lock size={16} />}
/>

// With helper text
<Input 
  label="Username"
  helper="Choose a unique username"
/>

// Required field
<Input label="Name" required />
```

---

### 3. Badge
**Multiple variants, sizes, with dots and icons**

```tsx
import Badge from './components/ui/Badge';
import { Check } from 'lucide-react';

// Variants
<Badge label="Active" color="green" variant="solid" />
<Badge label="Pending" color="yellow" variant="soft" />
<Badge label="Error" color="red" variant="outline" />

// With dot
<Badge label="Live" color="green" dot />

// With icon
<Badge label="Verified" color="blue" icon={<Check size={12} />} />

// Sizes
<Badge label="Small" size="sm" />
<Badge label="Medium" size="md" />
<Badge label="Large" size="lg" />
```

---

### 4. Card
**Modern card component with header and footer**

```tsx
import Card, { CardHeader, CardFooter } from './components/ui/Card';
import { Users } from 'lucide-react';

<Card hover padding="lg">
  <CardHeader 
    title="Team Members"
    subtitle="Manage your team"
    icon={<Users size={20} />}
    action={<Button size="sm">Add</Button>}
  />
  
  <div>Card content here...</div>
  
  <CardFooter>
    <Button variant="secondary">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

---

### 5. Modal
**Enhanced with animations and footer support**

```tsx
import Modal from './components/ui/Modal';

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  width="max-w-md"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

---

### 6. Toast
**Beautiful notifications**

```tsx
import Toast, { ToastContainer } from './components/ui/Toast';

// Single toast
<Toast 
  message="Successfully saved!" 
  type="success"
  onClose={() => {}}
/>

// Toast container (for multiple toasts)
<ToastContainer 
  toasts={toasts}
  removeToast={removeToast}
/>
```

---

### 7. Skeleton
**Loading states**

```tsx
import Skeleton, { SkeletonCard, SkeletonTable } from './components/ui/Skeleton';

// Basic
<Skeleton width="200px" height="20px" />

// Multiple lines
<Skeleton count={3} />

// Variants
<Skeleton variant="circular" width="48px" height="48px" />
<Skeleton variant="text" />
<Skeleton variant="rectangular" />

// Pre-built
<SkeletonCard />
<SkeletonTable rows={5} />
```

---

### 8. Tooltip
**Helpful hints**

```tsx
import Tooltip from './components/ui/Tooltip';

<Tooltip content="Click to edit" position="top">
  <Button>Edit</Button>
</Tooltip>
```

---

### 9. Dropdown
**Context menus and dropdowns**

```tsx
import Dropdown, { DropdownItem, DropdownDivider, DropdownHeader } from './components/ui/Dropdown';
import { Settings, LogOut } from 'lucide-react';

<Dropdown 
  trigger={<Button>Menu</Button>}
  align="right"
>
  <DropdownHeader label="Account" />
  <DropdownItem icon={<Settings size={16} />} label="Settings" onClick={() => {}} />
  <DropdownDivider />
  <DropdownItem icon={<LogOut size={16} />} label="Logout" onClick={() => {}} danger />
</Dropdown>
```

---

### 10. EmptyState
**Better empty states**

```tsx
import EmptyState from './components/ui/EmptyState';
import { Inbox } from 'lucide-react';

<EmptyState
  icon={<Inbox size={32} />}
  title="No messages yet"
  description="Start a conversation to see messages here"
  action={{
    label: "New Message",
    onClick: () => {},
    icon: <Plus size={16} />
  }}
  secondaryAction={{
    label: "Learn More",
    onClick: () => {}
  }}
/>
```

---

## 🎭 Utility Classes

### Text Gradients
```tsx
<h1 className="text-gradient">Gradient Text</h1>
<h1 className="text-gradient-blue">Blue Gradient</h1>
<h1 className="text-gradient-purple">Purple Gradient</h1>
```

### Glass Effect
```tsx
<div className="glass">Glass morphism</div>
<div className="glass-dark">Dark glass</div>
```

### Animations
```tsx
<div className="animate-fade-in">Fade in</div>
<div className="animate-fade-up">Fade up</div>
<div className="animate-scale-in">Scale in</div>
<div className="animate-shimmer">Shimmer effect</div>
```

### Glow Effects
```tsx
<div className="glow">Subtle glow</div>
<div className="glow-hover">Glow on hover</div>
```

---

## 🎨 CSS Classes

### Cards
```tsx
<div className="card">Basic card</div>
<div className="card-hover">Hoverable card</div>
<div className="glass-card">Glass card</div>
```

### Icons
```tsx
<div className="icon-container-brand">Brand icon</div>
<div className="icon-container-blue">Blue icon</div>
<div className="icon-container-purple">Purple icon</div>
```

### Buttons (CSS)
```tsx
<button className="btn-primary">Primary</button>
<button className="btn-secondary">Secondary</button>
<button className="btn-ghost">Ghost</button>
```

---

## 🌈 Animations

All components include smooth animations:
- Fade in/out
- Slide in/out
- Scale in/out
- Shimmer effects
- Pulse animations
- Ripple effects

---

## 📱 Responsive Design

All components are mobile-first and fully responsive:
- Touch-friendly tap targets
- Adaptive layouts
- Mobile-optimized modals
- Responsive typography

---

## ♿ Accessibility

- Keyboard navigation support
- ARIA labels and roles
- Focus indicators
- Screen reader friendly
- Color contrast compliant

---

## 🚀 Performance

- Optimized animations (GPU accelerated)
- Lazy loading support
- Minimal re-renders
- Tree-shakeable components
- Small bundle size

---

## 📖 Best Practices

1. **Use semantic HTML** - Proper heading hierarchy, buttons vs links
2. **Consistent spacing** - Use Tailwind spacing scale (4px increments)
3. **Color usage** - Use semantic colors (success, error, warning)
4. **Loading states** - Always show loading indicators
5. **Error handling** - Clear error messages with recovery actions
6. **Empty states** - Helpful empty states with actions
7. **Responsive** - Test on mobile, tablet, desktop

---

## 🎯 Examples

Check the Settings page for real-world examples of:
- Form layouts
- Card compositions
- Button groups
- Input validation
- Modal usage
- Badge usage

---

**Your UI is now modern, accessible, and production-ready! 🎉**
