# JPC Fundraise

A modern fundraising platform that allows users to create goals with milestones, accept donations via Stripe, and track progress in real-time.

## Features

- 🎯 **Milestone-based Goals** - Break big dreams into achievable pieces
- 💳 **Direct Payouts** - Stripe Connect sends funds directly to goal creators
- ⚡ **Real-time Updates** - Watch donations roll in live via Amplify subscriptions
- 🔒 **Secure** - Password-protected goal editing
- 📱 **Mobile-friendly** - Beautiful responsive design

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Backend:** AWS Amplify Gen 2
- **Database:** Amplify Data (DynamoDB)
- **Payments:** Stripe Connect + Stripe Checkout
- **Routing:** React Router v6

## Prerequisites

- Node.js 18+ and npm
- AWS Account with CLI configured
- Stripe Account (test mode works for development)
- AWS CLI profile named `personal` configured

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Stripe

The Stripe keys are already configured in this project:

- Publishable key is in `.env`
- Secret key is set in Amplify sandbox

If you need to update them:

```bash
# Set Stripe secret key in Amplify
npx ampx sandbox secret set STRIPE_SECRET_KEY --profile personal
# Paste your sk_test_... key when prompted

# Update .env with your publishable key
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." > .env
```

Get your keys from: https://dashboard.stripe.com/test/apikeys

### 3. Start Amplify Sandbox

In one terminal, start the Amplify backend:

```bash
npm run sandbox
```

This will:

- Deploy your backend to AWS
- Create DynamoDB tables
- Deploy Lambda functions
- Generate `amplify_outputs.json`
- Watch for changes and auto-deploy

**First time setup:** You'll be prompted to log in to AWS and select a region.

### 4. Start Development Server

In another terminal, start the frontend:

```bash
npm run dev
```

Visit http://localhost:5173

## Available Scripts

- `npm run dev` - Start Vite development server
- `npm run sandbox` - Start Amplify sandbox (backend)
- `npm run sandbox:delete` - Delete Amplify sandbox resources
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
jpc-fundraise/
├── amplify/
│   ├── data/
│   │   └── resource.ts          # Data schema (Goal, Milestone, Donation)
│   ├── functions/
│   │   ├── stripe-connect/      # Stripe Connect onboarding
│   │   └── stripe-webhook/      # Handle Stripe payment webhooks
│   └── backend.ts               # Amplify backend configuration
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx      # Home page
│   │   └── CreateGoalPage.tsx   # Goal creation form
│   ├── components/              # Reusable components
│   ├── amplify-config.ts        # Amplify client configuration
│   └── main.tsx                 # App entry point
├── REQUIREMENTS.md              # Detailed project requirements
└── README.md                    # This file
```

## How It Works

### Creating a Goal

1. User fills out goal form with name, description, target amount, and milestones
2. User clicks "Connect Bank Account" → redirected to Stripe Connect onboarding
3. User provides bank details and identity verification to Stripe
4. User returns to form, submits to create goal
5. Goal is created with unique ID and edit password
6. User receives two URLs:
   - **Public URL** - Share with donors
   - **Edit URL** - Keep private, contains password in path

### Making a Donation

1. Visitor views public goal page
2. Clicks "Donate" and enters amount
3. Redirected to Stripe Checkout
4. Completes payment
5. Stripe webhook triggers Amplify function
6. Donation record created in database
7. All viewers see progress bar update in real-time

### Payouts

- Donations go directly to goal creator's Stripe Connect account
- Stripe automatically deposits to their bank account (2-7 days)
- Platform never holds user funds
- Goal creator can view balance in Stripe dashboard

## Data Model

### Goal

- name, description, targetAmount
- stripeAccountId (Stripe Connect account)
- editPassword (hashed)
- Has many Milestones and Donations

### Milestone

- name, targetAmount, order
- Belongs to Goal

### Donation

- amount, donorName, message
- stripePaymentId, status
- Belongs to Goal

## Environment Variables

Create a `.env` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Deployment

### Deploy to Production

1. Set production Stripe secret key:

   ```bash
   # Set production secret (stored in AWS Secrets Manager)
   npx ampx secret set STRIPE_SECRET_KEY --profile personal
   # Paste your sk_live_... key when prompted
   ```

2. Update Stripe Connect function environment:

   ```typescript
   // amplify/functions/stripe-connect/resource.ts
   environment: {
     APP_URL: 'https://your-domain.com',
   }
   ```

3. Update `.env` with production publishable key:

   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

4. Deploy:
   ```bash
   npm run build
   npx ampx pipeline-deploy --branch main --profile personal
   ```

## Troubleshooting

### Amplify sandbox won't start

- Ensure AWS CLI is configured: `aws configure --profile personal`
- Check you have permissions to create CloudFormation stacks
- Try deleting and recreating: `npm run sandbox:delete` then `npm run sandbox`

### Stripe Connect not working

- Verify secret key is set: `npx ampx sandbox secret list --profile personal`
- Check Stripe dashboard for account status
- Ensure you're using test mode keys for development

### Real-time updates not working

- Check browser console for WebSocket errors
- Verify Amplify sandbox is running
- Refresh the page to reconnect

## Contributing

See [REQUIREMENTS.md](./REQUIREMENTS.md) for detailed project requirements and architecture decisions.

## License

MIT
