import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react'

export interface JobQuestion {
  id?: string
  question: string
  question_type: 'yes_no' | 'text' | 'number' | 'dropdown' | 'multiple_choice'
  options: string[]
  required: boolean
  order_index: number
}

interface Props {
  questions: JobQuestion[]
  onChange: (questions: JobQuestion[]) => void
}

const PRESET_QUESTIONS = [
  { question: 'Are you legally authorized to work in Jamaica?', question_type: 'yes_no' as const },
  { question: 'Do you have a valid driver\'s license?', question_type: 'yes_no' as const },
  { question: 'Are you willing to relocate?', question_type: 'yes_no' as const },
  { question: 'Are you available to start immediately?', question_type: 'yes_no' as const },
  { question: 'Do you have reliable transportation?', question_type: 'yes_no' as const },
  { question: 'Are you comfortable working in a team environment?', question_type: 'yes_no' as const },
  { question: 'What is your highest level of education?', question_type: 'dropdown' as const, options: ['High School Diploma', 'Associate Degree', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Professional Certification'] },
  { question: 'What is your expected salary range (JMD)?', question_type: 'text' as const },
  { question: 'How many years of relevant experience do you have?', question_type: 'number' as const },
  { question: 'What is your current employment status?', question_type: 'dropdown' as const, options: ['Employed Full-time', 'Employed Part-time', 'Self-employed', 'Unemployed', 'Student'] },
  { question: 'Are you willing to work overtime when required?', question_type: 'yes_no' as const },
  { question: 'Have you previously worked for this organization?', question_type: 'yes_no' as const },
]

const TYPE_LABELS: Record<string, string> = {
  yes_no: 'Yes / No',
  text: 'Short Text',
  number: 'Number',
  dropdown: 'Dropdown',
  multiple_choice: 'Multiple Choice',
}

export default function JobQuestionsManager({ questions, onChange }: Props) {
  const [showPresets, setShowPresets] = useState(false)
  const [optionInput, setOptionInput] = useState<Record<number, string>>({})

  function addQuestion() {
    onChange([...questions, {
      question: '',
      question_type: 'yes_no',
      options: [],
      required: false,
      order_index: questions.length
    }])
  }

  function addPreset(preset: typeof PRESET_QUESTIONS[0]) {
    const already = questions.find(q => q.question === preset.question)
    if (already) return
    onChange([...questions, {
      question: preset.question,
      question_type: preset.question_type,
      options: (preset as any).options || [],
      required: false,
      order_index: questions.length
    }])
  }

  function updateQuestion(index: number, field: keyof JobQuestion, value: any) {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  function removeQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index))
  }

  function addOption(index: number) {
    const val = optionInput[index]?.trim()
    if (!val) return
    const updated = [...questions]
    updated[index] = { ...updated[index], options: [...(updated[index].options || []), val] }
    onChange(updated)
    setOptionInput(prev => ({ ...prev, [index]: '' }))
  }

  function removeOption(qIndex: number, optIndex: number) {
    const updated = [...questions]
    updated[qIndex] = { ...updated[qIndex], options: updated[qIndex].options.filter((_, i) => i !== optIndex) }
    onChange(updated)
  }

  return (
    <div>
      {/* Preset questions */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="btn-secondary"
          style={{ fontSize: '0.875rem', width: '100%', justifyContent: 'space-between' }}>
          <span>+ Add from Preset Questions</span>
          <ChevronDown size={15} style={{ transform: showPresets ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {showPresets && (
          <div style={{ marginTop: '0.5rem', background: 'var(--navy-900)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {PRESET_QUESTIONS.map((preset, i) => {
              const alreadyAdded = questions.some(q => q.question === preset.question)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', borderBottom: i < PRESET_QUESTIONS.length - 1 ? '1px solid var(--border)' : 'none', opacity: alreadyAdded ? 0.4 : 1 }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{preset.question}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{TYPE_LABELS[preset.question_type]}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addPreset(preset)}
                    disabled={alreadyAdded}
                    style={{ background: alreadyAdded ? 'var(--navy-700)' : 'rgba(37,99,235,0.15)', border: 'none', color: alreadyAdded ? 'var(--text-muted)' : 'var(--blue-400)', borderRadius: '6px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem', cursor: alreadyAdded ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {alreadyAdded ? 'Added ✓' : '+ Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Current questions */}
      {questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', background: 'var(--navy-900)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '0.875rem' }}>
          No questions added yet. Add from presets above or create a custom question.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {questions.map((q, i) => (
            <div key={i} style={{ background: 'var(--navy-900)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <GripVertical size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--blue-400)', borderRadius: '4px', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: '500' }}>Q{i + 1}</span>
                <div style={{ flex: 1 }} />
                {/* Required toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', color: q.required ? '#10b981' : 'var(--text-muted)' }}>
                  <div
                    onClick={() => updateQuestion(i, 'required', !q.required)}
                    style={{ width: '32px', height: '18px', borderRadius: '9px', background: q.required ? '#10b981' : 'var(--navy-700)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '2px', left: q.required ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                  </div>
                  Required
                </label>
                <button type="button" onClick={() => removeQuestion(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.25rem' }}>
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Question text */}
              <div className="form-group" style={{ marginBottom: '0.625rem' }}>
                <input
                  className="input"
                  value={q.question}
                  onChange={e => updateQuestion(i, 'question', e.target.value)}
                  placeholder="Enter your question..."
                  style={{ fontSize: '0.875rem' }}
                />
              </div>

              {/* Question type */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateQuestion(i, 'question_type', type)}
                    style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid', fontSize: '0.75rem', cursor: 'pointer', background: q.question_type === type ? 'rgba(37,99,235,0.2)' : 'transparent', borderColor: q.question_type === type ? 'var(--blue-500)' : 'var(--border)', color: q.question_type === type ? 'var(--blue-400)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Options for dropdown/multiple choice */}
              {(q.question_type === 'dropdown' || q.question_type === 'multiple_choice') && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label className="label" style={{ fontSize: '0.75rem' }}>Answer Options</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    {(q.options || []).map((opt, optI) => (
                      <span key={optI} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--navy-800)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.625rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {opt}
                        <button type="button" onClick={() => removeOption(i, optI)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input"
                      value={optionInput[i] || ''}
                      onChange={e => setOptionInput(prev => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption(i))}
                      placeholder="Add option and press Enter"
                      style={{ fontSize: '0.8125rem' }}
                    />
                    <button type="button" className="btn-secondary" onClick={() => addOption(i)} style={{ padding: '0.5rem 0.75rem' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add custom question */}
      <button type="button" onClick={addQuestion} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.875rem' }}>
        <Plus size={15} /> Add Custom Question
      </button>
    </div>
  )
}
