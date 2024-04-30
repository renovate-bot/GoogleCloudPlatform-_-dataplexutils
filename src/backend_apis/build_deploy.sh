export PROJECT_ID=<TO_DO_DEVELOPER>
export LOCATION=<TO_DO_DEVELOPER>
export SERVICE_NAME=metadata-wizard
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${LOCATION} \
  --allow-unauthenticated