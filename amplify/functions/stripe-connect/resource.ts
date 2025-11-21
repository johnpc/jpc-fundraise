import { defineFunction, secret } from '@aws-amplify/backend'

export const stripeConnect = defineFunction({
  name: 'stripe-connect',
  entry: './handler.ts',
  environment: {
    STRIPE_SECRET_KEY: secret('STRIPE_SECRET_KEY'),
    APP_URL: process.env.APP_URL || 'http://localhost:5173',
  },
  timeoutSeconds: 30,
  resourceGroupName: 'api',
})
