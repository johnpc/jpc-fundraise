import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import ReactMarkdown from 'react-markdown'

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

interface CreateGoalFormProps {
  onClose: () => void
}

export function CreateGoalForm({ onClose }: CreateGoalFormProps) {
  const [milestones, setMilestones] = useState<
    Array<{ name: string; targetAmount: number }>
  >([{ name: '', targetAmount: 0 }])
  const [showPreview, setShowPreview] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  })

  const addMilestone = () => {
    setMilestones([...milestones, { name: '', targetAmount: 0 }])
  }

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: GoalFormData) => {
    console.log('Creating goal:', data)
    // TODO: Implement Stripe Connect and goal creation
    alert('Goal creation coming soon! Need to implement Stripe Connect first.')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Create Your Goal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Goal Name *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g., Dream Honeymoon"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {showPreview && watch('description') && (
              <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Preview:</p>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{watch('description')}</ReactMarkdown>
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
              <span className="absolute left-4 top-2 text-gray-500">$</span>
              <input
                {...register('targetAmount', { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="5000.00"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
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
                <div key={index} className="flex gap-2">
                  <input
                    {...register(`milestones.${index}.name`)}
                    type="text"
                    placeholder="e.g., Flights"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                  <div className="relative w-32">
                    <span className="absolute left-3 top-2 text-gray-500">
                      $
                    </span>
                    <input
                      {...register(`milestones.${index}.targetAmount`, {
                        valueAsNumber: true,
                      })}
                      type="number"
                      step="0.01"
                      placeholder="1000"
                      className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                  </div>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg
                        className="w-6 h-6"
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
              ))}
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
            >
              + Add Milestone
            </button>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg"
            >
              Create Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
