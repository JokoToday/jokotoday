# Theme System Guide

This project now uses a global theme system that allows you to customize colors and fonts without AI regeneration.

## How to Change Theme Colors

All theme colors are controlled via CSS variables in `src/index.css`. Edit the `:root` section to customize your colors:

```css
:root {
  /* Primary color (currently amber/yellow tones) */
  --color-primary-50: 254 252 232;   /* Lightest shade */
  --color-primary-100: 254 243 199;
  --color-primary-200: 253 230 138;
  --color-primary-300: 252 211 77;
  --color-primary-400: 251 191 36;
  --color-primary-500: 245 158 11;
  --color-primary-600: 217 119 6;    /* Main brand color */
  --color-primary-700: 180 83 9;
  --color-primary-800: 146 64 14;
  --color-primary-900: 120 53 15;    /* Darkest shade */
  --color-primary-950: 69 26 3;

  /* Background colors */
  --color-background: 255 255 255;             /* Main background (white) */
  --color-background-secondary: 254 252 232;   /* Secondary background */

  /* Accent color */
  --color-accent: 239 68 68;  /* Used for badges, alerts (red) */

  /* Fonts */
  --font-header: 'Playfair Display', serif;  /* Used for headings */
  --font-body: 'Inter', sans-serif;          /* Used for body text */
}
```

## Color Usage in the App

- **primary-50 to primary-100**: Light backgrounds, hover states
- **primary-600 to primary-700**: Buttons, interactive elements, main brand color
- **primary-900**: Dark text, headings
- **background**: Main page background
- **background-secondary**: Alternative background sections
- **accent**: Error states, badges, notifications

## How to Change Colors

### Example 1: Change to Blue Theme

Replace the primary color values with blue tones:

```css
:root {
  --color-primary-50: 239 246 255;
  --color-primary-100: 219 234 254;
  --color-primary-200: 191 219 254;
  --color-primary-300: 147 197 253;
  --color-primary-400: 96 165 250;
  --color-primary-500: 59 130 246;
  --color-primary-600: 37 99 235;    /* Main brand color */
  --color-primary-700: 29 78 216;
  --color-primary-800: 30 64 175;
  --color-primary-900: 30 58 138;
  --color-primary-950: 23 37 84;
}
```

### Example 2: Change to Green Theme

```css
:root {
  --color-primary-50: 240 253 244;
  --color-primary-100: 220 252 231;
  --color-primary-200: 187 247 208;
  --color-primary-300: 134 239 172;
  --color-primary-400: 74 222 128;
  --color-primary-500: 34 197 94;
  --color-primary-600: 22 163 74;    /* Main brand color */
  --color-primary-700: 21 128 61;
  --color-primary-800: 22 101 52;
  --color-primary-900: 20 83 45;
  --color-primary-950: 5 46 22;
}
```

## How to Change Fonts

### Option 1: Use Google Fonts

1. Update the import in `src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&family=Montserrat:wght@700&display=swap');
```

2. Update the font variables:
```css
:root {
  --font-header: 'Montserrat', sans-serif;
  --font-body: 'Roboto', sans-serif;
}
```

### Option 2: Use System Fonts

```css
:root {
  --font-header: 'Georgia', serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

## Color Value Format

Colors use RGB values separated by spaces (not commas). This format works with Tailwind's opacity modifiers:

```css
/* Correct format */
--color-primary-600: 217 119 6;

/* This allows Tailwind to use it with opacity */
bg-primary-600/50  /* 50% opacity */
text-primary-900/80  /* 80% opacity */
```

## Finding Color Values

To convert hex colors to RGB format:
1. Use a color picker or converter tool
2. Convert hex (e.g., #D97706) to RGB (217, 119, 6)
3. Replace commas with spaces: `217 119 6`

Popular color palette generators:
- https://tailwindcolor.com/
- https://uicolors.app/create
- https://coolors.co/

## Testing Your Changes

After making changes to `src/index.css`:
1. Save the file
2. The dev server will automatically reload
3. Check all pages to ensure colors look good throughout the site
4. Pay special attention to text contrast for accessibility

## Need Help?

If you need to:
- Generate a complete color palette from a single color
- Ensure proper contrast ratios for accessibility
- Find the right shade values

Use an online tool like https://uicolors.app/create and input your desired main color.
