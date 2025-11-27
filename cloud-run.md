# Deploying Promptions to Google Cloud Run

This guide explains how to deploy the Promptions application to Google Cloud Run using the provided Cloud Build pipeline.

## Prerequisites

Before you begin, make sure you have:
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and configured
- Authentication set up: `gcloud auth login`
- A Google Cloud project with the following APIs enabled:
  - Cloud Run API
  - Cloud Build API
  - Container Registry API or Artifact Registry API
- billing enabled for your project

## Quick Setup

1. **Set your project ID**:
   ```bash
   export PROJECT_ID="your-project-id"
   gcloud config set project $PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   ```

3. **Create a GitHub trigger** (if using GitHub):
   ```bash
   # Connect your GitHub repository
   gcloud alpha builds triggers create github \
     --repo-name="your-repo-name" \
     --repo-owner="your-github-username" \
     --description="Promptions CI/CD Pipeline" \
     --branch-pattern="^main$" \
     --build-config="cloudbuild.yaml"
   ```

## Manual Deployment

If you prefer to deploy manually without CI/CD:

1. **Build the Docker image**:
   ```bash
   docker build -t gcr.io/$PROJECT_ID/promptions .
   ```

2. **Push the image to Container Registry**:
   ```bash
   docker push gcr.io/$PROJECT_ID/promptions
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy promptions \
     --image gcr.io/$PROJECT_ID/promptions \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --max-instances 10 \
     --memory 512Mi
   ```

## Setting Environment Variables

For Cloud Run, you'll need to set the OpenAI API key as an environment variable:

### Using the Cloud Console

1. Go to the Cloud Run service in the Google Cloud Console
2. Click "Edit & Deploy New Revision"
3. Go to the "Container" tab
4. Add the environment variable:
   - Name: `OPENAI_API_KEY`
   - Value: Your API key

### Using gcloud CLI

```bash
gcloud run services update promptions \
  --region us-central1 \
  --set-env-vars "OPENAI_API_KEY=your_openai_api_key"
```

For better security, consider using Secret Manager:

1. Store your API key in Secret Manager:
   ```bash
   echo -n "your_openai_api_key" | gcloud secrets create openai-api-key --data-file=-
   ```

2. Grant Cloud Run access to the secret:
   ```bash
   gcloud secrets add-iam-policy-binding openai-api-key \
     --member="serviceAccount:$(gcloud run services describe promptions --region us-central1 --format='value(spec.template.spec.serviceAccountName)')" \
     --role="roles/secretmanager.secretAccessor"
   ```

3. Update the service to use the secret:
   ```bash
   gcloud run services update promptions \
     --region us-central1 \
     --set-secrets "OPENAI_API_KEY=openai-api-key:latest"
   ```

## CI/CD with GitHub

To automatically deploy when you push to your repository:

1. Set up the GitHub trigger (see Quick Setup above)

2. Configure the trigger to use your environment variables:
   ```bash
   gcloud alpha builds triggers update TRIGGER_ID \
     --build-config="cloudbuild.yaml" \
     --substitutions="_OPENAI_API_KEY=your_openai_api_key"
   ```

3. Modify `cloudbuild.yaml` to use the substitution:
   ```yaml
   - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
     entrypoint: 'gcloud'
     args:
     - 'run'
     - 'deploy'
     - 'promptions'
     - '--image=gcr.io/$PROJECT_ID/promptions:$COMMIT_SHA'
     - '--region=us-central1'
     - '--platform=managed'
     - '--allow-unauthenticated'
     - '--port=80'
     - '--concurrency=80'
     - '--min-instances=0'
     - '--max-instances=10'
     - '--cpu=1'
     - '--memory=512Mi'
     - '--set-env-vars=OPENAI_API_KEY=$_OPENAI_API_KEY'
   ```

## Monitoring

### Viewing Logs

```bash
# View Cloud Run logs
gcloud logs read "resource.type=cloud_run" --limit 50

# View Build logs
gcloud builds list
gcloud builds log BUILD_ID
```

### Setting Up Monitoring

You can set up Cloud Monitoring to track:
- Request latency
- Error rates
- Instance counts

```bash
# Install the Cloud Monitoring agent
gcloud components install beta

# Enable monitoring
gcloud services enable monitoring.googleapis.com
```

## Custom Domain (Optional)

To use a custom domain with your Cloud Run service:

1. **Verify your domain**:
   ```bash
   gcloud domains verify example.com
   ```

2. **Map the domain**:
   ```bash
   gcloud run domain-mappings create \
     --service=promptions \
     --domain=app.example.com \
     --region=us-central1
   ```

3. **Update DNS records** as instructed by Google Cloud

## Performance Tuning

The default configuration in `cloudbuild.yaml` is a good starting point, but you can adjust:

- `--cpu`: CPU allocation (0.5-4)
- `--memory`: Memory allocation (128Mi-32Gi)
- `--max-instances`: Maximum number of instances
- `--min-instances`: Minimum instances (0 for scale-to-zero)

For high-traffic applications, consider:
- Increasing `--max-instances`
- Setting `--min-instances` to 1 or higher
- Adjusting `--concurrency` (requests per instance)

## Troubleshooting

### Common Issues

1. **Build failures**:
   - Check the build logs: `gcloud builds log BUILD_ID`
   - Verify your code builds locally

2. **Deployment failures**:
   - Check service logs: `gcloud logs read "resource.type=cloud_run"`
   - Verify all required environment variables are set

3. **API errors**:
   - Ensure the OpenAI API key is correctly set
   - Check that the key has sufficient quota

### Scaling Issues

If your service doesn't scale correctly:

1. Check resource limits in Google Cloud Console
2. Monitor instance metrics
3. Adjust `--max-instances` if needed

### Performance Issues

For better performance:

1. Consider using a larger CPU/memory allocation
2. Check for bottlenecks in the application code
3. Enable Cloud CDN for static assets

## Security Considerations

1. **API Keys**: Use Secret Manager for production deployments
2. **Authentication**: For internal services, disable public access and use IAM
3. **HTTPS**: Cloud Run automatically provides HTTPS
4. **Network**: Consider using VPC Connector for private resources