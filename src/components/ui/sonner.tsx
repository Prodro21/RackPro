import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--bg-elevated)",
          "--normal-text": "var(--text-primary)",
          "--normal-border": "var(--border-default)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
