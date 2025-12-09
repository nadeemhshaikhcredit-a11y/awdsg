# 🔐 Face Verify - One-to-Many Identity Verification

A privacy-focused web application that allows a **Session Host (Admin)** to verify the identity of multiple participants against a reference photo. Ideally suited for quick, secure, and ephemeral identity checks.

## Key Features

✨ **One-to-Many Verification**
- **Admin**: Uploads one reference photo.
- **Participants**: Join via link and upload their photo.
- **Privacy**: Admin's photo is **hidden** from participants until they successfully match.

🕵️ **Privacy First**
- No images stored on disk (In-memory only).
- Sessions auto-delete after the configured duration.
- Reference photos are only revealed upon successful verification.

⏱️ **Configurable Sessions**
- Set session duration (5-120 minutes).
- Max 10 participants per session.
- Real-time dashboard for the admin.

## How It Works

### For the Session Host (Admin)

1. **Create Session**: Set duration and start.
2. **Upload Reference**: securely upload your photo.
3. **Share Link**: Send the generated link to participants.
4. **Monitor**: Watch the dashboard as participants are verified in real-time.
5. **Review**: See a gallery of all successful matches with match confidence scores.

### For Participants

1. **Join**: Click the shared link.
2. **Upload**: Take/Upload a selfie.
3. **Verify**:
   - ✅ **Match**: You see the host's photo and your photo side-by-side.
   - ❌ **No Match**: You get a "Verification Failed" message. The host's photo remains hidden.

## Tech Stack

- **Frontend**: React 19, TypeScript, face-api.js
- **Backend**: Node.js, Express, Socket.io
- **Deployment**: Docker, Nginx

## Running the App

### Using Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5001`

### Local Development

1. **Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

## Configuration

- **Max Participants**: 10 (hardcoded limit for performance)
- **Match Threshold**: 0.6 (Euclidean distance)
- **Session Duration**: Configurable (default 30 mins)

## Troubleshooting

- **"Processing your photo..." stuck**: Try a smaller image or better lighting.
- **No Face Detected**: Ensure face is front-facing and unobstructed.
- **Connection Failed**: Check if Docker containers are running (`docker-compose ps`).

## License

MIT License
