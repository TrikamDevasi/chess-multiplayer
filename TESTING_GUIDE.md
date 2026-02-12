# Manual Testing Guide

## Quick Verification (5 minutes)

### Step 1: Open the Application
1. Ensure server is running: `node server.js`
2. Open browser: **http://localhost:3000**
3. **Check Console** (F12): Should have NO red errors

### Step 2: Test Bot Mode  
1. Enter name: "TestPlayer"
2. Click **"vs Bot"** button
3. Select **"Easy"** difficulty
4. Click **"Create Room"**

**Expected Result:**
- Chess board appears with all pieces
- Pieces are SVG images (not Unicode text)
- Board is centered and looks professional

### Step 3: Make a Move
1. Click on white pawn (e2)
2. Should see legal move dots
3. Click e4 (two squares forward)
4. Bot should respond after 0.5 seconds

### Step 4: Test Multiplayer (Optional)
1. Open two browser tabs
2. **Tab 1**: Create Room → Copy Room ID
3. **Tab 2**: Join Room → Paste Room ID → Join
4. Make moves in both tabs

## Common Issues & Fixes

### Issue: "Uncaught SyntaxError: Cannot use import statement outside a module"
**Fix:** Ensure `index.html` has:
```html
<script type="module" src="game.js" defer></script>
```

### Issue: Pieces not showing
**Fix:** Check browser console for SVG data URI errors. SVGs are embedded in CSS.

### Issue: Board not centered
**Fix:** Refresh page. CSS should handle centering.

### Issue: "io is not defined"
**Fix:** Ensure script order in HTML:
```html
<script src="/socket.io/socket.io.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js" defer></script>
<script type="module" src="game.js" defer></script>
```

## Lighthouse Audit Steps

1. Open Chrome DevTools (F12)
2. Go to **Lighthouse** tab
3. Select categories: ✅ Performance, ✅ Accessibility, ✅ Best Practices, ✅ SEO
4. Select **Mobile** or **Desktop**
5. Click **"Analyze page load"**
6. Wait for results

**Target Scores:**
- Performance: 95-100
- Accessibility: 100
- Best Practices: 95-100
- SEO: 100

## Deployment Checklist

### Before Deployment:
- [ ] Run Lighthouse audit (aim for 95+ on all)
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile devices
- [ ] Verify no console errors
- [ ] Test multiplayer with PIN protection

### Server Setup (Production):
```javascript
// Add to server.js for production
app.use(compression()); // Enable gzip
app.use(helmet()); // Security headers
```

### Environment Variables:
```env
NODE_ENV=production
PORT=3000
```

## Performance Checklist

✅ **Done:**
- ES6 modules for code splitting
- Deferred script loading
- Event delegation
- Input sanitization
- ARIA labels
- SEO meta tags
- Responsive design

🔄 **Optional (Future):**
- Service Worker for offline mode
- Minify CSS/JS for production
- CDN for static assets
- Redis for session management
