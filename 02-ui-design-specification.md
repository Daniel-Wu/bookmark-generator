# User Interface Design Specification

## Layout Architecture

### Desktop Layout (1200px+)

```
┌─────────────────────────────────────────────────────────────┐
│                    Header (60px)                            │
│  📖 Bookmark Generator    [Help] [About] [GitHub]           │
├─────────────────┬───────────────────────────────────────────┤
│                 │                                           │
│  Control Panel  │           3D Preview Area                 │
│    (300px)      │             (flexible)                    │
│                 │                                           │
│  [Image Upload] │  ┌─────────────────────────────────────┐  │
│  [Parameters]   │  │                                     │  │
│  [Export]       │  │         3D Bookmark                 │  │
│                 │  │         Rendering                   │  │
│                 │  │                                     │  │
│                 │  └─────────────────────────────────────┘  │
│                 │                                           │
│                 │  [🔄 Rotate] [🔍 Zoom] [⚙️ Layers]         │
└─────────────────┴───────────────────────────────────────────┘
```

### Mobile Layout (< 768px)

```
┌─────────────────────────────────┐
│          Header (50px)          │
├─────────────────────────────────┤
│                                 │
│        Tab Navigation           │
│  [Upload] [Params] [Preview]    │
├─────────────────────────────────┤
│                                 │
│         Active Tab              │
│         Content                 │
│                                 │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘
```

## Visual Design System

### Color Palette
- **Primary**: #2563eb (Blue 600)
- **Secondary**: #64748b (Slate 500)
- **Success**: #059669 (Emerald 600)
- **Warning**: #d97706 (Amber 600)
- **Error**: #dc2626 (Red 600)
- **Background**: #f8fafc (Slate 50)
- **Surface**: #ffffff (White)

### Typography
- **Headings**: Inter, 600 weight
- **Body**: Inter, 400 weight
- **Code/Technical**: JetBrains Mono, 400 weight

### Components Style
- **Border radius**: 8px for cards, 6px for buttons
- **Shadows**: Subtle drop shadows with shadow-lg for cards
- **Buttons**: Solid primary, outline secondary, ghost tertiary
- **Form inputs**: Clean borders, focus rings, proper spacing

## Detailed UI Components

### 1. Image Upload Panel

```
┌─────────────────────────────────────────┐
│              Upload Image               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │        📁 Drag & Drop               │ │
│  │       or click to browse            │ │
│  │                                     │ │
│  │     Supports: PNG, JPG, GIF         │ │
│  │     Max size: 10MB                  │ │
│  │                                     │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  OR                                     │
│                                         │
│  📋 [Paste from Clipboard]              │
│                                         │
└─────────────────────────────────────────┘
```

#### After Image Upload

```
┌─────────────────────────────────────────┐
│           Adjust Image Crop             │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │     ┌─────────────────────┐         │ │
│  │     │                     │         │ │
│  │     │    [Cropped Area]   │         │ │
│  │     │                     │         │ │
│  │     └─────────────────────┘         │ │
│  │              📷                     │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  Position: [🔄 Reset] [↻ Rotate 90°]    │
│  Scale: [━━━●━━━] 75%                    │
│                                         │
│  ✅ [Apply Crop]                        │
└─────────────────────────────────────────┘
```

### 2. Parameters Panel

```
┌─────────────────────────────────────────┐
│            Bookmark Settings            │
├─────────────────────────────────────────┤
│                                         │
│  Colors: [2] [3] [●4] [5] [6] [7] [8]   │
│                                         │
│  Dimensions                             │
│  Width:  [━━●━━━━━] 50mm                 │
│  Height: [━━━━●━━━] 150mm                │
│  📎 Lock Aspect Ratio ✓                 │
│                                         │
│  Layer Settings                         │
│  Base Thickness:  [━●━━━━━] 2.0mm        │
│  Layer Height:    [━━●━━━━] 0.2mm        │
│                                         │
│  Style                                  │
│  Corner Radius:   [●━━━━━━] 3mm          │
│                                         │
│  ┌─ Color Preview ─────────────────────┐ │
│  │ ████ ████ ████ ████                │ │
│  │ Layer Layer Layer Layer             │ │
│  │   1     2     3     4               │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  💾 [Save Preset] 📁 [Load Preset]      │
└─────────────────────────────────────────┘
```

