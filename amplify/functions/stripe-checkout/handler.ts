import type { Handler } from 'aws-lambda'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), {
  apiVersion: '2025-11-17.clover',
})

export const handler: Handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const { goalId, amount, stripeAccountId, donorName, message } = body

    if (!goalId || !amount || !stripeAccountId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      }
    }

    // Check if account has required capabilities
    const account = await stripe.accounts.retrieve(stripeAccountId)

    if (!account.charges_enabled || !account.details_submitted) {
      // Account needs to complete onboarding
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${process.env.APP_URL}/goal/${goalId}`,
        return_url: `${process.env.APP_URL}/goal/${goalId}`,
        type: 'account_onboarding',
        collection_options: {
          fields: 'eventually_due',
        },
      })

      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Account onboarding incomplete',
          onboardingUrl: accountLink.url,
        }),
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Donation',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/goal/${goalId}?success=true`,
      cancel_url: `${process.env.APP_URL}/goal/${goalId}`,
      metadata: {
        goalId,
        donorName: donorName || 'Anonymous',
        message: message || '',
      },
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: {
          destination: stripeAccountId,
        },
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
