'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

// Hàm chuyển đổi base64 sang Uint8Array cho VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setSubscription(sub)
        })
      })
    }
  }, [])

  const subscribe = async () => {
    if (!isSupported) return

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') return

      const registration = await navigator.serviceWorker.ready

      // LƯU Ý: Đây là Public VAPID Key mẫu. Bạn nên thay thế bằng key thật tạo từ web-push.
      const vapidPublicKey = 'BMrB4OsYykGNB-obiz87ohdge-1X8KmbrVlmGx8943di9qTvMoSQjMbUFu8HdxnU8UA7o5L3CZ93W2sDuUEkEtg'
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          subscription: sub.toJSON(),
          device_info: navigator.userAgent
        }, {
          onConflict: 'user_id, subscription'
        })
      }

      setSubscription(sub)
      return sub
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
    }
  }

  const unsubscribe = async () => {
    if (!subscription) return

    try {
      await subscription.unsubscribe()

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .match({ user_id: user.id, subscription: subscription.toJSON() })
      }

      setSubscription(null)
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
    }
  }

  return {
    isSupported,
    subscription,
    permission,
    subscribe,
    unsubscribe
  }
}
