import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

export function SelectField({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-field">
      <select {...props} className={className ? `field ${className}` : 'field'} />
      <ChevronDown aria-hidden="true" strokeWidth={1.75} />
    </div>
  )
}
