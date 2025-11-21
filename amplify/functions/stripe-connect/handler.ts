import type { APIGatewayProxyHandler } from 'aws-lambda'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), {
  apiVersion: '2025-11-17.clover',
})

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const { action, accountId } = body

    if (action === 'create') {
      // Create a new Connect account with simplified defaults
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Default to individual, not business
        business_profile: {
          mcc: '8398', // Charitable and Social Service Organizations
          product_description: 'Personal fundraising campaign',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'daily', // Fastest payout schedule
            },
          },
        },
      })

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.APP_URL}/create?refresh=true`,
        return_url: `${process.env.APP_URL}/create?account=${account.id}`,
        type: 'account_onboarding',
        collection_options: {
          fields: 'eventually_due', // Only collect required fields
          future_requirements: 'omit', // Don't ask for future requirements upfront
        },
      })

      return {
        statusCode: 200,
        body: JSON.stringify({
          accountId: account.id,
          url: accountLink.url,
        }),
      }
    }

    if (action === 'verify' && accountId) {
      // Verify account is fully onboarded
      const account = await stripe.accounts.retrieve(accountId)

      return {
        statusCode: 200,
        body: JSON.stringify({
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          detailsSubmitted: account.details_submitted,
        }),
      }
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid action' }),
    }
  } catch (error) {
    console.error('Stripe Connect error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
    }
  }
}
