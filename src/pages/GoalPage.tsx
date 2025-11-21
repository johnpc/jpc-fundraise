import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import outputs from '../../amplify_outputs.json'
import Swal from 'sweetalert2'
import ReactMarkdown from 'react-markdown'

const client = generateClient<Schema>()

function GoalPage() {
  const { goalId } = useParams<{ goalId: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isDonating, setIsDonating] = useState(false)
  const [goal, setGoal] = useState<{
    id: string
    name: string
    description: string
    targetAmount: number
  } | null>(null)
  const [milestones, setMilestones] = useState<
    Array<{ id: string; name: string; targetAmount: number; order: number }>
  >([])
  const [donations, setDonations] = useState<
    Array<{
      id: string
      amount: number
      donorName: string
      message: string
      createdAt: string
    }>
  >([])

  useEffect(() => {
    loadGoal()

    // Check for success parameter
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      Swal.fire({
        icon: 'success',
        title: 'Thank You!',
        text: 'Your donation was successful. The page will update shortly.',
        confirmButtonColor: '#9333ea',
      })
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Subscribe to goal updates
    const goalSub = client.models.Goal.observeQuery({
      filter: { id: { eq: goalId! } },
    }).subscribe({
      next: ({ items }) => {
        if (items[0]) setGoal(items[0])
      },
    })

    // Subscribe to milestone updates
    const milestoneSub = client.models.Milestone.observeQuery({
      filter: { goalId: { eq: goalId! } },
    }).subscribe({
      next: ({ items }) => {
        setMilestones(items.sort((a, b) => a.order - b.order))
      },
    })

    // Subscribe to donation updates
    const donationSub = client.models.Donation.observeQuery({
      filter: { goalId: { eq: goalId! } },
    }).subscribe({
      next: ({ items }) => {
        setDonations(
          items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        )
      },
    })

    return () => {
      goalSub.unsubscribe()
      milestoneSub.unsubscribe()
      donationSub.unsubscribe()
    }
  }, [goalId])

  const loadGoal = async () => {
    try {
      const [goalResult, milestonesResult, donationsResult] = await Promise.all(
        [
          client.models.Goal.get({ id: goalId! }),
          client.models.Milestone.list({ filter: { goalId: { eq: goalId! } } }),
          client.models.Donation.list({ filter: { goalId: { eq: goalId! } } }),
        ]
      )

      if (!goalResult.data) {
        navigate('/')
        return
      }

      setGoal(goalResult.data)
      setMilestones(
        (milestonesResult.data || []).sort((a, b) => a.order - b.order)
      )
      setDonations(
        (donationsResult.data || []).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      )
    } catch (error) {
      console.error('Error loading goal:', error)
      navigate('/')
    } finally {
      setIsLoading(false)
    }
  }

  const currentAmount = useMemo(() => {
    return donations
      .filter((d) => d.status === 'completed')
      .reduce((sum, d) => sum + d.amount, 0)
  }, [donations])

  const progressPercent = goal
    ? Math.min((currentAmount / goal.targetAmount) * 100, 100)
    : 0

  const milestonePositions = useMemo(() => {
    if (!goal || milestones.length === 0) return []
    let runningTotal = 0
    return milestones.map((m) => {
      runningTotal += m.targetAmount
      return {
        ...m,
        position: (runningTotal / goal.targetAmount) * 100,
        reached: currentAmount >= runningTotal,
      }
    })
  }, [milestones, goal, currentAmount])

  const handleDonate = async () => {
    const result = await Swal.fire({
      title: 'Make a Donation',
      html: `
        <div style="text-align: left;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Amount ($) *</label>
          <input id="amount" type="number" class="swal2-input" placeholder="25.00" min="1" step="0.01" style="margin: 0 0 16px 0; width: 100%;">
          
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Your Name (optional)</label>
          <input id="donorName" type="text" class="swal2-input" placeholder="Leave blank to remain anonymous" style="margin: 0 0 16px 0; width: 100%;">
          
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Message (optional)</label>
          <textarea id="message" class="swal2-textarea" placeholder="Add a message..." style="margin: 0; width: 100%; min-height: 80px;"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continue to Payment',
      confirmButtonColor: '#9333ea',
      focusConfirm: false,
      preConfirm: () => {
        const amount = (document.getElementById('amount') as HTMLInputElement)
          .value
        const donorName = (
          document.getElementById('donorName') as HTMLInputElement
        ).value
        const message = (
          document.getElementById('message') as HTMLTextAreaElement
        ).value

        if (!amount || parseFloat(amount) < 1) {
          Swal.showValidationMessage('Please enter an amount of at least $1')
          return false
        }

        return { amount, donorName, message }
      },
    })

    if (result.isConfirmed && result.value) {
      setIsDonating(true)
      try {
        const functionUrl = (
          outputs as { custom?: { stripeCheckoutUrl?: string } }
        ).custom?.stripeCheckoutUrl

        if (!functionUrl) {
          throw new Error('Checkout function not deployed')
        }

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalId,
            amount: parseFloat(result.value.amount),
            stripeAccountId: goal.stripeAccountId,
            donorName: result.value.donorName || undefined,
            message: result.value.message || undefined,
          }),
        })

        const data = await response.json()

        if (!response.ok && data.onboardingUrl) {
          // Account needs to complete onboarding
          const result = await Swal.fire({
            icon: 'warning',
            title: 'Complete Bank Setup',
            text: 'The goal creator needs to finish setting up their bank account before accepting donations.',
            confirmButtonText: 'Complete Setup',
            showCancelButton: true,
            confirmButtonColor: '#9333ea',
          })

          if (result.isConfirmed) {
            window.location.href = data.onboardingUrl
          }
          setIsDonating(false)
          return
        }

        if (data.url) {
          window.location.href = data.url
        } else {
          throw new Error('No checkout URL returned')
        }
      } catch (error) {
        console.error('Donation error:', error)
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to start donation process. Please try again.',
        })
        setIsDonating(false)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!goal) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Home
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {goal.name}
          </h1>
          {goal.description && (
            <div className="prose prose-lg max-w-none mt-3 text-gray-600">
              <ReactMarkdown>{goal.description}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex justify-between items-baseline mb-4">
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">
                $
                {currentAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-gray-600 mt-1">
                raised of $
                {goal.targetAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                goal
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-600">
                {progressPercent.toFixed(0)}%
              </p>
              <p className="text-sm text-gray-500">
                {donations.filter((d) => d.status === 'completed').length}{' '}
                donations
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-6">
            <div
              className="absolute h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Milestone markers */}
            {milestonePositions.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 h-full w-1 bg-white"
                style={{ left: `${m.position}%` }}
              />
            ))}
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            {milestonePositions.map((m, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  m.reached
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  {m.reached ? (
                    <svg
                      className="w-5 h-5 text-green-600 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full mr-3" />
                  )}
                  <span
                    className={`font-medium ${m.reached ? 'text-green-900' : 'text-gray-700'}`}
                  >
                    {m.name}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${m.reached ? 'text-green-700' : 'text-gray-600'}`}
                >
                  $
                  {m.targetAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
          </div>

          {/* Donate Button */}
          <button
            onClick={handleDonate}
            disabled={isDonating}
            className="w-full mt-6 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {isDonating ? 'Processing...' : 'Donate Now'}
          </button>
        </div>

        {/* Donation Feed */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Recent Donations
          </h2>
          {donations.filter((d) => d.status === 'completed').length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No donations yet. Be the first to donate!
            </p>
          ) : (
            <div className="space-y-4">
              {donations
                .filter((d) => d.status === 'completed')
                .map((donation) => (
                  <div
                    key={donation.id}
                    className="border-b border-gray-100 pb-4 last:border-0"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold text-gray-900">
                        {donation.donorName || 'Anonymous'}
                      </p>
                      <p className="font-bold text-purple-600">
                        $
                        {donation.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    {donation.message && (
                      <p className="text-gray-600 text-sm mb-2">
                        {donation.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(donation.createdAt).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }
                      )}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { GoalPage }
