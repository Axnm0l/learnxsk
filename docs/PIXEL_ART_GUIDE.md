# LearnXSK Pixel Art Guide

**Version:** 1.0 (Prompt 1 — Bootstrap)  
**Last Updated:** 2026-10-11  
**Owner:** Freebuff (Agent B)

## 1. Visual Direction Overview

LearnXSK uses a Minecraft-inspired, pixelated isometric visual style. The world should feel like a block-built environment where players can explore, discover, and learn. All art must be original — no Minecraft assets, textures, or logos.

## 2. Art Style Principles

### 2.1 Pixel Art Fundamentals

- **Fixed resolution:** Design at a consistent base resolution (e.g., 32x32 or 64x64 pixels per tile)
- **Limited palette:** Use a cohesive color palette for each asset group
- **Clean edges:** Avoid anti-aliasing on pixel art sprites
- **Readable silhouettes:** Each object should be identifiable by its shape alone

### 2.2 Isometric Projection

- Use 2:1 pixel ratio for isometric tiles (classic isometric look)
- Tiles appear as diamonds when viewed from above
- Stack blocks to create height and depth
- Consistent lighting direction (top-left or top-right)

### 2.3 Depth and Lighting

- **Highlight:** Top faces receive the most light
- **Shadow:** Bottom and side faces are darker
- **Occlusion:** Objects in front partially block objects behind
- **Ambient occlusion:** Darken corners where blocks meet

## 3. Tile Specifications

### 3.1 Ground Tiles

| Property | Value |
|----------|-------|
| Base size | 64x32 pixels (isometric diamond) |
| Variants | Grass, stone, dirt, metal floor, terminal grid |
| Collision | Solid (player walks on top) |

### 3.2 Block Types

| Block | Suggested Colors | Use Case |
|-------|------------------|----------|
| Grass block | Green top, brown sides | Outdoor areas |
| Stone block | Gray gradient | Dungeons, caves |
| Metal panel | Silver/blue tint | Tech areas, labs |
| Terminal block | Dark with green accents | Mission boards, computers |
| Wood plank | Brown with grain | Buildings, bridges |

### 3.3 Block Stacking

- Each block layer adds height (e.g., 16 pixels per layer)
- Top face: lightest shade
- Left face: medium shade
- Right face: darkest shade
- Consistent light source across all assets

## 4. UI Elements

### 4.1 Panel Style

- Dark background with pixelated border
- Slightly lighter inner area
- Clear separation from game world
- Readable at 1920x1080 resolution

### 4.2 Buttons

- Normal state: dark with subtle border
- Hover state: brighter border or background shift
- Selected/active state: distinct highlight color
- Pixel-perfect edges, no blur

### 4.3 Text

- Pixel font for all in-game text
- Monospace for terminal feel
- High contrast (light text on dark background)
- Minimum readable size at target resolution

## 5. Learning Path Objects

Each learning path should be represented by a visually distinct mission board or interactive object.

### 5.1 Linux Basics

- **Visual:** Terminal-style board with green text on black
- **Icon:** Command prompt symbol ($)
- **Colors:** Dark background, bright green accents

### 5.2 Filesystem Explorer

- **Visual:** File cabinet or directory tree board
- **Icon:** Folder or file structure
- **Colors:** Brown/wood tones with folder-icon details

### 5.3 Process Detective

- **Visual:** Monitor or process-list board
- **Icon:** Running processes visualization
- **Colors:** Screen-green on dark, activity indicators

### 5.4 Network Recon

- **Visual:** Network map or node board
- **Icon:** Connected nodes or network topology
- **Colors:** Blue/cyan tones, connection lines

### 5.5 Scripting Lab

- **Visual:** Code editor or script board
- **Icon:** Script file or code brackets
- **Colors:** Dark with syntax-highlighted accents

## 6. Placeholder Art Guidelines

Until final art is ready, use placeholder pixel art that:

1. **Serves the layout:** Shows where objects go and their relative sizes
2. **Distinguishes paths:** Each learning path looks different
3. **Communicates function:** Players can guess what each path is about
4. **Looks intentional:** Even placeholders should follow the style guide

### 6.1 Placeholder Colors

Use a consistent placeholder palette:
- Primary: #444444 (dark gray)
- Secondary: #666666 (medium gray)
- Accent: #FFFFFF (white for outlines)
- Highlight: #00FFFF (cyan for selection)

### 6.2 Placeholder Shapes

- Mission boards: Rectangles with a distinctive top edge
- Interactive objects: Clear clickable area
- Selection indicator: Visible highlight overlay

## 7. Technical Implementation (For Antigravity)

### 7.1 Unity Setup

```csharp
// Pixel-perfect camera setup
// - Orthographic camera
// - Isometric angle (typically 30 degrees or 2:1 ratio)
// - Pixel perfect component if using 2D tilemap
```

### 7.2 Sprite Settings

- Filter Mode: Point (no filtering)
- Compression: None (keep crisp pixels)
- Pixels Per Unit: Match your art resolution (e.g., 16 or 32)

### 7.3 Tilemap Setup

- Use Unity 2D Isometric Tilemap
- Configure isometric renderer
- Layer tiles for depth (ground, objects, decorations)

## 8. Do Not Use

- Minecraft textures or assets (copyrighted)
- Minecraft logo or branding
- Smooth-shaded 3D renders pretending to be pixel art
- Anti-aliased sprites (defeats pixel art purpose)
- Generic stock icons without pixel art treatment

## 9. Quality Checklist

- [ ] All sprites use point filtering
- [ ] Consistent pixel resolution across assets
- [ ] Isometric projection is consistent
- [ ] Lighting direction is uniform
- [ ] Colors fit within palette
- [ ] UI is readable at 1920x1080
- [ ] Selection states are clearly visible
- [ ] Each learning path is visually distinct
- [ ] Placeholders look intentional, not sloppy
