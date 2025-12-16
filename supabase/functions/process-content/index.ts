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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { fileName, url, text, title, modality } = body;

    console.log("Processing content:", { modality, fileName, url, title });

    // Find the knowledge item to update
    let query = supabase.from("knowledge_items").select("*");
    
    if (fileName) {
      query = query.ilike("original_content", `%${fileName}%`);
    } else if (url) {
      query = query.eq("original_content", url);
    } else if (title) {
      query = query.eq("title", title);
    }

    const { data: items, error: fetchError } = await query.limit(1).single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching item:", fetchError);
      throw fetchError;
    }

    if (!items) {
      console.log("No item found to process");
      return new Response(
        JSON.stringify({ message: "No item found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("knowledge_items")
      .update({ status: "processing" })
      .eq("id", items.id);

    let processedContent = "";

    try {
      switch (modality) {
        case "text":
          // Text is already processed
          processedContent = text || items.original_content || "";
          break;

        case "document":
          // For documents, use AI to extract/summarize content
          if (items.original_content) {
            // Fetch the document content if it's a URL
            try {
              const docResponse = await fetch(items.original_content);
              const docText = await docResponse.text();
              
              // Use AI to process/summarize the document
              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content: "Extract and summarize the key information from this document. Preserve important facts, dates, names, and concepts. Format the output as clear, searchable text.",
                    },
                    {
                      role: "user",
                      content: `Document content:\n\n${docText.slice(0, 50000)}`,
                    },
                  ],
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                processedContent = aiData.choices?.[0]?.message?.content || docText.slice(0, 10000);
              } else {
                processedContent = docText.slice(0, 10000);
              }
            } catch (e) {
              console.error("Error processing document:", e);
              processedContent = "Document processing failed";
            }
          }
          break;

        case "web":
          // Scrape web content
          if (url || items.original_content) {
            const targetUrl = url || items.original_content;
            try {
              const webResponse = await fetch(targetUrl);
              const html = await webResponse.text();
              
              // Extract text content (simple extraction)
              const textContent = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 50000);

              // Use AI to extract key information
              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content: "Extract and summarize the main content from this webpage. Focus on the article or main content, ignoring navigation, ads, and boilerplate. Preserve key facts and information.",
                    },
                    {
                      role: "user",
                      content: `Webpage content from ${targetUrl}:\n\n${textContent}`,
                    },
                  ],
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                processedContent = aiData.choices?.[0]?.message?.content || textContent.slice(0, 5000);
              } else {
                processedContent = textContent.slice(0, 5000);
              }

              // Update title with page title if available
              const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
              if (titleMatch) {
                await supabase
                  .from("knowledge_items")
                  .update({ title: titleMatch[1].trim() })
                  .eq("id", items.id);
              }
            } catch (e) {
              console.error("Error scraping web content:", e);
              processedContent = "Web content extraction failed";
            }
          }
          break;

        case "audio":
          // For audio, we'd need a transcription service
          // Using AI to generate a placeholder response for now
          processedContent = "Audio transcription: [Audio file uploaded - transcription service integration pending]";
          
          // In a real implementation, you would:
          // 1. Download the audio file
          // 2. Send to a transcription service (Whisper API, AssemblyAI, etc.)
          // 3. Store the transcription
          break;

        case "image":
          // For images, use vision AI to describe content
          if (items.original_content && LOVABLE_API_KEY) {
            try {
              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: "Describe this image in detail. Include any text, objects, people, colors, and context you can identify. Make the description searchable and informative.",
                        },
                        {
                          type: "image_url",
                          image_url: { url: items.original_content },
                        },
                      ],
                    },
                  ],
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                processedContent = aiData.choices?.[0]?.message?.content || "Image uploaded";
              } else {
                processedContent = "Image uploaded - description pending";
              }
            } catch (e) {
              console.error("Error processing image:", e);
              processedContent = "Image processing failed";
            }
          }
          break;
      }

      // Update the knowledge item with processed content
      const { error: updateError } = await supabase
        .from("knowledge_items")
        .update({
          processed_content: processedContent,
          status: "completed",
        })
        .eq("id", items.id);

      if (updateError) {
        throw updateError;
      }

      console.log("Content processed successfully for item:", items.id);

      return new Response(
        JSON.stringify({ success: true, itemId: items.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (processingError) {
      console.error("Processing error:", processingError);
      
      await supabase
        .from("knowledge_items")
        .update({ status: "failed" })
        .eq("id", items.id);

      throw processingError;
    }
  } catch (error) {
    console.error("Process content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
