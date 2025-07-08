"use client"

import type { Call } from "@/types"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts"

interface CategoryChartProps {
  calls: Call[]
}

export default function CategoryChart({ calls }: CategoryChartProps) {
  const data = useMemo(() => {
    const categoryCounts = calls.reduce((acc, call) => {
      const category = call.category || "Uncategorized"
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryCounts).map(([name, total]) => ({ name, total }))
  }, [calls])

  if (data.length === 0) {
    return (
        <div className="flex items-center justify-center h-[350px] w-full text-muted-foreground">
            No category data to display.
        </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'hsla(var(--accent), 0.2)' }}
          contentStyle={{ 
            background: 'hsl(var(--background))', 
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)'
          }}
        />
        <Bar dataKey="total" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} >
           <LabelList dataKey="total" position="top" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
