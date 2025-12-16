import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileText,
  Globe,
  Mic,
  Image,
  Type,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ModalityType = "document" | "audio" | "web" | "text" | "image";

interface FileUploadProps {
  onUploadComplete: () => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [activeTab, setActiveTab] = useState<ModalityType>("document");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();

  const modalities = [
    { id: "document" as const, label: "Document", icon: FileText, accept: ".pdf,.md,.txt" },
    { id: "audio" as const, label: "Audio", icon: Mic, accept: ".mp3,.m4a,.wav" },
    { id: "web" as const, label: "Web URL", icon: Globe },
    { id: "text" as const, label: "Text", icon: Type },
    { id: "image" as const, label: "Image", icon: Image, accept: ".jpg,.jpeg,.png,.webp" },
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("knowledge-files")
        .getPublicUrl(fileName);

      // Create knowledge item
      const { error: insertError } = await supabase
        .from("knowledge_items")
        .insert({
          title: file.name,
          modality: activeTab,
          original_content: urlData.publicUrl,
          metadata: { fileName: file.name, size: file.size, type: file.type },
          source_timestamp: new Date().toISOString(),
          status: "pending",
        });

      if (insertError) throw insertError;

      // Trigger processing
      await supabase.functions.invoke("process-content", {
        body: { fileName, modality: activeTab },
      });

      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded and is being processed.`,
      });
      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        await uploadFile(e.dataTransfer.files[0]);
      }
    },
    [activeTab]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    setIsUploading(true);
    try {
      const { error } = await supabase.from("knowledge_items").insert({
        title: url,
        modality: "web",
        original_content: url,
        metadata: { url },
        source_timestamp: new Date().toISOString(),
        status: "pending",
      });

      if (error) throw error;

      await supabase.functions.invoke("process-content", {
        body: { url, modality: "web" },
      });

      toast({
        title: "URL added",
        description: "The webpage is being processed.",
      });
      setUrl("");
      onUploadComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process URL.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!text.trim() || !title.trim()) return;
    setIsUploading(true);
    try {
      const { error } = await supabase.from("knowledge_items").insert({
        title: title,
        modality: "text",
        original_content: text,
        processed_content: text,
        metadata: {},
        source_timestamp: new Date().toISOString(),
        status: "completed",
      });

      if (error) throw error;

      await supabase.functions.invoke("process-content", {
        body: { text, title, modality: "text" },
      });

      toast({
        title: "Text added",
        description: "Your note has been saved to the knowledge base.",
      });
      setText("");
      setTitle("");
      onUploadComplete();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save text.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Modality tabs */}
      <div className="flex flex-wrap gap-2">
        {modalities.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-card text-muted-foreground hover:text-foreground border border-border hover:border-primary/30"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      {(activeTab === "document" || activeTab === "audio" || activeTab === "image") && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200 text-center",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-card/50"
          )}
        >
          <input
            type="file"
            accept={modalities.find((m) => m.id === activeTab)?.accept}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <div className="flex flex-col items-center gap-4">
            {isUploading ? (
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            )}
            <div>
              <p className="text-lg font-medium text-foreground">
                {isUploading ? "Uploading..." : "Drop files here or click to upload"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {modalities.find((m) => m.id === activeTab)?.accept?.replace(/\./g, "").replace(/,/g, ", ").toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* URL input */}
      {activeTab === "web" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="flex-1 bg-card border-border"
            />
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || isUploading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add URL"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a webpage URL to extract and index its content.
          </p>
        </div>
      )}

      {/* Text input */}
      {activeTab === "text" && (
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="bg-card border-border"
          />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your notes, thoughts, or any text content..."
            className="min-h-[200px] bg-card border-border"
          />
          <Button
            onClick={handleTextSubmit}
            disabled={!text.trim() || !title.trim() || isUploading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save to Knowledge Base
          </Button>
        </div>
      )}
    </div>
  );
}
