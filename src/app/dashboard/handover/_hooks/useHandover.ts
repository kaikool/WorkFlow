"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { canViewAllDocuments } from "@/lib/permissions";
import {
  fetchAllDocuments,
  fetchCategories,
} from "../_lib/fetchHandover";
import type { DocumentCategory, DocumentRow } from "../_lib/types";
import type { DeskTab } from "../_lib/constants";

interface UseHandoverState {
  loading: boolean;
  profile: any;
  allProfiles: any[];
  documents: DocumentRow[];
  categories: DocumentCategory[];
  activeTab: DeskTab;
  setActiveTab: (t: DeskTab) => void;
  inboxDocs: DocumentRow[];
  outboxDocs: DocumentRow[];
  allDocs: DocumentRow[];
  // Dialogs
  selectedDocId: string | null;
  setSelectedDocId: (id: string | null) => void;
  isCreateOpen: boolean;
  setIsCreateOpen: (v: boolean) => void;
  refetch: () => Promise<void>;
}

export function useHandover(): UseHandoverState {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);

  const [activeTab, setActiveTab] = useState<DeskTab>("inbox");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Auto-open dialog theo URL params:
  //   ?id=<doc_id>  → mở dialog chi tiết (link từ push notification)
  //   ?create=1     → mở dialog tạo mới (do MobileCreateFab bấm)
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) setSelectedDocId(idParam);

    const createParam = searchParams.get("create");
    if (createParam === "1") {
      setIsCreateOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("create");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  // Refetch (debounced) — gọi sau mỗi realtime event
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetch = useCallback(async () => {
    const [docs, cats] = await Promise.all([
      fetchAllDocuments(),
      fetchCategories(),
    ]);
    setDocuments(docs);
    setCategories(cats);
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetch();
    }, 250);
  }, [refetch]);

  // Initial load
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [profileRes, profilesRes, docs, cats] = await Promise.all([
          supabase
            .from("profiles")
            .select("*, departments ( id, name, code )")
            .eq("id", user.id)
            .single(),
          supabase
            .from("profiles")
            .select("id, full_name, avatar_url, role, department_id, departments ( id, name, code )")
            .order("full_name"),
          fetchAllDocuments(),
          fetchCategories(),
        ]);

        if (!active) return;
        setProfile(profileRes.data);
        setAllProfiles(profilesRes.data || []);
        setDocuments(docs);
        setCategories(cats);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  // Realtime subscribe — bám sát pattern useSchedule
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("handover_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_handovers" },
        (payload: any) => {
          // Toast riêng khi có handover INSERT với receiver = me
          if (
            payload.eventType === "INSERT" &&
            (payload.new as any)?.receiver_id === profile.id
          ) {
            toast({
              title: "Có hồ sơ mới chờ nhận",
              description: "Mở tab \"Đang giữ\" để xem chi tiết.",
            });
          }
          scheduleRefetch();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_categories" },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, profile, scheduleRefetch, toast]);

  // Phân loại 3 list cho 3 tab
  const inboxDocs = useMemo(() => {
    if (!profile) return [] as DocumentRow[];
    return documents.filter((d) => {
      // Hồ sơ đang được gán cho mình (đã accept) HOẶC đang chờ mình nhận
      if (d.current_assignee_id === profile.id) return true;
      const pending = (d.handovers || []).some(
        (h) => h.receiver_id === profile.id && h.status === "PENDING"
      );
      return pending;
    });
  }, [documents, profile]);

  const outboxDocs = useMemo(() => {
    if (!profile) return [] as DocumentRow[];
    return documents.filter((d) => {
      if (d.current_assignee_id === profile.id) return false;
      // Tôi từng gửi (creator hoặc sender trong handover)
      if (d.creator_id === profile.id) return true;
      return (d.handovers || []).some((h) => h.sender_id === profile.id);
    });
  }, [documents, profile]);

  const allDocs = useMemo(() => {
    if (!canViewAllDocuments(profile)) return [] as DocumentRow[];
    return documents;
  }, [documents, profile]);

  return {
    loading,
    profile,
    allProfiles,
    documents,
    categories,
    activeTab,
    setActiveTab,
    inboxDocs,
    outboxDocs,
    allDocs,
    selectedDocId,
    setSelectedDocId,
    isCreateOpen,
    setIsCreateOpen,
    refetch,
  };
}
