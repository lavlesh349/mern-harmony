import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get the latest user message for context retrieval
    const latestUserMessage = messages.filter((m: any) => m.role === "user").pop();
    let contextText = "";
    let contextIds: string[] = [];

    if (latestUserMessage) {
      // Perform full-text search to find relevant knowledge items
      const { data: searchResults } = await supabase
        .from("knowledge_items")
        .select("id, title, processed_content, modality, source_timestamp")
        .eq("status", "completed")
        .textSearch("processed_content", latestUserMessage.content.split(" ").join(" | "), {
          type: "websearch",
          config: "english",
        })
        .limit(5);

      if (searchResults && searchResults.length > 0) {
        contextIds = searchResults.map((r) => r.id);
        contextText = searchResults
          .map((r) => {
            const timestamp = r.source_timestamp
              ? new Date(r.source_timestamp).toLocaleDateString()
              : "Unknown date";
            return `[${r.modality.toUpperCase()} - ${r.title} - ${timestamp}]\n${r.processed_content?.slice(0, 1000)}`;
          })
          .join("\n\n---\n\n");
      }
    }

    const systemPrompt = `You are an intelligent AI assistant serving as a "Second Brain" - a personal knowledge companion. You have access to the user's knowledge base which includes documents, audio transcripts, web content, notes, and images.

Your responsibilities:
1. Answer questions accurately based on the provided context from the user's knowledge base
2. Synthesize information from multiple sources when relevant
3. Support temporal queries (e.g., "what did I work on last week")
4. Be helpful, concise, and cite your sources when possible
5. If you don't have relevant information in the knowledge base, say so clearly

${contextText ? `\n\nRELEVANT CONTEXT FROM KNOWLEDGE BASE:\n${contextText}` : "\n\nNote: The knowledge base is currently empty or no relevant content was found for this query."}`;

    console.log("Chat request - found", contextIds.length, "relevant items");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
