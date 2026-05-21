"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeZaloCodeForToken, getZaloUserProfile } from "@/app/lib/integrations";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

function ZaloCallbackContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const { toast } = useToast();
 const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
 const [errorMsg, setErrorMsg] = useState("");

 useEffect(() => {
 const code = searchParams.get("code");
 
 if (!code) {
 setStatus("error");
 setErrorMsg("Không tìm thấy mã xác thực từ Zalo.");
 return;
 }

 const processZaloLogin = async () => {
 const tokenRes = await exchangeZaloCodeForToken(code);
 
 if (!tokenRes.success) {
 setStatus("error");
 setErrorMsg(tokenRes.message);
 toast({ variant: "destructive", title: "Lỗi xác thực", description: tokenRes.message });
 return;
 }

 const profileRes = await getZaloUserProfile(tokenRes.data.access_token);
 
 if (!profileRes.success) {
 setStatus("error");
 setErrorMsg(profileRes.message);
 toast({ variant: "destructive", title: "Lỗi truy vấn Profile", description: profileRes.message });
 return;
 }

 const userData = {
 name: profileRes.data.name,
 ad: `zalo.${profileRes.data.id}`,
 isAdmin: false,
 avatar: profileRes.data.picture?.data?.url
 };

 localStorage.setItem('userRole', 'staff');
 localStorage.setItem('currentUser', JSON.stringify(userData));
 
 setStatus("success");
 toast({
 title: "Xác thực thành công",
 description: `Chào mừng cán bộ ${userData.name}.`
 });

 setTimeout(() => {
 router.push("/dashboard");
 }, 1500);
 };

 processZaloLogin();
 }, [searchParams, router, toast]);

 return (
 <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
 {status === "processing" && (
 <div className="space-y-4 animate-in fade-in">
 <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
 <h2 className="text-xl font-bold text-slate-800 tabular-nums">Đang hoàn tất xác thực...</h2>
 <p className="text-slate-500">Đang đồng bộ hồ sơ cán bộ.</p>
 </div>
 )}

 {status === "success" && (
 <div className="space-y-4 animate-in zoom-in">
 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
 <ShieldCheck className="w-8 h-8 text-green-600" />
 </div>
 <h2 className="text-xl font-bold text-green-600 tabular-nums">Xác thực thành công!</h2>
 <p className="text-slate-500">Hệ thống đang chuyển hướng bạn về Portal...</p>
 </div>
 )}

 {status === "error" && (
 <div className="space-y-4 animate-in shake">
 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
 <AlertCircle className="w-8 h-8 text-red-600" />
 </div>
 <h2 className="text-xl font-bold text-red-600 tabular-nums">Xác thực thất bại</h2>
 <p className="text-slate-500 max-w-sm">{errorMsg}</p>
 <Button
 onClick={() => router.push("/")}
 className="mt-4 rounded-xl px-6 font-bold"
 >
 Quay lại trang đăng nhập
 </Button>
 </div>
 )}
 </div>
 );
}

export default function ZaloCallbackPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center">
 <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
 <h2 className="text-xl font-bold text-slate-800 tabular-nums">Đang tải...</h2>
 </div>
 }>
 <ZaloCallbackContent />
 </Suspense>
 );
}
