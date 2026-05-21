'use client'

import React from "react";
import { Building2, ChevronDown, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function compactName(value?: string | null) {
  return value || "Chưa đặt tên";
}

export default function ParticipantSelector({
  allProfiles,
  departments,
  bgdMode,
  setBgdMode,
  selectedBGD,
  setSelectedBGD,
  deptMode,
  setDeptMode,
  filterDepts,
  setFilterDepts,
  participantMode,
  setParticipantMode,
  selectedParticipants,
  setSelectedParticipants
}: ParticipantSelectorProps) {
  const bgdProfiles = filterBGD(allProfiles);
  const staffProfiles = filterStaff(allProfiles);
  const selectedDeptNames = departments
    .filter((dept) => filterDepts.includes(dept.id))
    .map((dept) => dept.name);

  const finalSelectedIds = resolveParticipantIds({
    selectedParticipants,
    bgdMode,
    selectedBGD,
    deptMode,
    filterDepts,
    participantMode,
    allProfiles
  });

  const selectedProfiles = sortProfilesByHierarchy(
    allProfiles.filter((profile) => finalSelectedIds.includes(profile.id))
  );

  const handleRemoveParticipant = (profileId: string) => {
    const profile = allProfiles.find((item) => item.id === profileId);
    if (!profile) return;

    const isBgd = bgdProfiles.some((item) => item.id === profileId);
    if (isBgd) {
      if (bgdMode === 'all') {
        setBgdMode('specific');
        setSelectedBGD(bgdProfiles.map((item) => item.id).filter((id) => id !== profileId));
      } else {
        setSelectedBGD(selectedBGD.filter((id) => id !== profileId));
      }
      return;
    }

    if (deptMode === 'all') {
      setDeptMode('specific');
      setFilterDepts(departments.map((dept) => dept.id));
      setParticipantMode('staff');
      setSelectedParticipants(staffProfiles.map((item) => item.id).filter((id) => id !== profileId));
      return;
    }

    if (deptMode === 'specific' && participantMode !== 'staff') {
      const eligible = staffProfiles.filter((item) => {
        if (!item.department_id || !filterDepts.includes(item.department_id)) return false;
        if (participantMode === 'manager') return item.role === 'manager' || item.is_department_head;
        return true;
      });
      setParticipantMode('staff');
      setSelectedParticipants(eligible.map((item) => item.id).filter((id) => id !== profileId));
      return;
    }

    setSelectedParticipants(selectedParticipants.filter((id) => id !== profileId));
  };

  const selectedSummary = selectedProfiles.length > 0
    ? `${selectedProfiles.length} người`
    : "Chưa chọn ai";

  return (
    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-primary" />
        <Label className="text-[13px] font-medium text-slate-700">Thành phần tham gia</Label>
        <Badge className="ml-auto border-none bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {selectedSummary}
        </Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
            Ban giám đốc
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between rounded-lg bg-white px-3 text-[13px] font-medium">
                <span className="truncate">
                  {bgdMode === 'all' && "Tất cả"}
                  {bgdMode === 'none' && "Không ai"}
                  {bgdMode === 'specific' && (selectedBGD.length ? `${selectedBGD.length} người` : "Chọn người")}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px]">
              <Tabs value={bgdMode} onValueChange={(value) => {
                const mode = value as 'all' | 'specific' | 'none';
                setBgdMode(mode);
                if (mode !== 'specific') setSelectedBGD([]);
              }}>
                <TabsList className="grid w-full grid-cols-3 rounded-lg bg-slate-100 p-0.5">
                  <TabsTrigger value="all" className="rounded-md px-1 text-[11px] font-medium">Tất cả</TabsTrigger>
                  <TabsTrigger value="specific" className="rounded-md px-1 text-[11px] font-medium">Chọn</TabsTrigger>
                  <TabsTrigger value="none" className="rounded-md px-1 text-[11px] font-medium">Không</TabsTrigger>
                </TabsList>
              </Tabs>
              {bgdMode === 'specific' && (
                <>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[min(14rem,var(--radix-dropdown-menu-content-available-height))]">
                    <div className="space-y-0.5 pr-2">
                      {bgdProfiles.map((profile) => (
                        <DropdownMenuCheckboxItem
                          key={profile.id}
                          checked={selectedBGD.includes(profile.id)}
                          onCheckedChange={() => setSelectedBGD(toggleId(selectedBGD, profile.id))}
                          onSelect={(event) => event.preventDefault()}
                          className="text-[13px] font-medium"
                        >
                          {compactName(profile.full_name)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
            <Building2 className="h-3.5 w-3.5 text-blue-500" />
            Phòng ban
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between rounded-lg bg-white px-3 text-[13px] font-medium">
                <span className="truncate">
                  {deptMode === 'all' && "Tất cả"}
                  {deptMode === 'none' && "Không ai"}
                  {deptMode === 'specific' && (filterDepts.length ? `${filterDepts.length} phòng` : "Chọn phòng")}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[300px]">
              <Tabs value={deptMode} onValueChange={(value) => {
                const mode = value as 'all' | 'specific' | 'none';
                setDeptMode(mode);
                if (mode !== 'specific') setFilterDepts([]);
                if (mode === 'none') setSelectedParticipants([]);
              }}>
                <TabsList className="grid w-full grid-cols-3 rounded-lg bg-slate-100 p-0.5">
                  <TabsTrigger value="all" className="rounded-md px-1 text-[11px] font-medium">Tất cả</TabsTrigger>
                  <TabsTrigger value="specific" className="rounded-md px-1 text-[11px] font-medium">Chọn</TabsTrigger>
                  <TabsTrigger value="none" className="rounded-md px-1 text-[11px] font-medium">Không</TabsTrigger>
                </TabsList>
              </Tabs>
              {deptMode === 'specific' && (
                <>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[min(14rem,var(--radix-dropdown-menu-content-available-height))]">
                    <div className="space-y-0.5 pr-2">
                      {departments.map((dept) => (
                        <DropdownMenuCheckboxItem
                          key={dept.id}
                          checked={filterDepts.includes(dept.id)}
                          onCheckedChange={() => setFilterDepts(toggleId(filterDepts, dept.id))}
                          onSelect={(event) => event.preventDefault()}
                          className="text-[13px] font-medium"
                        >
                          {dept.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
            Cán bộ
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={deptMode !== 'specific' || filterDepts.length === 0}
                className="w-full justify-between rounded-lg bg-white px-3 text-[13px] font-medium disabled:opacity-60"
              >
                <span className="truncate">
                  {deptMode !== 'specific' || filterDepts.length === 0
                    ? "Theo phòng ban"
                    : participantMode === 'all'
                      ? "Tất cả cán bộ"
                      : participantMode === 'manager'
                        ? "Chỉ lãnh đạo"
                        : selectedParticipants.length
                          ? `${selectedParticipants.length} người`
                          : "Chọn người"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[320px]">
              <Tabs value={participantMode} onValueChange={(value) => {
                const mode = value as 'all' | 'manager' | 'staff';
                setParticipantMode(mode);
                if (mode !== 'staff') setSelectedParticipants([]);
              }}>
                <TabsList className="grid w-full grid-cols-3 rounded-lg bg-slate-100 p-0.5">
                  <TabsTrigger value="all" className="rounded-md px-1 text-[11px] font-medium">Tất cả</TabsTrigger>
                  <TabsTrigger value="manager" className="rounded-md px-1 text-[11px] font-medium">Lãnh đạo</TabsTrigger>
                  <TabsTrigger value="staff" className="rounded-md px-1 text-[11px] font-medium">Chọn</TabsTrigger>
                </TabsList>
              </Tabs>

              {participantMode === 'staff' ? (
                <>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-[min(16rem,var(--radix-dropdown-menu-content-available-height))]">
                    <div className="space-y-2 pr-2">
                      {departments.filter((dept) => filterDepts.includes(dept.id)).map((dept) => {
                        const deptMembers = sortProfilesByHierarchy(
                          allProfiles.filter((profile) => (
                            profile.department_id === dept.id &&
                            profile.role !== 'admin' &&
                            profile.role !== 'director'
                          ))
                        );
                        if (deptMembers.length === 0) return null;

                        return (
                          <div key={dept.id}>
                            <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-slate-400">
                              {dept.name}
                            </DropdownMenuLabel>
                            {deptMembers.map((profile) => (
                              <DropdownMenuCheckboxItem
                                key={profile.id}
                                checked={selectedParticipants.includes(profile.id)}
                                onCheckedChange={() => setSelectedParticipants(toggleId(selectedParticipants, profile.id))}
                                onSelect={(event) => event.preventDefault()}
                                className="gap-2 text-[13px] font-medium"
                              >
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={profile.avatar_url} />
                                  <AvatarFallback className="text-[8px]">{compactName(profile.full_name)[0]}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{compactName(profile.full_name)}</span>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <p className="px-3 py-2 text-[12px] font-medium text-slate-500">
                  {participantMode === 'all'
                    ? "Tự động mời toàn bộ cán bộ thuộc phòng đã chọn."
                    : "Tự động mời lãnh đạo các phòng đã chọn."}
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(selectedDeptNames.length > 0 || selectedProfiles.length > 0) && (
        <div className="space-y-2 border-t border-slate-100 pt-2.5">
          {selectedDeptNames.length > 0 && deptMode === 'specific' && (
            <div className="flex flex-wrap gap-1.5">
              {selectedDeptNames.map((name) => (
                <Badge key={name} variant="outline" className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {name}
                </Badge>
              ))}
            </div>
          )}
          {selectedProfiles.length > 0 && (
            <ScrollArea className="h-24">
              <div className="flex flex-wrap gap-1.5 pr-2">
                {selectedProfiles.map((profile) => (
                  <Badge
                    key={profile.id}
                    variant="outline"
                    className={cn(
                      "rounded-full bg-white py-0.5 pl-1.5 pr-1 text-[11px] font-medium text-slate-700",
                      "flex items-center gap-1.5"
                    )}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-[7px]">{compactName(profile.full_name)[0]}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-32 truncate">{compactName(profile.full_name)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveParticipant(profile.id)}
                      aria-label={`Bỏ chọn ${compactName(profile.full_name)}`}
                      className="h-5 w-5 rounded-full p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
