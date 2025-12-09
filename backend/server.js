const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ["http://localhost:3000", "http://localhost"]
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10e6 // 10MB for image uploads
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  // Set static folder
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../', 'frontend', 'build', 'index.html'));
  });
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Session storage (in-memory, cleared after comparison)
const sessions = new Map();

// Session structure:
// {
//   id: string,
//   adminId: string,  // Socket ID of session creator
//   adminName: string,  // Optional admin display name
//   referenceImage: string | null,  // Admin's reference photo
//   referenceFaceDescriptor: array | null,  // Admin's face descriptor
//   participants: [
//     {
//       socketId: string,
//       name: string,
//       image: string,
//       faceDescriptor: array,
//       matched: boolean,
//       matchDistance: number,
//       timestamp: Date
//     }
//   ],
//   maxParticipants: 10,
//   durationMinutes: number,  // Configurable session duration
//   createdAt: timestamp
// }

// Clean up old sessions based on their configured duration
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    const sessionDuration = (session.durationMinutes || 30) * 60 * 1000;
    if (now - session.createdAt > sessionDuration) {
      sessions.delete(sessionId);
      console.log(`Cleaned up expired session: ${sessionId} (duration: ${session.durationMinutes} minutes)`);
    }
  }
}, 60 * 1000); // Run every minute

// Socket.io connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new session (Admin creates it)
  socket.on('create-session', ({ durationMinutes = 30 }, callback) => {
    const sessionId = uuidv4().substring(0, 8).toUpperCase();
    sessions.set(sessionId, {
      id: sessionId,
      adminId: socket.id,
      adminName: '',
      referenceImage: null,
      referenceFaceDescriptor: null,
      participants: [],
      maxParticipants: 10,
      durationMinutes: durationMinutes,
      createdAt: Date.now()
    });

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isAdmin = true;

    console.log(`Session created: ${sessionId} by admin ${socket.id}, duration: ${durationMinutes} minutes`);
    callback({ success: true, sessionId, isAdmin: true });
  });

  // Join an existing session (as Participant)
  socket.on('join-session', (sessionId, callback) => {
    const session = sessions.get(sessionId);

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    if (session.participants.length >= session.maxParticipants) {
      return callback({ success: false, error: 'Session is full (max 10 participants)' });
    }

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isAdmin = false;

    console.log(`User ${socket.id} joined session: ${sessionId} as participant`);
    callback({ success: true, sessionId, isAdmin: false });

    // Notify admin that someone joined
    io.to(session.adminId).emit('participant-joined', {
      participantCount: session.participants.length,
      maxParticipants: session.maxParticipants
    });
  });

  // Admin uploads reference image
  socket.on('upload-reference-image', ({ sessionId, image, faceDescriptor }, callback) => {
    const session = sessions.get(sessionId);

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    if (session.adminId !== socket.id) {
      return callback({ success: false, error: 'Only session creator can upload reference image' });
    }

    session.referenceImage = image;
    session.referenceFaceDescriptor = faceDescriptor;

    console.log(`Admin ${socket.id} uploaded reference image for session ${sessionId}`);
    callback({ success: true });
  });

  // Participant uploads image for verification
  socket.on('upload-participant-image', ({ sessionId, image, faceDescriptor, name }, callback) => {
    const session = sessions.get(sessionId);

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    if (!session.referenceImage) {
      return callback({ success: false, error: 'Session host has not uploaded reference image yet' });
    }

    if (session.participants.length >= session.maxParticipants) {
      return callback({ success: false, error: 'Session is full' });
    }

    // Calculate match distance
    const distance = euclideanDistance(session.referenceFaceDescriptor, faceDescriptor);
    const threshold = 0.6;
    const matched = distance < threshold;

    // Store participant data
    const participant = {
      socketId: socket.id,
      name: name || 'Anonymous',
      image: image,
      faceDescriptor: faceDescriptor,
      matched: matched,
      matchDistance: distance,
      timestamp: new Date()
    };

    session.participants.push(participant);

    console.log(`Participant ${socket.id} verified against session ${sessionId}: matched=${matched}, distance=${distance.toFixed(3)}`);

    callback({ success: true });

    // Send result to participant
    socket.emit('verification-result', {
      matched: matched,
      distance: distance,
      referenceImage: matched ? session.referenceImage : null,  // Only show if matched
      participantImage: image
    });

    // If matched, update admin's gallery
    if (matched) {
      io.to(session.adminId).emit('gallery-updated', {
        participants: session.participants.filter(p => p.matched).map(p => ({
          name: p.name,
          image: p.image,
          matchDistance: p.matchDistance,
          timestamp: p.timestamp
        })),
        totalParticipants: session.participants.length,
        matchedCount: session.participants.filter(p => p.matched).length
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        // If admin disconnects, keep session active but mark it
        if (session.adminId === socket.id) {
          console.log(`Admin disconnected from session ${socket.sessionId}, but session remains active`);
          // Optionally notify participants
          socket.to(socket.sessionId).emit('admin-disconnected');
        } else {
          // Remove participant from list
          session.participants = session.participants.filter(p => p.socketId !== socket.id);

          // Notify admin
          io.to(session.adminId).emit('participant-left', {
            participantCount: session.participants.length
          });
        }

        // Clean up empty sessions (no admin, no participants)
        if (session.participants.length === 0 && !io.sockets.sockets.get(session.adminId)) {
          sessions.delete(socket.sessionId);
          console.log(`Session ${socket.sessionId} deleted (empty)`);
        }
      }
    }
  });
});

// Calculate Euclidean distance
function euclideanDistance(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    throw new Error('Arrays must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += Math.pow(arr1[i] - arr2[i], 2);
  }
  return Math.sqrt(sum);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