### 3. 3D Preview Area

```
┌─────────────────────────────────────────────────────────────┐
│                    3D Preview                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │                                                     │    │
│  │                 🔖                                  │    │
│  │              3D Bookmark                            │    │
│  │             (Interactive)                           │    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Controls:                                                  │
│  [🔄 Rotate] [🔍 Zoom Fit] [📐 Wireframe] [🌟 Lighting]     │
│                                                             │
│  Layer Visibility:                                          │
│  ☑ Base   ☑ Layer 1   ☑ Layer 2   ☑ Layer 3               │
│                                                             │
│  📊 Stats: 2,847 triangles | 1.2MB estimated file size     │
└─────────────────────────────────────────────────────────────┘
```

### 4. Export Panel

```
┌─────────────────────────────────────────┐
│              Export Model               │
├─────────────────────────────────────────┤
│                                         │
│  File Format:                           │
│  ● STL (Universal, single color)        │
│  ○ 3MF (Multi-color, modern printers)   │
│                                         │
│  Print Settings Preview:                │
│  • Estimated print time: 2h 15m         │
│  • Material usage: 12g PLA              │
│  • Support required: No                 │
│                                         │
│  Quality Check:                         │
│  ✅ Manifold geometry                   │
│  ✅ Printable overhangs                 │
│  ✅ Minimum wall thickness met          │
│                                         │
│  📥 [Download STL] 📥 [Download 3MF]     │
│                                         │
│  Share:                                 │
│  🔗 [Copy Link] 📱 [QR Code]            │
└─────────────────────────────────────────┘
```

## Interactive Elements

### Progress Indicators

```
Processing Image...
[████████████░░░░░░░░] 60%
Quantizing colors...
```

### Error States

```
┌─────────────────────────────────────────┐
│  ⚠️ Image Too Large                     │
│                                         │
│  The uploaded image is 15MB, but the    │
│  maximum size is 10MB.                  │
│                                         │
│  💡 Try compressing your image or       │
│     cropping to a smaller area.         │
│                                         │
│  [📐 Auto-resize] [❌ Dismiss]           │
└─────────────────────────────────────────┘
```

### Loading States

```
┌─────────────────────────────────────────┐
│  🔄 Generating 3D Model...               │
│                                         │
│  [████████████████████] 100%            │
│                                         │
│  Creating layer 4 of 4...               │
└─────────────────────────────────────────┘
```

## Responsive Behavior

### Desktop Experience (1200px+)
- Split-screen layout with controls on left, preview on right
- All controls visible simultaneously
- Hover states and tooltips for enhanced discoverability
- Keyboard shortcuts for power users

### Tablet Experience (768px - 1199px)
- Stacked layout with collapsible panels
- Touch-optimized controls (larger targets)
- Swipe gestures for 3D preview manipulation
- Simplified parameter controls

### Mobile Experience (< 768px)
- Tab-based navigation between major sections
- Single-column layout with vertical stacking
- Thumb-friendly touch targets
- Reduced parameter options for simplicity

## Accessibility Considerations

### Keyboard Navigation
- Tab order follows logical flow: Upload → Parameters → Preview → Export
- Arrow key navigation within parameter groups
- Space/Enter for buttons, arrows for sliders
- Escape to close modals/dropdowns

### Screen Reader Support
- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- Live regions for dynamic content updates
- Alt text for all images and icons

### Visual Accessibility
- High contrast mode support
- Scalable text (up to 200% zoom)
- Color-blind friendly palette
- Focus indicators on all interactive elements