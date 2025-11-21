import { type ClientSchema, a, defineData } from '@aws-amplify/backend'
import { stripeWebhook } from '../functions/stripe-webhook/resource'

const schema = a
  .schema({
    Goal: a
      .model({
        name: a.string().required(),
        description: a.string(),
        targetAmount: a.float().required(),
        stripeAccountId: a.string().required(), // Must be valid Stripe Connect account
        editPassword: a.string().required(), // hashed password
        milestones: a.hasMany('Milestone', 'goalId'),
        donations: a.hasMany('Donation', 'goalId'),
      })
      .authorization((allow) => [allow.guest()]),

    Milestone: a
      .model({
        goalId: a.id().required(),
        goal: a.belongsTo('Goal', 'goalId'),
        name: a.string().required(),
        targetAmount: a.float().required(),
        order: a.integer().required(),
      })
      .authorization((allow) => [allow.guest()]),

    Donation: a
      .model({
        goalId: a.id().required(),
        goal: a.belongsTo('Goal', 'goalId'),
        amount: a.float().required(),
        donorName: a.string(),
        message: a.string(),
        stripePaymentId: a.string().required(),
        status: a.enum(['pending', 'completed', 'failed']),
      })
      .authorization((allow) => [allow.guest()]),
  })
  .authorization((allow) => [allow.resource(stripeWebhook)])

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
})
