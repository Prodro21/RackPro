import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-text-primary placeholder:text-text-tertiary selection:bg-accent selection:text-white bg-bg-input border-border-default text-text-primary flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        "focus-visible:border-border-focus focus-visible:ring-border-focus/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-danger/20 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
