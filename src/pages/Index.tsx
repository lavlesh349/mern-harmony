import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";

const Index = () => {
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    setChatKey((k) => k + 1);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar onNewChat={handleNewChat} />
      <main className="flex-1 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
        <div className="absolute inset-0 neural-grid opacity-30 pointer-events-none" />
        
        {/* Chat interface */}
        <div className="relative h-full">
          <ChatInterface key={chatKey} />
        </div>
      </main>
    </div>
  );
};

export default Index;
