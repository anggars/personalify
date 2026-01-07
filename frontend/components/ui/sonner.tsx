"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-white/10 dark:group-[.toaster]:bg-white/[0.015] group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-white/10 dark:group-[.toaster]:border-white/8 group-[.toaster]:backdrop-blur-md group-[.toaster]:[box-shadow:inset_0_1px_2px_0_rgba(255,255,255,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2),0_4px_15px_rgba(0,0,0,0.3)]",
                    description: "group-[.toast]:text-muted-foreground",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                    error:
                        "group-[.toaster]:bg-white/10 dark:group-[.toaster]:bg-white/[0.015] group-[.toaster]:text-red-600 dark:group-[.toaster]:text-red-400 group-[.toaster]:border group-[.toaster]:border-white/10 dark:group-[.toaster]:border-white/8 group-[.toaster]:backdrop-blur-md group-[.toaster]:[box-shadow:inset_0_1px_2px_0_rgba(255,255,255,0.15),inset_0_1px_1px_0_rgba(255,255,255,0.2),0_4px_15px_rgba(0,0,0,0.3)]",
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
