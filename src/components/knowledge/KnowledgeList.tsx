import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Mic,
  Globe,
  Type,
  Image,
  Trash2,
  Clock,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeItem {
  id: string;
  title: string;
  modality: "audio" | "document" | "web" | "text" | "image";
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  processed_content?: string;
}

interface KnowledgeListProps {
  refreshTrigger: number;
}

const modalityIcons = {
  document: FileText,
  audio: Mic,
  web: Globe,
  text: Type,
  image: Image,
};

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string; animate?: boolean }> = {
  pending: { icon: Clock, color: "text-warning", label: "Pending" },
  processing: { icon: Loader2, color: "text-primary", label: "Processing", animate: true },
  completed: { icon: CheckCircle, color: "text-success", label: "Ready" },
  failed: { icon: AlertCircle, color: "text-destructive", label: "Failed" },
};

export function KnowledgeList({ refreshTrigger }: KnowledgeListProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data as KnowledgeItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [refreshTrigger]);

  // Real-time subscription for status updates
  useEffect(() => {
    const channel = supabase
      .channel("knowledge-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "knowledge_items" },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("knowledge_items")
      .delete()
      .eq("id", id);

    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border mx-auto mb-4 flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          No knowledge yet
        </h3>
        <p className="text-muted-foreground">
          Upload documents, audio, or add text to build your knowledge base.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {items.map((item) => {
          const Icon = modalityIcons[item.modality];
          const status = statusConfig[item.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={item.id}
              className="group p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground truncate">
                      {item.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs capitalize",
                        status.color
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "w-3 h-3 mr-1",
                          status.animate && "animate-spin"
                        )}
                      />
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="capitalize">{item.modality}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {item.processed_content && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {item.processed_content.slice(0, 150)}...
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
