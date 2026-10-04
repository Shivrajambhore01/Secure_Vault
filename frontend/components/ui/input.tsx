import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-2 text-sm text-white placeholder:text-zinc-500 shadow-sm transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
