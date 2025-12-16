import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/knowledge/FileUpload";
import { KnowledgeList } from "@/components/knowledge/KnowledgeList";
import {
  Brain,
  Plus,
  Database,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNewChat: () => void;
}

export function Sidebar({ onNewChat }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        isExpanded ? "w-80" : "w-16"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-3", !isExpanded && "hidden")}>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">Second Brain</h1>
              <p className="text-xs text-muted-foreground">AI Knowledge Companion</p>
            </div>
          </div>
          {!isExpanded && (
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
              <Brain className="w-6 h-6 text-primary" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className={cn("p-4 space-y-2", !isExpanded && "px-3")}>
        <Button
          onClick={onNewChat}
          className={cn(
            "bg-primary hover:bg-primary/90 text-primary-foreground glow",
            isExpanded ? "w-full" : "w-10 px-0"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          {isExpanded && <span className="ml-2">New Chat</span>}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowUpload(!showUpload)}
          className={cn(
            "border-border hover:border-primary/50 hover:bg-primary/5",
            isExpanded ? "w-full" : "w-10 px-0"
          )}
        >
          <Plus className="w-4 h-4" />
          {isExpanded && <span className="ml-2">Add Knowledge</span>}
        </Button>
      </div>

      {/* Upload Section */}
      {isExpanded && showUpload && (
        <div className="px-4 pb-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <FileUpload
              onUploadComplete={() => setRefreshTrigger((t) => t + 1)}
            />
          </div>
        </div>
      )}

      {/* Knowledge List */}
      {isExpanded && (
        <div className="flex-1 px-4 pb-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Knowledge Base
            </span>
          </div>
          <KnowledgeList refreshTrigger={refreshTrigger} />
        </div>
      )}
    </aside>
  );
}
