export const createDonation = /* GraphQL */ `
  mutation CreateDonation($input: CreateDonationInput!) {
    createDonation(input: $input) {
      id
      goalId
      amount
      donorName
      message
      stripePaymentId
      status
      createdAt
      updatedAt
    }
  }
`
