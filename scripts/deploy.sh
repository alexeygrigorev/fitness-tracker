#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-eu-west-1}"
STACK="${STACK:-fitness-tracker}"
AUTH_STACK="${AUTH_STACK:-dtcdev-shared-auth}"
DOMAIN="${DOMAIN:-gym.dtcdev.click}"

auth_output() {
  aws cloudformation describe-stacks --region us-east-1 --stack-name "$AUTH_STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

AUTH_CLIENT_ID="${AUTH_CLIENT_ID:-$(auth_output GymClientId)}"
AUTH_ISSUER="${AUTH_ISSUER:-$(auth_output IssuerUrl)}"
AUTH_JWKS_URL="${AUTH_JWKS_URL:-$(auth_output JwksUrl)}"
if [[ -z "${JWT_SECRET:-}" ]]; then
  FUNCTION_NAME="$(aws cloudformation describe-stack-resource --region "$REGION" --stack-name "$STACK" \
    --logical-resource-id Api --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null || true)"
  if [[ -n "$FUNCTION_NAME" && "$FUNCTION_NAME" != "None" ]]; then
    JWT_SECRET="$(aws lambda get-function-configuration --region "$REGION" --function-name "$FUNCTION_NAME" \
      --query 'Environment.Variables.JWT_SECRET' --output text)"
  else
    JWT_SECRET="$(openssl rand -hex 48)"
  fi
fi

(cd backend-ts && npm run build:cutover && sam build --template template.yaml --build-dir .tmp/deploy-build)

sam deploy --region "$REGION" --stack-name "$STACK" \
  --template-file backend-ts/.tmp/deploy-build/template.yaml \
  --resolve-s3 --capabilities CAPABILITY_IAM \
  --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides \
    JwtSecret="$JWT_SECRET" DomainName="$DOMAIN" \
    AuthBaseUrl=https://auth.dtcdev.click AuthClientId="$AUTH_CLIENT_ID" \
    AuthIssuer="$AUTH_ISSUER" AuthJwksUrl="$AUTH_JWKS_URL"

API_ID="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiId'].OutputValue" --output text)"

aws cloudformation deploy --region "$REGION" --stack-name ai-engineering-gym \
  --template-file deploy/gym-domain-stack.yaml --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset --parameter-overrides FitnessApiId="$API_ID"

echo "Deployed https://${DOMAIN}"
