import type { APIGatewayProxyHandler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '../../data/resource'
import { env } from '$amplify/env/stripe-webhook'
import { createDonation } from './mutations'

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'identityPool',
      },
    },
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {},
      },
    },
  }
)

const client = generateClient<Schema>()

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const signature = event.headers['stripe-signature']

    if (!signature) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing stripe-signature header',
          headers: event.headers,
        }),
      }
    }

    const stripeEvent = JSON.parse(event.body || '{}')

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object

      await client.graphql({
        query: createDonation,
        variables: {
          input: {
            goalId: session.metadata.goalId,
            amount: session.amount_total / 100,
            donorName: session.metadata.donorName || 'Anonymous',
            message: session.metadata.message || '',
            stripePaymentId: session.payment_intent,
            status: 'completed',
          },
        },
      })

      return {
        statusCode: 200,
        body: JSON.stringify({ received: true }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, type: stripeEvent.type }),
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    }
  }
}
