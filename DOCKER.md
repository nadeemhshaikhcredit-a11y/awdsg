# Docker Deployment Guide

## Quick Start

### Build and Run with Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5001

### Stop the Application

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Individual Docker Commands

### Backend Only

```bash
# Build backend image
docker build -t face-compare-backend ./backend

# Run backend container
docker run -p 5001:5001 --name backend face-compare-backend
```

### Frontend Only

```bash
# Build frontend image
docker build -t face-compare-frontend ./frontend

# Run frontend container
docker run -p 3000:80 --name frontend face-compare-frontend
```

## Docker Compose Commands

```bash
# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Stop without removing containers
docker-compose stop

# Start stopped containers
docker-compose start

# Check status
docker-compose ps

# View resource usage
docker stats
```

## Production Deployment

### Environment Variables

Create a `.env` file in the root directory:

```env
# Backend
NODE_ENV=production
PORT=5001

# Frontend (if needed)
REACT_APP_BACKEND_URL=http://your-backend-url:5001
```

### Custom Ports

Edit `docker-compose.yml` to change ports:

```yaml
services:
  backend:
    ports:
      - "8080:5001"  # Map host port 8080 to container port 5001
  
  frontend:
    ports:
      - "80:80"      # Map host port 80 to container port 80
```

### Health Checks

Both services have health checks configured:

```bash
# Check health status
docker-compose ps

# Inspect detailed health status
docker inspect face-compare-backend --format='{{.State.Health.Status}}'
docker inspect face-compare-frontend --format='{{.State.Health.Status}}'
```

## Troubleshooting

### View Container Logs

```bash
docker-compose logs backend
docker-compose logs frontend
```

### Enter Container Shell

```bash
# Backend
docker exec -it face-compare-backend sh

# Frontend
docker exec -it face-compare-frontend sh
```

### Clean Up Everything

```bash
# Remove all containers, networks, and images
docker-compose down --rmi all --volumes

# Remove unused Docker resources
docker system prune -a
```

### Common Issues

**Issue**: CORS errors
- **Solution**: Check that backend CORS settings include the frontend URL

**Issue**: Frontend can't connect to backend
- **Solution**: Verify both containers are on the same network (`docker network inspect face-compare_face-compare-network`)

**Issue**: Port already in use
- **Solution**: Change ports in `docker-compose.yml` or stop the conflicting process

## Container Details

### Backend Container
- **Base Image**: node:18-alpine
- **Working Directory**: /app
- **Exposed Port**: 5001
- **Health Check**: HTTP GET to /health endpoint

### Frontend Container
- **Build Stage**: node:18-alpine
- **Production Stage**: nginx:alpine
- **Exposed Port**: 80
- **Web Server**: nginx with gzip compression and caching
- **Health Check**: wget to /health endpoint

## Performance Optimization

### Multi-stage Builds
Frontend uses multi-stage build to:
- Reduce final image size (build artifacts excluded)
- Optimize for production (nginx serves static files)

### Image Sizes
- Backend: ~150MB (Node.js Alpine)
- Frontend: ~50MB (nginx Alpine + built assets)

## Security Best Practices

1. **Run as non-root user** (can be added to Dockerfiles)
2. **Use specific base image versions** (currently using node:18-alpine)
3. **Scan images for vulnerabilities**:
   ```bash
   docker scan face-compare-backend
   docker scan face-compare-frontend
   ```
4. **Keep dependencies updated**

## Push to Registry

### Docker Hub

```bash
# Tag images
docker tag face-compare-backend username/face-compare-backend:latest
docker tag face-compare-frontend username/face-compare-frontend:latest

# Login
docker login

# Push
docker push username/face-compare-backend:latest
docker push username/face-compare-frontend:latest
```

### Pull and Run from Registry

```bash
docker pull username/face-compare-backend:latest
docker pull username/face-compare-frontend:latest

docker-compose up -d
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build images
        run: docker-compose build
      - name: Push images
        run: |
          docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
          docker-compose push
```
