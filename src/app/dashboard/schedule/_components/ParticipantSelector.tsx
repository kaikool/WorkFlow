'use client'

import React from "react";
import { Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { filterBGD } from "../_lib/utils";

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
  return (
    <div className="space-y-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <Users className="w-4 h-4 text-primary shrink-0" />
        <Label className="text-[13px] font-semibold text-slate-900">Thành phần tham gia</Label>
      </div>
      
      <div className="space-y-6">
        {/* 1. Ban Giám đốc */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2 whitespace-nowrap">
              <div className="w-1 h-3 bg-red-500 rounded-full shrink-0" /> 1. Ban giám đốc
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button type="button" onClick={() => setBgdMode('all')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Tất cả</button>
              <button type="button" onClick={() => setBgdMode('specific')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Chọn</button>
              <button type="button" onClick={() => { setBgdMode('none'); setSelectedBGD([]); }}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Không ai</button>
            </div>
          </div>
          
          {bgdMode === 'specific' && (
            <div className="flex flex-wrap gap-2 pl-3 animate-in fade-in slide-in-from-top-1">
              {filterBGD(allProfiles).map(p => (
                <button key={p.id} type="button"
                  onClick={() => selectedBGD.includes(p.id) ? setSelectedBGD(selectedBGD.filter(id => id !== p.id)) : setSelectedBGD([...selectedBGD, p.id])}
                  className={cn("px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border", selectedBGD.includes(p.id) ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/10" : "bg-slate-50 text-slate-500 border-slate-100")}
                >{p.full_name}</button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Đơn vị / Phòng */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2 whitespace-nowrap">
              <div className="w-1 h-3 bg-blue-500 rounded-full shrink-0" /> 2. Phòng
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button type="button" onClick={() => setDeptMode('all')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Tất cả</button>
              <button type="button" onClick={() => setDeptMode('specific')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Chọn</button>
              <button type="button" onClick={() => { setDeptMode('none'); setFilterDepts([]); setSelectedParticipants([]); }}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Không ai</button>
            </div>
          </div>

          {deptMode === 'specific' && (
            <div className="flex flex-wrap gap-2 pl-3 animate-in fade-in slide-in-from-top-1">
              {departments.map(d => (
                <button key={d.id} type="button"
                  onClick={() => filterDepts.includes(d.id) ? setFilterDepts(filterDepts.filter(id => id !== d.id)) : setFilterDepts([...filterDepts, d.id])}
                  className={cn("rounded-lg text-[13px] font-medium h-8 px-3 transition-all border", filterDepts.includes(d.id) ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20" : "bg-slate-50 text-slate-500 border-slate-100")}
                >{d.name}</button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Chi tiết cán bộ */}
        {(deptMode === 'specific' && filterDepts.length > 0) && (
          <div className="space-y-3 pt-2 border-t border-slate-50 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2 whitespace-nowrap">
                <div className="w-1 h-3 bg-emerald-500 rounded-full shrink-0" /> 3. Cán bộ
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                <button type="button" onClick={() => setParticipantMode('all')}
                  className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                >Tất cả</button>
                <button type="button" onClick={() => setParticipantMode('manager')}
                  className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'manager' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                >Lãnh đạo</button>
                <button type="button" onClick={() => setParticipantMode('staff')}
                  className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'staff' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
                >Cán bộ</button>
              </div>
            </div>

            <div className="pl-3">
              {participantMode === 'staff' ? (
                <div className="max-h-40 overflow-y-auto pr-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                  {departments.filter(d => filterDepts.includes(d.id)).map(dept => {
                    const deptMembers = sortProfilesByHierarchy(
                      allProfiles.filter(p => p.department_id === dept.id && p.role !== 'admin' && p.role !== 'director')
                    );
                    if (deptMembers.length === 0) return null;
                    return (
                      <div key={dept.id} className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-400">{dept.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {deptMembers.map(p => {
                            const isSelected = selectedParticipants.includes(p.id);
                            const initials = p.full_name ? p.full_name.trim().split(' ').pop()?.substring(0, 2) || '?'  : '?' ;
                            return (
                              <button key={p.id} type="button"
                                onClick={() => selectedParticipants.includes(p.id) ? setSelectedParticipants(selectedParticipants.filter(id => id !== p.id)) : setSelectedParticipants([...selectedParticipants, p.id])}
                                className={cn(
                                  "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border text-sm font-medium transition-all duration-200 shrink-0",
                                  isSelected
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-2 ring-emerald-500/10 shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                                )}
                              >
                                <Avatar className="w-5 h-5 text-[9px] font-bold shadow-xs">
                                  {p.avatar_url ? (
                                    <AvatarImage src={p.avatar_url} alt={p.full_name} />
                                  ) : (
                                    <AvatarFallback className={cn("text-white", isSelected ? "bg-emerald-600" : "bg-slate-400")}>
                                      {initials}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <span className="whitespace-nowrap">{p.full_name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-2">
                  {participantMode === 'all' && (
                    <p className="text-sm font-medium text-slate-500 italic">✓ Tự động mời tất cả cán bộ thuộc các phòng đã chọn.</p>
                  )}
                  {participantMode === 'manager' && (
                    <p className="text-sm font-medium text-slate-500 italic">✓ Tự động mời Lãnh đạo các phòng đã chọn.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
