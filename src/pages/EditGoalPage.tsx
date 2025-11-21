import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import bcrypt from 'bcryptjs'
import Swal from 'sweetalert2'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

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

export function EditGoalPage() {
  const { goalId, password } = useParams<{ goalId: string; password: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [goal, setGoal] = useState<{
    id: string
    name: string
    description: string | null
    targetAmount: number
    stripeAccountId: string
  } | null>(null)
  const [existingMilestones, setExistingMilestones] = useState<
    Array<{ id: string; name: string; targetAmount: number; order: number }>
  >([])
  const [milestones, setMilestones] = useState<
    Array<{ id?: string; name: string; targetAmount: number }>
  >([])
  const [showSuccess, setShowSuccess] = useState(
    searchParams.get('created') === 'true'
  )
  const [showPreview, setShowPreview] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      description: '',
      targetAmount: 0,
      milestones: [],
    },
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

  const publicUrl = `${window.location.origin}/goal/${goalId}`
  const editUrl = `${window.location.origin}/goal/${goalId}/edit/${password}`

  useEffect(() => {
    loadGoal()

    // Subscribe to goal updates
    const goalSub = client.models.Goal.observeQuery({
      filter: { id: { eq: goalId! } },
    }).subscribe({
      next: ({ items }) => {
        if (items[0]) {
          setGoal(items[0])
        }
      },
    })

    // Subscribe to milestone updates
    const milestoneSub = client.models.Milestone.observeQuery({
      filter: { goalId: { eq: goalId! } },
    }).subscribe({
      next: ({ items }) => {
        const sorted = items.sort((a, b) => a.order - b.order)
        setExistingMilestones(sorted)
        setMilestones(
          sorted.map((m) => ({
            id: m.id,
            name: m.name,
            targetAmount: m.targetAmount,
          }))
        )

        // Update form values
        sorted.forEach((m, index) => {
          setValue(`milestones.${index}.name`, m.name)
          setValue(`milestones.${index}.targetAmount`, m.targetAmount)
        })
      },
    })

    return () => {
      goalSub.unsubscribe()
      milestoneSub.unsubscribe()
    }
  }, [goalId])

  const loadGoal = async () => {
    try {
      const result = await client.models.Goal.get({ id: goalId! })

      if (!result.data) {
        await Swal.fire({
          icon: 'error',
          title: 'Goal Not Found',
          text: 'This goal does not exist.',
        })
        navigate('/')
        return
      }

      const isValid = await bcrypt.compare(password!, result.data.editPassword)
      if (!isValid) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Password',
          text: 'The edit password is incorrect.',
        })
        navigate('/')
        return
      }

      setGoal(result.data)

      // Load milestones
      const milestonesResult = await client.models.Milestone.list({
        filter: { goalId: { eq: goalId! } },
      })

      const sortedMilestones = (milestonesResult.data || []).sort(
        (a, b) => a.order - b.order
      )
      setExistingMilestones(sortedMilestones)
      setMilestones(
        sortedMilestones.map((m) => ({
          id: m.id,
          name: m.name,
          targetAmount: m.targetAmount,
        }))
      )

      // Populate form with reset for proper reactivity
      reset({
        name: result.data.name,
        description: result.data.description || '',
        targetAmount: result.data.targetAmount,
        milestones: sortedMilestones.map((m) => ({
          name: m.name,
          targetAmount: m.targetAmount,
        })),
      })
    } catch (error) {
      console.error('Error loading goal:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load goal. Please try again.',
      })
      navigate('/')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    Swal.fire({
      icon: 'success',
      title: 'Copied!',
      text: `${label} copied to clipboard`,
      timer: 2000,
      showConfirmButton: false,
    })
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
      // Update goal
      await client.models.Goal.update({
        id: goalId!,
        name: data.name,
        description: data.description || '',
        targetAmount: data.targetAmount,
      })

      // Delete old milestones
      await Promise.all(
        existingMilestones.map((m) =>
          client.models.Milestone.delete({ id: m.id })
        )
      )

      // Create new milestones
      await Promise.all(
        data.milestones.map((milestone, index) =>
          client.models.Milestone.create({
            goalId: goalId!,
            name: milestone.name,
            targetAmount: milestone.targetAmount,
            order: index,
          })
        )
      )

      await Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Goal updated successfully',
        timer: 2000,
        showConfirmButton: false,
      })
      await loadGoal()
    } catch (error) {
      console.error('Error updating goal:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update goal. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Success Banner */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border-2 border-green-500 rounded-2xl p-6 shadow-lg overflow-hidden">
            <div className="flex items-start">
              <svg
                className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-green-900 mb-2">
                  🎉 Goal Created Successfully!
                </h3>
                <p className="text-sm text-green-800 mb-4">
                  Your fundraising goal is live! Here are your important links:
                </p>

                {/* Public URL */}
                <div className="bg-white rounded-lg p-4 mb-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">
                    Public URL (Share this with donors)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono truncate">
                      {publicUrl}
                    </div>
                    <button
                      onClick={() => copyToClipboard(publicUrl, 'Public URL')}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium flex-shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Edit URL */}
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <label className="text-xs font-semibold text-yellow-800 uppercase mb-1 block">
                    ⚠️ Edit URL (Save this - you won't see it again!)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 bg-white border border-yellow-300 rounded text-sm font-mono truncate">
                      {editUrl}
                    </div>
                    <button
                      onClick={() => copyToClipboard(editUrl, 'Edit URL')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm font-medium flex-shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-yellow-800 mt-2">
                    Bookmark this URL or save it somewhere safe. This is the
                    only way to edit your goal!
                  </p>
                </div>

                <button
                  onClick={() => setShowSuccess(false)}
                  className="mt-4 text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/goal/${goalId}`)}
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
            View Public Page
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Edit {goal?.name}
          </h1>
        </div>

        {/* Edit Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
        >
          {/* Bank Account Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
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
              <span className="text-sm font-medium text-blue-900">
                Bank account connected: {goal?.stripeAccountId?.slice(-8)}
              </span>
            </div>
          </div>

          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goal Name *
            </label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Description (Markdown supported)
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
            <textarea
              {...register('description')}
              rows={5}
              placeholder="Tell your story... (supports **bold**, *italic*, [links](url), etc.)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {showPreview && watch('description') && (
              <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {watch('description')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
