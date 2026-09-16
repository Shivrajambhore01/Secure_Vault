import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-full border border-black/15 bg-white px-4 py-2 text-sm text-black placeholder:text-neutral-400 shadow-2xs transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-black focus:ring-2 focus:ring-black/10',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
