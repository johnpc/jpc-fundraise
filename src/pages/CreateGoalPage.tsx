import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import outputs from '../../amplify_outputs.json'
import bcrypt from 'bcryptjs'
import Swal from 'sweetalert2'
import { Footer } from '../components/Footer'

const client = generateClient<Schema>()

const milestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required'),
  targetAmount: z.number().min(0.01, 'Amount must be greater than 0'),
})

const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required'),
  description: z.string().optional(),
  targetAmount: z.number().min(0.01, 'Target amount must be greater than 0'),
  milestones: z.array(milestoneSchema).min(1, 'Add at least one milestone'),
})

type GoalFormData = z.infer<typeof goalSchema>

export function CreateGoalPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [isConnectingStripe, setIsConnectingStripe] = useState(false)
  const [milestones, setMilestones] = useState<
    Array<{ name: string; targetAmount: number }>
  >([{ name: '', targetAmount: 0 }])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  })

  const watchedTarget = watch('targetAmount') || 0

  const watchedMilestones = milestones.map((_, index) => ({
    name: watch(`milestones.${index}.name`) || '',
    targetAmount: watch(`milestones.${index}.targetAmount`) || 0,
  }))

  const milestoneRunningTotals = useMemo(() => {
    let runningTotal = 0
    return watchedMilestones.map((m) => {
      const amount = Number(m.targetAmount) || 0
      runningTotal += amount
      return runningTotal
    })
  }, [watchedMilestones])

  const totalMilestoneAmount =
    milestoneRunningTotals[milestoneRunningTotals.length - 1] || 0
  const remaining = watchedTarget - totalMilestoneAmount

  // Check if returning from Stripe Connect
  useEffect(() => {
    const accountId = searchParams.get('account')
    if (accountId) {
      setStripeAccountId(accountId)
    }
  }, [searchParams])

  const handleStripeConnect = async () => {
    setIsConnectingStripe(true)
    try {
      const functionUrl = (
        outputs as { custom?: { stripeConnectUrl?: string } }
      ).custom?.stripeConnectUrl

      if (!functionUrl) {
        throw new Error('Stripe Connect function not deployed')
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No URL returned from Stripe')
      }
    } catch (error) {
      console.error('Stripe Connect error:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Connection Failed',
        text: `Failed to start bank account connection.\n\nError: ${(error as Error).message}`,
      })
      setIsConnectingStripe(false)
    }
  }

  const addMilestone = () => {
    setMilestones([...milestones, { name: '', targetAmount: 0 }])
  }

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: GoalFormData) => {
    if (Math.abs(totalMilestoneAmount - watchedTarget) > 0.01) {
      await Swal.fire({
        icon: 'warning',
        title: 'Milestone Mismatch',
        text: `Milestone amounts ($${totalMilestoneAmount.toFixed(2)}) must equal your target ($${watchedTarget.toFixed(2)})`,
      })
      return
    }

    setIsSubmitting(true)

    try {
      const editPassword =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2)
      const hashedPassword = await bcrypt.hash(editPassword, 10)

      const goalResult = await client.models.Goal.create({
        name: data.name,
        description: data.description || '',
        targetAmount: data.targetAmount,
        stripeAccountId: stripeAccountId!,
        editPassword: hashedPassword,
      })

      if (!goalResult.data) {
        throw new Error('Failed to create goal')
      }

      const goalId = goalResult.data.id

      await Promise.all(
        data.milestones.map((milestone, index) =>
          client.models.Milestone.create({
            goalId,
            name: milestone.name,
            targetAmount: milestone.targetAmount,
            order: index,
          })
        )
      )

      navigate(`/goal/${goalId}/edit/${editPassword}?created=true`)
    } catch (error) {
      console.error('Error creating goal:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Creation Failed',
        text: 'Failed to create goal. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // If no Stripe account connected, show connect flow only
  if (!stripeAccountId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
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
            Back
          </button>

          <div className="bg-white rounded-2xl shadow-sm p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Connect Your Bank Account
            </h1>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Before creating your goal, connect your bank account so donations
              can be sent directly to you. This takes about 2 minutes.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-blue-900 mb-3">
                What you'll need:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
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
                  Bank account and routing number
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
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
                  Personal information for identity verification
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0"
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
                  Social Security Number (for tax reporting)
                </li>
              </ul>
            </div>

            <button
              onClick={handleStripeConnect}
              disabled={isConnectingStripe}
              className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg text-lg disabled:opacity-50"
            >
              {isConnectingStripe ? 'Connecting...' : 'Connect Bank Account'}
            </button>

            <p className="text-xs text-gray-500 mt-6">
              Secured by Stripe • Your information is encrypted and never shared
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
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
            Back
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Create Your Goal
          </h1>
          <p className="text-gray-600 mt-2">
            Tell us about your dream and break it into milestones
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
        >
          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goal Name *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g., Dream Honeymoon"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-base"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Tell your story... Why is this goal important to you?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-base"
            />
          </div>

          {/* Target Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Target Amount *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-500 text-lg">
                $
              </span>
              <input
                {...register('targetAmount', { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="5000.00"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-base"
              />
            </div>
            {errors.targetAmount && (
              <p className="text-red-500 text-sm mt-1">
                {errors.targetAmount.message}
              </p>
            )}
          </div>

          {/* Milestones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Milestones *
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                💡 <strong>How it works:</strong> Enter the{' '}
                <strong>amount for each milestone</strong> (not cumulative). For
                example: Flights $1,000, Hotel $1,500, Activities $500. We'll
                show the running total as you go!
              </p>
            </div>

            <div className="space-y-3">
              {milestones.map((_, index) => (
                <div key={index}>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      {...register(`milestones.${index}.name`)}
                      type="text"
                      placeholder="e.g., Flights"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-base"
                    />
                    <div className="flex gap-2 items-start">
                      <div className="relative flex-1 sm:w-36">
                        <span className="absolute left-3 top-3.5 text-gray-500">
                          $
                        </span>
                        <input
                          {...register(`milestones.${index}.targetAmount`, {
                            valueAsNumber: true,
                          })}
                          type="number"
                          step="0.01"
                          placeholder="1000"
                          className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-base"
                        />
                      </div>
                      <div className="hidden sm:flex items-center px-3 py-3 bg-purple-50 rounded-lg min-w-[100px]">
                        <span className="text-sm font-medium text-purple-700">
                          → $
                          {milestoneRunningTotals[index]?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      {milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(index)}
                          className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Running total indicator for mobile */}
                  <p className="text-sm text-purple-700 font-medium mt-1 ml-1 sm:hidden">
                    Running total: $
                    {milestoneRunningTotals[index]?.toFixed(2) || '0.00'}
                  </p>
                </div>
              ))}
            </div>

            {/* Final milestone preview */}
            {watchedTarget > 0 && totalMilestoneAmount > 0 && (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    🎉 Goal Reached!
                  </span>
                  <span className="font-semibold text-purple-600">
                    ${watchedTarget.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  This milestone will be added automatically when you reach your
                  goal
                </p>
              </div>
            )}

            {/* Total validation */}
            {watchedTarget > 0 && totalMilestoneAmount > 0 && (
              <div
                className={`mt-4 p-4 rounded-lg ${
                  Math.abs(remaining) < 0.01
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {Math.abs(remaining) < 0.01
                      ? '✓ Perfect!'
                      : '⚠️ Milestone total:'}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      Math.abs(remaining) < 0.01
                        ? 'text-green-700'
                        : 'text-yellow-700'
                    }`}
                  >
                    ${totalMilestoneAmount.toFixed(2)} / $
                    {watchedTarget.toFixed(2)}
                  </span>
                </div>
                {Math.abs(remaining) >= 0.01 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    {remaining > 0
                      ? `Add $${remaining.toFixed(2)} more to reach your target`
                      : `Remove $${Math.abs(remaining).toFixed(2)} to match your target`}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={addMilestone}
              className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center"
            >
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Milestone
            </button>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              disabled={isSubmitting}
              className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-base disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg text-base disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>

        <Footer />
      </div>
    </div>
  )
}
