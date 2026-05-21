"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
 React.ElementRef<typeof SwitchPrimitives.Root>,
 React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
 <SwitchPrimitives.Root
 className={cn(
 className,
 "group peer relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
 )}
 {...props}
 ref={ref}
 >
 <span className="pointer-events-none absolute left-1/2 top-1/2 h-[22px] w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-input transition-colors group-data-[state=checked]:bg-primary" />
 <SwitchPrimitives.Thumb
 className={cn(
 "pointer-events-none absolute left-[5px] top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0"
 )}
 />
 </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
