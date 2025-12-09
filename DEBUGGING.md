# Debugging Guide - Face Detection Performance

## Common Issues

### 1. "Processing your photo..." Takes Too Long

**Symptoms:**
- Upload seems stuck on "Processing your photo..."
- Browser becomes unresponsive
- Takes more than 10-15 seconds

**Causes & Solutions:**

#### Large Image Size
**Problem:** High-resolution images (> 2MB or > 2000x2000px) take longer to process.

**Solution:**
- Resize image before uploading (recommended: max 1280x720)
- Use your phone's camera in "standard" quality, not "high quality"
- Compress images before uploading

#### CPU-Intensive Face Detection
**Problem:** Face detection runs on CPU (in browser), which can be slow on older devices.

**Solutions:**
1. **Use smaller detection input size** (already optimized in code)
2. **Try a different photo** - simpler backgrounds process faster
3. **Close other browser tabs** to free up CPU

#### Browser Console Debugging

Open browser console (F12 or Cmd+Opt+I) and check for:

**Models Loading:**
```
Face detection models loaded ✓
```

**Common Errors:**
```javascript
// Model failed to load
Error: Failed to fetch model from /models/...

// No face detected
No face detected in the image

// WebGL issues (rare)
WebGL context lost
```

### 2. "No face detected" Error

**Causes:**
- Face is too small in the photo
- Poor lighting
- Face obscured (sunglasses, mask, hat)
- Side profile instead of front-facing
- Multiple faces in photo

**Solutions:**
- Use a clear, well-lit, front-facing photo
- Face should take up at least 30% of the image
- Remove sunglasses/masks
- Ensure face is the main subject

### 3. Socket Connection Issues

**Symptoms:**
- Can't create/join session
- "Connection failed" errors

**Debug Steps:**
```bash
# Check backend is running
curl http://localhost:5001/health

# Check frontend can reach backend
# Open browser console, look for WebSocket errors
```

**Common Fixes:**
- Restart Docker containers: `docker-compose restart`
- Check firewall isn't blocking ports 3000/5001
- Clear browser cache and reload

### 4. Session Not Found

**Causes:**
- Session expired (10 minutes timeout)
- Backend restarted
- Wrong session ID

**Solutions:**
- Create a new session
- Share link immediately after creation
- Check Session ID is correct (8 characters, uppercase)

## Performance Optimization Tips

### For Users

1. **Image Preparation:**
   - Optimal size: 640x480 to 1280x720
   - File size: < 500KB
   - Format: JPG (faster than PNG)
   - Use built-in phone camera, not high-res DSLR

2. **Browser:**
   - Use Chrome or Edge (fastest WebGL performance)
   - Close unnecessary tabs
   - Disable browser extensions for testing

3. **Network:**
   - Ensure stable internet connection
   - Models are ~7MB total (one-time download per session)

### For Developers

1. **Reduce Detection Input Size:**
```javascript
// In App.tsx, use smaller input size
const detection = await faceapi
  .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
    inputSize: 224  // Try 160 or 128 for faster detection
  }))
```

2. **Add Image Resizing:**
```javascript
// Before detection, resize large images
const maxDimension = 1280;
if (img.width > maxDimension || img.height > maxDimension) {
  // Resize logic here
}
```

3. **Add Progress Indicator:**
```javascript
setProcessing(true);
setStatus('Loading models...');
// Load models
setStatus('Detecting face...');
// Detect face
setStatus('Uploading...');
// Upload
```

## Monitoring & Logs

### Browser Console
```javascript
// Enable detailed logging
localStorage.setItem('debug', 'face-api');

// Check model loading
console.log(faceapi.nets.tinyFaceDetector.isLoaded);

// Measure detection time
console.time('faceDetection');
const detection = await faceapi.detectSingleFace(...);
console.timeEnd('faceDetection');
```

### Backend Logs
```bash
# Watch real-time logs
docker-compose logs -f backend

# Check for errors
docker-compose logs backend | grep -i error

# View session count
curl http://localhost:5001/health
```

### Frontend Logs
```bash
# Check nginx access logs
docker-compose logs frontend | tail -50

# Watch for 404s or 500s
docker-compose logs frontend | grep " 404 \| 500 "
```

## Quick Fixes Checklist

- [ ] Image is well-lit and face is clear
- [ ] Image size < 2MB, dimensions < 1920x1080
- [ ] Browser console shows "Face detection models loaded"
- [ ] No errors in browser console Network tab
- [ ] Backend health check returns `{"status":"ok"}`
- [ ] Tried in incognito/private browsing mode
- [ ] Tried a different browser
- [ ] Containers are running: `docker-compose ps`

## Advanced Debugging

### Enable Verbose Logging

Add to `App.tsx`:
```typescript
useEffect(() => {
  console.log('App mounted');
  console.log('Socket:', socket?.connected);
  console.log('Models loaded:', modelsLoaded);
}, [socket, modelsLoaded]);
```

### Profile Performance

```javascript
// In browser console
performance.mark('start-detection');
// ... run detection ...
performance.mark('end-detection');
performance.measure('detection-time', 'start-detection', 'end-detection');
console.log(performance.getEntriesByName('detection-time'));
```

### Test Model Loading Separately

```javascript
// In browser console on localhost:3000
fetch('/models/tiny_face_detector_model-weights_manifest.json')
  .then(r => r.json())
  .then(data => console.log('Model manifest:', data))
  .catch(err => console.error('Failed to load model:', err));
```

## Known Limitations

1. **CPU-bound processing** - Face detection happens in browser on CPU
2. **Large images** - Takes 5-10 seconds for 4K photos
3. **Mobile devices** - Older phones may struggle with large images
4. **Memory** - Multiple detection attempts can consume memory

## Getting Help

If issue persists:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Copy all errors (red text)
4. Check Network tab for failed requests
5. Run `docker-compose logs` and save output
6. Share these logs for debugging
