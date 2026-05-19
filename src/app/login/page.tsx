'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import {
  Workflow,
  Loader2,
  Lock,
  Mail,
  User,
  Building2,
  Briefcase,
  Clock,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('staff')
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isPendingApproval, setIsPendingApproval] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  // Lấy danh sách phòng ban từ Database khi bật chế độ đăng ký
  useEffect(() => {
    if (isSignUp) {
      fetchDepartments()
    }
  }, [isSignUp])

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name')
      if (error) throw error
      setDepartments(data || [])
      if (data && data.length > 0) {
        setDepartmentId(data[0].id)
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách phòng ban:', err)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Tự động gán domain ảo nếu người dùng đăng nhập bằng Username (không có ký tự @)
    const finalEmail = email.includes('@') ? email.trim() : `${email.trim()}@bank.local`

    try {
      if (isSignUp) {
        // Gửi yêu cầu đăng ký vào bảng account_requests
        const { error } = await supabase
          .from('account_requests')
          .insert({
            full_name: fullName,
            email: finalEmail,
            role,
            department_id: departmentId,
            password // Lưu mật khẩu để Admin duyệt sẽ tạo tài khoản Auth
          })

        if (error) {
          if (error.code === '23505') {
            throw new Error('Tên đăng nhập này đã được đăng ký hoặc đang chờ phê duyệt.')
          }
          throw error
        }

        setIsPendingApproval(true)
        toast({
          title: "Đã gửi yêu cầu",
          description: "Yêu cầu cấp tài khoản mới của bạn đã được chuyển tới Quản trị viên.",
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password,
        })
        if (error) throw error

        router.refresh()
        setTimeout(() => {
          router.push('/dashboard')
        }, 100)
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi xác thực",
        description: error.message || "Đã có lỗi xảy ra, vui lòng thử lại.",
      })
    } finally {
      setLoading(false)
    }
  }

  // MÀN HÌNH TRẠNG THÁI CHỜ DUYỆT LỘNG LẪY (PREMIUM CARD)
  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] opacity-60" />
        </div>

        <div className="w-full max-w-md z-10 flex flex-col items-center gap-8 animate-fade-in-up">
          <Card className="w-full shadow-2xl border-none rounded-[2.5rem] bg-white/90 backdrop-blur-xl overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-primary/5 relative">
              <Clock className="w-10 h-10 animate-pulse text-primary" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-ping" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Yêu cầu đã được gửi!</h2>
              <p className="text-slate-500 text-xs font-semibold leading-relaxed px-2">
                Yêu cầu của bạn đã được gửi tới Quản trị viên. Tài khoản sẽ được kích hoạt sau khi có phê duyệt. Chúng tôi sẽ gửi thông báo qua email của bạn.
              </p>
            </div>

            {/* Thông tin tóm tắt yêu cầu */}
            <div className="bg-slate-50 p-4 rounded-2xl text-left text-[11px] font-bold text-slate-500 space-y-2.5 border border-slate-100 uppercase tracking-wider">
              <div className="flex justify-between items-center">
                <span>Họ và tên</span>
                <span className="text-slate-900 font-extrabold">{fullName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Tên đăng nhập</span>
                <span className="text-slate-900 font-extrabold normal-case">{email.includes('@') ? email.split('@')[0] : email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Chức danh</span>
                <span className="text-slate-900 font-extrabold">{role === 'manager' ? 'Lãnh đạo phòng' : 'Cán bộ'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Phòng ban công tác</span>
                <span className="text-slate-900 font-extrabold">{departments.find(d => d.id === departmentId)?.name || 'Chưa chọn'}</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setIsSignUp(false)
                setIsPendingApproval(false)
                setEmail('')
                setPassword('')
                setFullName('')
              }}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs uppercase"
            >
              Quay lại Đăng nhập
            </Button>
          </Card>
          <p className="text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col items-center gap-8">
        <Card className="w-full shadow-2xl border-none rounded-[2.5rem] bg-white/80 backdrop-blur-xl overflow-hidden transition-all duration-500">
          <CardHeader className="space-y-1 flex flex-col items-center p-8 pb-4">
            <div className="mb-3 transition-transform hover:scale-105 flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight">
              WorkFlow Portal
            </CardTitle>
            <CardDescription className="text-center font-semibold text-xs text-slate-500">
              {isSignUp ? 'YÊU CẦU CẤP TÀI KHOẢN MỚI' : 'QUẢN LÝ CÔNG VIỆC NỘI BỘ CHI NHÁNH NGÂN HÀNG'}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleAuth}>
            <CardContent className="p-8 pt-4 space-y-4">
              {/* Chế độ Đăng ký: Thêm Họ tên, Chức danh, Phòng ban */}
              {isSignUp && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Họ và tên */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-[10px] font-bold uppercase text-slate-500 ml-1 tracking-wider">Họ và tên</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Nguyễn Văn A"
                        className="pl-11 h-12 bg-slate-50 border-none rounded-xl font-medium text-sm"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={isSignUp}
                      />
                    </div>
                  </div>

                  {/* Chức danh (Role) */}
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-[10px] font-bold uppercase text-slate-500 ml-1 tracking-wider">Chức danh</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="pl-11 h-12 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-950 focus:ring-0">
                          <SelectValue placeholder="Chọn chức danh" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-premium p-2">
                          <SelectItem value="staff" className="rounded-xl py-3 font-semibold">Cán bộ</SelectItem>
                          <SelectItem value="manager" className="rounded-xl py-3 font-semibold">Lãnh đạo phòng</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Phòng ban công tác */}
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-[10px] font-bold uppercase text-slate-500 ml-1 tracking-wider">Phòng ban công tác</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
                      <Select value={departmentId} onValueChange={setDepartmentId}>
                        <SelectTrigger className="pl-11 h-12 bg-slate-50 border-none rounded-xl font-medium text-sm text-slate-950 focus:ring-0">
                          <SelectValue placeholder="Chọn phòng ban" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-premium p-2 max-h-48 overflow-y-auto">
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id} className="rounded-xl py-3 font-semibold">
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase text-slate-500 ml-1 tracking-wider">Tên đăng nhập</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="VD: UserAD"
                    className="pl-11 h-12 bg-slate-50 border-none rounded-xl font-medium text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase text-slate-500 ml-1 tracking-wider">Mật khẩu</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-11 h-12 bg-slate-50 border-none rounded-xl font-medium text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-0 flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs uppercase"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ĐANG XỬ LÝ...
                  </>
                ) : (
                  isSignUp ? 'GỬI YÊU CẦU CẤP TÀI KHOẢN' : 'ĐĂNG NHẬP'
                )}
              </Button>

              <button
                type="button"
                className="text-xs font-bold text-slate-500 hover:text-primary transition-colors duration-300 cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setEmail('')
                  setPassword('')
                  setFullName('')
                }}
              >
                {isSignUp ? (
                  <>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Tôi đã có tài khoản? Đăng nhập
                  </>
                ) : (
                  'Yêu cầu cấp tài khoản mới'
                )}
              </button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-[11px] font-medium text-slate-500 italic">made by phuctd</p>
      </div>
    </div>
  )
}
