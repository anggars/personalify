import { cn } from "./utils";

export const placeholders = {
  // A glowing, animated gradient to feel premium instead of a static box
  wrapper: cn(
    "relative overflow-hidden bg-neutral-100 dark:bg-neutral-800",
    "before:absolute before:inset-0",
    "before:-translate-x-full before:animate-[shimmer_2s_infinite]",
    "before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/10 before:to-transparent"
  ),
  iconColor: "text-neutral-400 dark:text-neutral-500",
  iconSize: "w-1/2 h-1/2",
};
