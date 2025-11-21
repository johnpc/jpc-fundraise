import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { stripeWebhook } from './functions/stripe-webhook/resource'
import { stripeConnect } from './functions/stripe-connect/resource'
import { stripeCheckout } from './functions/stripe-checkout/resource'
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda'
import { Duration } from 'aws-cdk-lib'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'

const backend = defineBackend({
  auth,
  data,
  stripeWebhook,
  stripeConnect,
  stripeCheckout,
})

// Grant webhook function access to Data API
backend.data.resources.graphqlApi.grantQuery(
  backend.stripeWebhook.resources.lambda
)
backend.data.resources.graphqlApi.grantMutation(
  backend.stripeWebhook.resources.lambda
)

// Grant S3 access to model introspection schema
backend.stripeWebhook.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:GetObject'],
    resources: ['arn:aws:s3:::*/*'],
  })
)

// Enable function URL for stripe-webhook with CORS
const stripeWebhookFunction = backend.stripeWebhook.resources.lambda
const webhookFunctionUrl = stripeWebhookFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['content-type', 'stripe-signature'],
    maxAge: Duration.minutes(5),
  },
})

// Enable function URL for stripe-connect with CORS
const stripeConnectFunction = backend.stripeConnect.resources.lambda
const connectFunctionUrl = stripeConnectFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['content-type'],
    maxAge: Duration.minutes(5),
  },
})

// Enable function URL for stripe-checkout with CORS
const stripeCheckoutFunction = backend.stripeCheckout.resources.lambda
const checkoutFunctionUrl = stripeCheckoutFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['content-type'],
    maxAge: Duration.minutes(5),
  },
})

// Add function URLs to outputs
backend.addOutput({
  custom: {
    stripeWebhookUrl: webhookFunctionUrl.url,
    stripeConnectUrl: connectFunctionUrl.url,
    stripeCheckoutUrl: checkoutFunctionUrl.url,
  },
})
