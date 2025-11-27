# Deploying Promptions with Docker

This guide explains how to deploy the Promptions application using Docker and Docker Compose for private hosting on your website.

## Prerequisites

Before you begin, make sure you have the following installed:
- [Docker](https://docs.docker.com/get-docker/) (20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (2.0+)
- Your OpenAI API key

## Quick Start

1. Clone the repository if you haven't already:
   ```bash
   git clone <repository-url>
   cd promptions
   ```

2. Create a `.env` file with your OpenAI API key:
   ```bash
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   ```

3. Build and run the container:
   ```bash
   docker-compose up --build
   ```

4. Access the applications:
   - Chat application: http://localhost:8080/chat (or http://localhost:8080/)
   - Image generation: http://localhost:8080/image

## Configuration

### Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Port Mapping

By default, the container runs on port 80 inside the container and is mapped to port 8080 on the host. To change this:

1. Edit the `docker-compose.yml` file:
   ```yaml
   ports:
     - "YOUR_PORT:80"  # Replace YOUR_PORT with your desired port
   ```

2. Restart the container with:
   ```bash
   docker-compose up --build
   ```

### Reverse Proxy Configuration

To use with a reverse proxy like Nginx:

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Build Options

### Build with Docker directly

If you prefer to use Docker directly instead of Docker Compose:

```bash
# Build the image
docker build -t promptions .

# Run the container
docker run -p 8080:80 -e OPENAI_API_KEY=your_key promptions
```

### Production Considerations

For production deployments:

1. **Security**:
   - Always use HTTPS in production
   - Consider using secrets management for API keys
   - Limit container privileges

2. **Performance**:
   - Use a CDN for static assets if deploying at scale
   - Consider container orchestration (Kubernetes, ECS) for high availability

3. **Monitoring**:
   - Set up health checks (included in docker-compose.yml)
   - Configure logging for troubleshooting

### Troubleshooting

If you encounter issues:

1. **Container fails to start**:
   ```bash
   docker-compose logs promptions
   ```

2. **Missing API key errors**:
   - Ensure your `.env` file is properly formatted
   - Check that the API key is valid and active

3. **Port conflicts**:
   - Change the host port mapping in `docker-compose.yml`
   - Check if other services are using the same port

### Behind the Scenes

The Docker image uses a multi-stage build:

1. **Base stage**: Builds all applications using Yarn and the NX build system
2. **Production stage**: Creates a minimal image with just the built assets and a simple Node.js server

The server handles:
- Serving static files for both chat and image apps
- CORS headers for cross-origin requests
- API proxy to OpenAI endpoints
- Error handling and proper routing

## Support

For issues specific to the Docker deployment:
1. Check this README first
2. Search existing GitHub issues
3. Create a new issue with details about your environment and errors

For general Promptions documentation, see the main [README.md](README.md).