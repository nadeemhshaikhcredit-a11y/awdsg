# 🔐 Face Compare App

A privacy-focused web application that allows two users to verify they are the same person through face comparison before viewing each other's photos.

## Features

✨ **Privacy First**
- No images stored on the server
- All photos destroyed after session
- In-memory session management only

🎯 **Face Recognition**
- Real-time face detection using face-api.js
- High-accuracy face comparison
- Clear match/no-match results

🔄 **Real-time Communication**
- Socket.io for instant updates
- Session-based pairing
- Live status updates

🔗 **Easy Sharing**
- One-click shareable links
- Auto-join via URL
- Copy link to clipboard

🎨 **Modern UI**
- Beautiful gradient design
- Responsive layout
- Smooth animations

## How It Works

1. **User 1** creates a session and receives:
   - A unique Session ID (e.g., "A3F7B2E1")
   - A shareable link (e.g., `http://localhost:3000?session=A3F7B2E1`)
2. **User 2** can either:
   - Click the shared link to auto-join, OR
   - Manually enter the Session ID
3. Both users upload a clear photo of their face
4. The app compares the faces:
   - ✅ **If matched**: Both users can see each other's photos
   - ❌ **If not matched**: Photos are destroyed immediately
5. Session ends and all data is deleted

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- face-api.js (face detection & recognition)
- Socket.io Client
- Modern CSS with gradients

**Backend:**
- Node.js + Express
- Socket.io (WebSockets)
- In-memory session storage
- Rate limiting for security

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup

1. **Clone and navigate to the project:**
```bash
cd face-compare-app
```

2. **Install root dependencies:**
```bash
npm install
```

3. **Install backend dependencies:**
```bash
cd backend
npm install
cd ..
```

4. **Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

5. **Verify models are downloaded:**
The face detection models should be in `frontend/public/models/`. If missing, they will be downloaded automatically on first run.

## Running the App

### Run Both Frontend and Backend Together:
```bash
npm start
```

This will start:
- Backend server on `http://localhost:5001`
- Frontend app on `http://localhost:3000`

### Run Separately:

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

## Usage

### Quick Start with Link Sharing (Recommended):
1. Open `http://localhost:3000` in your browser
2. **User 1**: Click "Create New Session"
3. **User 1**: Click "📋 Copy" button to copy the shareable link
4. **User 1**: Send the link to User 2 (via messaging app, email, etc.)
5. **User 2**: Click the link to automatically join the session
6. Both users upload photos and wait for results

### Manual Join:
1. **User 1**: Click "Create New Session" and note the Session ID
2. **User 2**: Enter the Session ID and click "Join Session"
3. Both users upload photos

## Configuration

### Backend Port
Change the port in `backend/server.js`:
```javascript
const PORT = process.env.PORT || 5001;
```

### Frontend Backend URL
Update in `frontend/src/App.tsx`:
```javascript
const BACKEND_URL = 'http://localhost:5001';
```

### Face Match Threshold
Adjust sensitivity in `backend/server.js`:
```javascript
const threshold = 0.6; // Lower = stricter (0.4-0.7 recommended)
```

### Session Timeout
Modify cleanup time in `backend/server.js`:
```javascript
// Clean up sessions older than 10 minutes
if (now - session.createdAt > 10 * 60 * 1000) {
```

## Security & Privacy

- **No Database**: All data is in-memory only
- **Auto Cleanup**: Sessions destroyed after 30 seconds
- **Rate Limiting**: Prevents abuse (100 requests per 15 minutes)
- **CORS Enabled**: Only localhost allowed by default
- **Max File Size**: 10MB limit on image uploads
- **URL Cleanup**: Session parameters removed from URL after joining

## Browser Compatibility

Works on all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## Troubleshooting

### Models Not Loading
If you see "Failed to load face detection models":
```bash
cd frontend/public
mkdir -p models
# Re-download models (see Installation section)
```

### Connection Issues
- Ensure backend is running on port 5001
- Check browser console for errors
- Verify CORS settings in `backend/server.js`

### Face Not Detected
- Use a well-lit, clear photo
- Face should be clearly visible
- Try a different image angle

### Link Sharing Not Working
- Ensure you're copying the full URL including `?session=...`
- Check that the session ID hasn't expired
- Try manually entering the session ID instead

## Development

### Backend Structure
```
backend/
├── server.js          # Main server file
└── package.json       # Dependencies
```

### Frontend Structure
```
frontend/
├── src/
│   ├── App.tsx        # Main React component
│   ├── App.css        # Styling
│   └── types.d.ts     # TypeScript definitions
└── public/
    └── models/        # Face detection models
```

## License

MIT License - Feel free to use and modify!

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

---

**Made with ❤️ for privacy-conscious users**
