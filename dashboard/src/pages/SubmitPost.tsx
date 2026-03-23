import { useState } from 'react'
import { SubmitPostModal } from '@/components/dashboard/SubmitPostModal'
import { useNavigate } from 'react-router-dom'

export function SubmitPost() {
  const [show] = useState(true)
  const navigate = useNavigate()

  return (
    <div>
      {show && (
        <SubmitPostModal
          onClose={() => navigate('/dashboard')}
          onSubmitted={() => navigate('/dashboard')}
        />
      )}
    </div>
  )
}
