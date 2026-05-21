'use client'

import React, { useState } from "react";
import { Users, ChevronDown, X, Check, Building2, UserCog, UserCheck, ShieldCheck } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { filterBGD, filterStaff, resolveParticipantIds } from "../_lib/utils";

interface ParticipantSelectorProps {
  allProfiles: any[];
  departments: any[];
  bgdMode: 'all' | 'specific' | 'none';
  setBgdMode: (v: 'all' | 'specific' | 'none') => void;
  selectedBGD: string[];
  setSelectedBGD: (v: string[]) => void;
  deptMode: 'all' | 'specific' | 'none';
  setDeptMode: (v: 'all' | 'specific' | 'none') => void;
  filterDepts: string[];
  setFilterDepts: (v: string[]) => void;
  participantMode: 'all' | 'manager' | 'staff';
  setParticipantMode: (v: 'all' | 'manager' | 'staff') => void;
  selectedParticipants: string[];
  setSelectedParticipants: (v: string[]) => void;
}

export default function ParticipantSelector({
  allProfiles, departments,
  bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
  deptMode, setDeptMode, filterDepts, setFilterDepts,
  participantMode, setParticipantMode,
  selectedParticipants, setSelectedParticipants
}: ParticipantSelectorProps) {

  // Tính toán toàn bộ ID được chọn dựa trên các filter hiện tại
  const finalSelectedIds = resolveParticipantIds({
    selectedParticipants,
    bgdMode,
    selectedBGD,
    deptMode,
    filterDepts,
    participantMode,
    allProfiles
  });

  // Lọc ra các hồ sơ (profiles) đang được chọn và sắp xếp theo chức vụ
  const selectedProfiles = sortProfilesByHierarchy(
    allProfiles.filter(p => finalSelectedIds.includes(p.id))
  );

  // Xử lý khi nhấn nút "X" trên từng badge để xóa người tham gia
  const handleRemoveParticipant = (profileId: string) => {
    const profile = allProfiles.find(p => p.id === profileId);
    if (!profile) return;

    const isBgd = profile.role === 'director' || profile.full_name?.toLowerCase().includes('giám đốc');

    if (isBgd) {
      if (bgdMode === 'all') {
        const allBgdIds = filterBGD(allProfiles).map(p => p.id);
        setBgdMode('specific');
        setSelectedBGD(allBgdIds.filter(id => id !== profileId));
      } else {
        setSelectedBGD(selectedBGD.filter(id => id !== profileId));
      }
    } else {
      if (deptMode === 'all') {
        const allStaff = filterStaff(allProfiles);
        setDeptMode('specific');
        setFilterDepts(departments.map(d => d.id));
        setParticipantMode('staff');
        setSelectedParticipants(allStaff.map(p => p.id).filter(id => id !== profileId));
      } else if (deptMode === 'specific') {
        if (participantMode === 'all') {
          const staffInSelectedDepts = filterStaff(allProfiles).filter(p => p.department_id && filterDepts.includes(p.department_id));
          setParticipantMode('staff');
          setSelectedParticipants(staffInSelectedDepts.map(p => p.id).filter(id => id !== profileId));
        } else if (participantMode === 'manager') {
          const managersInSelectedDepts = filterStaff(allProfiles).filter(p => p.department_id && filterDepts.includes(p.department_id) && (p.role === 'manager' || p.is_department_head));
          setParticipantMode('staff');
          setSelectedParticipants(managersInSelectedDepts.map(p => p.id).filter(id => id !== profileId));
        } else {
          setSelectedParticipants(selectedParticipants.filter(id => id !== profileId));
        }
      } else {
        setSelectedParticipants(selectedParticipants.filter(id => id !== profileId));
      }
    }
  };

  // Build danh sách Badge siêu dẹt và tối giản diện tích
  const elements: React.ReactNode[] = [];

  if (bgdMode === 'all') {
    elements.push(
      <Badge
        key="all-bgd"
        variant="outline"
        className="bg-red-50 border-red-200 text-red-700 rounded-full px-2 py-0.5 flex items-center gap-1 font-bold shadow-2xs text-[10px] h-6 animate-in fade-in"
      >
        <span>Toàn bộ Ban Giám đốc</span>
        <button
          type="button"
          onClick={() => { setBgdMode('none'); setSelectedBGD([]); }}
          className="p-0.5 rounded-full hover:bg-red-250 text-red-500 hover:text-red-700 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </Badge>
    );
  }

  if (deptMode === 'all') {
    elements.push(
      <Badge
        key="all-staff"
        variant="outline"
        className="bg-blue-50 border-blue-200 text-blue-700 rounded-full px-2 py-0.5 flex items-center gap-1 font-bold shadow-2xs text-[10px] h-6 animate-in fade-in"
      >
        <span>Toàn bộ Đơn vị / Phòng ban</span>
        <button
          type="button"
          onClick={() => { setDeptMode('none'); setFilterDepts([]); setSelectedParticipants([]); }}
          className="p-0.5 rounded-full hover:bg-blue-250 text-blue-500 hover:text-blue-700 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </Badge>
    );
  }

  const bgdProfiles = filterBGD(allProfiles);
  const staffProfiles = filterStaff(allProfiles);

  const remainingProfiles = selectedProfiles.filter(p => {
    const isBgd = bgdProfiles.some(bp => bp.id === p.id);
    const isStaff = staffProfiles.some(sp => sp.id === p.id);
    if (isBgd && bgdMode === 'all') return false;
    if (isStaff && deptMode === 'all') return false;
    return true;
  });

  remainingProfiles.forEach(p => {
    elements.push(
      <Badge
        key={p.id}
        variant="outline"
        className="bg-white border-slate-200 rounded-full pl-1.5 pr-2 py-0.5 flex items-center gap-1.5 font-semibold text-slate-700 shadow-2xs text-[10px] h-6 animate-in fade-in"
      >
        <Avatar className="h-4 w-4">
          <AvatarImage src={p.avatar_url} />
          <AvatarFallback className="text-[7px] bg-slate-100">{p.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <span className="whitespace-nowrap">{p.full_name}</span>
        <button
          type="button"
          onClick={() => handleRemoveParticipant(p.id)}
          className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors ml-0.5"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </Badge>
    );
  });

  return (
    <div className="space-y-3 bg-slate-50/40 p-3.5 rounded-xl border border-slate-100">
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-primary shrink-0" />
        <Label className="text-[12px] font-bold text-slate-700">Thành phần tham gia</Label>
      </div>

      <div className="space-y-2.5 pt-0.5">
        {/* Dòng 1: Ban Giám đốc */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-3 bg-red-500 rounded-full shrink-0" />
            <span className="text-[12px] font-semibold text-slate-650">1. Ban giám đốc</span>
          </div>
          <Popover modal={true}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-[170px] h-10 bg-white border border-slate-200 rounded-lg justify-between px-2.5 text-[12px] font-semibold text-slate-755 hover:text-slate-900 shadow-xs transition-all truncate whitespace-nowrap">
                <span className="truncate">
                  {bgdMode === 'all' && "Tất cả BGĐ"}
                  {bgdMode === 'none' && "Không ai"}
                  {bgdMode === 'specific' && (selectedBGD.length > 0 ? `Đã chọn ${selectedBGD.length}` : "Chọn cụ thể")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[280px] p-2 rounded-xl border border-slate-150 shadow-2xl bg-white z-[9999] pointer-events-auto max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y space-y-2" 
              align="end" 
              onOpenAutoFocus={(e) => e.preventDefault()}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="flex bg-slate-100 p-1 rounded-lg w-full mb-1 gap-1">
                <button type="button" onClick={() => { setBgdMode('all'); setSelectedBGD([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", bgdMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Tất cả</button>
                <button type="button" onClick={() => { setBgdMode('specific'); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", bgdMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Chọn cụ thể</button>
                <button type="button" onClick={() => { setBgdMode('none'); setSelectedBGD([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", bgdMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Không ai</button>
              </div>
              {bgdMode === 'specific' && (
                <div className="space-y-0.5 pt-1 animate-in fade-in slide-in-from-top-1">
                  {filterBGD(allProfiles).map(p => {
                    const isChecked = selectedBGD.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          isChecked 
                            ? setSelectedBGD(selectedBGD.filter(id => id !== p.id))
                            : setSelectedBGD([...selectedBGD, p.id]);
                        }}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all",
                          isChecked ? "bg-primary/5 text-primary" : "hover:bg-slate-50 text-slate-600"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                          isChecked ? "bg-primary border-primary" : "border-slate-300"
                        )}>
                          {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs font-semibold">{p.full_name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Dòng 2: Phòng ban */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-3 bg-blue-500 rounded-full shrink-0" />
            <span className="text-[12px] font-semibold text-slate-655">2. Phòng ban</span>
          </div>
          <Popover modal={true}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-[170px] h-10 bg-white border border-slate-200 rounded-lg justify-between px-2.5 text-[12px] font-semibold text-slate-755 hover:text-slate-900 shadow-xs transition-all truncate whitespace-nowrap">
                <span className="truncate">
                  {deptMode === 'all' && "Tất cả phòng"}
                  {deptMode === 'none' && "Không ai"}
                  {deptMode === 'specific' && (filterDepts.length > 0 ? `Đã chọn ${filterDepts.length}` : "Chọn cụ thể")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[280px] p-2 rounded-xl border border-slate-150 shadow-2xl bg-white z-[9999] pointer-events-auto max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y space-y-2" 
              align="end" 
              onOpenAutoFocus={(e) => e.preventDefault()}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="flex bg-slate-100 p-1 rounded-lg w-full mb-1 gap-1">
                <button type="button" onClick={() => { setDeptMode('all'); setFilterDepts([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", deptMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Tất cả</button>
                <button type="button" onClick={() => { setDeptMode('specific'); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", deptMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Chọn cụ thể</button>
                <button type="button" onClick={() => { setDeptMode('none'); setFilterDepts([]); setSelectedParticipants([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", deptMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Không ai</button>
              </div>
              {deptMode === 'specific' && (
                <div className="space-y-0.5 pt-1 animate-in fade-in slide-in-from-top-1">
                  {departments.map(d => {
                    const isChecked = filterDepts.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        onClick={() => {
                          isChecked
                            ? setFilterDepts(filterDepts.filter(id => id !== d.id))
                            : setFilterDepts([...filterDepts, d.id]);
                        }}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all",
                          isChecked ? "bg-primary/5 text-primary" : "hover:bg-slate-50 text-slate-600"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                          isChecked ? "bg-primary border-primary" : "border-slate-300"
                        )}>
                          {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs font-semibold">{d.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Dòng 3: Cán bộ chi tiết */}
        {deptMode === 'specific' && filterDepts.length > 0 && (
          <div className="flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-3 bg-emerald-500 rounded-full shrink-0" />
              <span className="text-[12px] font-semibold text-slate-655">3. Cán bộ chi tiết</span>
            </div>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-[170px] h-10 bg-white border border-slate-200 rounded-lg justify-between px-2.5 text-[12px] font-semibold text-slate-755 hover:text-slate-900 shadow-xs transition-all truncate whitespace-nowrap">
                  <span className="truncate">
                    {participantMode === 'all' && "Tất cả cán bộ"}
                    {participantMode === 'manager' && "Chỉ lãnh đạo"}
                    {participantMode === 'staff' && (selectedParticipants.length > 0 ? `Đã chọn ${selectedParticipants.length}` : "Chọn cụ thể")}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[300px] p-2 rounded-xl border border-slate-150 shadow-2xl bg-white z-[9999] pointer-events-auto max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y space-y-2" 
                align="end" 
                onOpenAutoFocus={(e) => e.preventDefault()}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <div className="flex bg-slate-100 p-1 rounded-lg w-full mb-1 gap-1">
                  <button type="button" onClick={() => { setParticipantMode('all'); setSelectedParticipants([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", participantMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Tất cả</button>
                  <button type="button" onClick={() => { setParticipantMode('manager'); setSelectedParticipants([]); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", participantMode === 'manager' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Lãnh đạo</button>
                  <button type="button" onClick={() => { setParticipantMode('staff'); }} className={cn("flex-1 h-10 flex items-center justify-center whitespace-nowrap px-1 text-[11px] font-bold rounded-md transition-all", participantMode === 'staff' ? "bg-white text-primary shadow-sm" : "text-slate-500")}>Từng người</button>
                </div>
                
                {participantMode === 'staff' ? (
                  <div className="space-y-2.5 pt-1 animate-in fade-in slide-in-from-top-1 max-h-[200px] overflow-y-auto pr-1">
                    {departments.filter(d => filterDepts.includes(d.id)).map(dept => {
                      const deptMembers = sortProfilesByHierarchy(
                        allProfiles.filter(p => p.department_id === dept.id && p.role !== 'admin' && p.role !== 'director')
                      );
                      if (deptMembers.length === 0) return null;
                      return (
                        <div key={dept.id} className="space-y-0.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1.5">{dept.name}</p>
                          <div className="space-y-0.5">
                            {deptMembers.map(p => {
                              const isChecked = selectedParticipants.includes(p.id);
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    isChecked
                                      ? setSelectedParticipants(selectedParticipants.filter(id => id !== p.id))
                                      : setSelectedParticipants([...selectedParticipants, p.id]);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all",
                                    isChecked ? "bg-primary/5 text-primary" : "hover:bg-slate-50 text-slate-600"
                                  )}
                                >
                                  <div className={cn(
                                    "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                                    isChecked ? "bg-primary border-primary" : "border-slate-300"
                                  )}>
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <Avatar className="w-4 h-4 shadow-2xs">
                                    <AvatarImage src={p.avatar_url} />
                                    <AvatarFallback className="text-[6px] bg-slate-100">{p.full_name?.[0]}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-semibold truncate">{p.full_name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    {participantMode === 'all' && (
                      <p className="text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Tự động mời toàn bộ cán bộ phòng.
                      </p>
                    )}
                    {participantMode === 'manager' && (
                      <p className="text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1">
                        <UserCog className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Tự động mời lãnh đạo phòng.
                      </p>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Hiển thị danh sách Badge đồng bộ 100% với màn hình Xem chi tiết ngoài */}
      {elements.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-2.5 animate-in fade-in">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh sách đã chọn</p>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {elements}
          </div>
        </div>
      )}
    </div>
  );
}
