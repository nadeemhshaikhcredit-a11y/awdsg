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
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10e6 // 10MB for image uploads
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
//   users: [
//     { socketId: string, image: base64, faceDescriptor: array, ready: boolean },
//     { socketId: string, image: base64, faceDescriptor: array, ready: boolean }
//   ],
//   matched: boolean | null,
//   createdAt: timestamp
// }

// Clean up old sessions (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      sessions.delete(sessionId);
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }
}, 60 * 1000); // Run every minute

// Socket.io connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new session
  socket.on('create-session', (callback) => {
    const sessionId = uuidv4().substring(0, 8).toUpperCase();
    sessions.set(sessionId, {
      id: sessionId,
      users: [],
      matched: null,
      createdAt: Date.now()
    });

    socket.join(sessionId);
    socket.sessionId = sessionId;

    console.log(`Session created: ${sessionId}`);
    callback({ success: true, sessionId });
  });

  // Join an existing session
  socket.on('join-session', (sessionId, callback) => {
    const session = sessions.get(sessionId);

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    if (session.users.length >= 2) {
      return callback({ success: false, error: 'Session is full' });
    }

    socket.join(sessionId);
    socket.sessionId = sessionId;

    console.log(`User ${socket.id} joined session: ${sessionId}`);
    callback({ success: true, sessionId });

    // Notify other users in the session
    socket.to(sessionId).emit('user-joined', { userCount: session.users.length + 1 });
  });

  // Upload image and face descriptors
  socket.on('upload-image', ({ sessionId, image, faceDescriptor }, callback) => {
    const session = sessions.get(sessionId);

    if (!session) {
      return callback({ success: false, error: 'Session not found' });
    }

    // Check if user already uploaded
    const existingUserIndex = session.users.findIndex(u => u.socketId === socket.id);

    if (existingUserIndex >= 0) {
      // Update existing user
      session.users[existingUserIndex] = {
        socketId: socket.id,
        image,
        faceDescriptor,
        ready: true
      };
    } else {
      // Add new user
      if (session.users.length >= 2) {
        return callback({ success: false, error: 'Session is full' });
      }

      session.users.push({
        socketId: socket.id,
        image,
        faceDescriptor,
        ready: true
      });
    }

    console.log(`User ${socket.id} uploaded image to session ${sessionId}`);
    callback({ success: true });

    // Notify all users about readiness
    io.to(sessionId).emit('user-ready', {
      readyCount: session.users.filter(u => u.ready).length,
      totalUsers: session.users.length
    });

    // If both users are ready, compare faces
    if (session.users.length === 2 && session.users.every(u => u.ready)) {
      compareFaces(sessionId);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        // Remove user from session
        session.users = session.users.filter(u => u.socketId !== socket.id);

        // Notify remaining users
        io.to(socket.sessionId).emit('user-left', {
          userCount: session.users.length
        });

        // Clean up empty sessions
        if (session.users.length === 0) {
          sessions.delete(socket.sessionId);
          console.log(`Session ${socket.sessionId} deleted (empty)`);
        }
      }
    }
  });
});

// Compare faces using Euclidean distance
function compareFaces(sessionId) {
  const session = sessions.get(sessionId);

  if (!session || session.users.length !== 2) {
    return;
  }

  const [user1, user2] = session.users;

  // Calculate Euclidean distance between face descriptors
  const distance = euclideanDistance(user1.faceDescriptor, user2.faceDescriptor);

  // Threshold for face matching (typically 0.6, lower = stricter)
  const threshold = 0.6;
  const matched = distance < threshold;

  session.matched = matched;

  console.log(`Face comparison for session ${sessionId}: distance=${distance.toFixed(3)}, matched=${matched}`);

  // Send results to both users
  if (matched) {
    // Send both images if matched
    io.to(sessionId).emit('comparison-result', {
      matched: true,
      distance,
      images: {
        user1: user1.image,
        user2: user2.image
      }
    });
  } else {
    // Don't send images if not matched
    io.to(sessionId).emit('comparison-result', {
      matched: false,
      distance
    });
  }

  // Schedule session cleanup (destroy images after 30 seconds)
  setTimeout(() => {
    sessions.delete(sessionId);
    console.log(`Session ${sessionId} destroyed after comparison`);
  }, 30000);
}

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
