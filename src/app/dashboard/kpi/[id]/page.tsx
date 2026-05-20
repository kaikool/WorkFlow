'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TodoDetail } from '../../tasks/_components/todos/TodoDetail'

function KpiDetail() {
  const { id } = useParams<{ id: string }>()
  return <TodoDetail id={id} tableName="kpis" />
}

export default function KpiDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <KpiDetail />
    </Suspense>
  )
}
