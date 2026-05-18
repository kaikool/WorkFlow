import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth-utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function Layout({ children }: { children: React.ReactNode }) {
 const profile = await getProfile()

 if (!profile) {
 redirect('/login')
 }

 return <DashboardLayout profile={profile}>{children}</DashboardLayout>
}