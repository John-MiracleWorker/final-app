"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react"; // Import useChat hook
import Fuse from 'fuse.js';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import protocolsData from "@/lib/protocols.json";

interface Protocol {
  name: string;
  content: string;
  source_file: string;
  id: string;
}

interface ProtocolData {
  [key: string]: Omit<Protocol, 'id'>;
}

// Load protocols into a list format for Fuse.js and display
const protocolsList: Protocol[] = Object.entries(protocolsData as ProtocolData).map(([key, protocol]) => ({
    ...protocol,
    id: key,
}));

// Fuse.js options for fuzzy search
const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'id', weight: 0.5 },
    { name: 'content', weight: 0.2 }
  ]
};

const fuse = new Fuse(protocolsList, fuseOptions);

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Protocol[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Vercel AI SDK useChat hook
  const { messages, input, handleInputChange: handleChatInputChange, handleSubmit, isLoading: isChatLoading, error: chatError } = useChat({
    api: "/api/chat", // Point to our backend API route
    // Optional: Add initial messages or other configurations if needed
  });

  // Fuzzy Search Functionality using Fuse.js
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    console.log(`Performing fuzzy search for: ${searchTerm}`);
    const results = fuse.search(searchTerm);
    const filteredResults = results.map(result => result.item);
    console.log(`Found ${filteredResults.length} results with Fuse.js`);
    setSearchResults(filteredResults);
    setIsSearching(false);
    setIsChatMode(false); // Switch back to search results view
  };

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]); // Trigger scroll when messages update

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4 md:p-8">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center">
            <CardTitle className="text-3xl md:text-4xl font-bold text-gray-800">Oakland County EMS Protocols</CardTitle>
            <CardDescription>Search or chat to find protocol information</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Search Bar */}
            <div className="w-full flex items-center space-x-2 mb-6">
                <Input
                type="text"
                placeholder="Search protocols (e.g., cardiac arrest adult)..."
                value={searchTerm}
                onChange={handleSearchTermChange}
                onKeyDown={handleSearchKeyDown}
                className="flex-grow"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} <span className="ml-2 hidden sm:inline">Search</span>
                </Button>
                <Button variant="outline" onClick={() => setIsChatMode(!isChatMode)} title={isChatMode ? "Switch to Search" : "Switch to Chat"}>
                {isChatMode ? <Search className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} <span className="ml-2 hidden sm:inline">{isChatMode ? "Search" : "Chat"}</span>
                </Button>
            </div>

            {/* Content Area: Search Results or Chat */}
            <div className="w-full h-[65vh] flex flex-col">
                {isChatMode ? (
                // Chat Interface using useChat hook
                <div className="h-full flex flex-col border rounded-md">
                    <ScrollArea className="flex-grow p-4" ref={chatContainerRef}>
                        {messages.map((msg) => (
                        <div key={msg.id} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`p-3 rounded-lg max-w-[80%] ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                        ))}
                        {/* Display chat error from useChat hook */}
                        {chatError && (
                             <div className="flex justify-start mb-3">
                                <div className="bg-red-100 text-red-700 p-3 rounded-lg inline-flex items-center max-w-[80%]">
                                    <AlertCircle className="inline-block h-4 w-4 mr-1 mb-0.5 flex-shrink-0"/>
                                    <p className="text-sm whitespace-pre-wrap">Sorry, an error occurred: {chatError.message}</p>
                                </div>
                            </div>
                        )}
                        {isChatLoading && messages[messages.length -1]?.role === 'user' && (
                            <div className="flex justify-start mb-3">
                                <div className="bg-gray-200 p-3 rounded-lg inline-flex items-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Thinking...
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    {/* Form managed by useChat hook */}
                    <form onSubmit={handleSubmit} className="flex items-center space-x-2 p-4 border-t bg-gray-50 rounded-b-md">
                        <Input
                        placeholder="Type your question..."
                        value={input} // Controlled by useChat
                        onChange={handleChatInputChange} // Handled by useChat
                        disabled={isChatLoading}
                        className="flex-grow text-black"
                        />
                        <Button type="submit" disabled={isChatLoading || !input.trim()}>
                        {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                        </Button>
                    </form>
                </div>
                ) : (
                // Search Results
                <ScrollArea className="h-full border rounded-md p-4">
                    {searchResults.length > 0 ? (
                    <div className="space-y-4">
                        {searchResults.map((protocol) => (
                                <Card key={protocol.id}>
                                    <CardHeader>
                                    <CardTitle>{protocol.name} ({protocol.id})</CardTitle>
                                    <CardDescription>Source: {protocol.source_file}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                    <pre className="whitespace-pre-wrap text-sm font-sans bg-gray-100 text-gray-900 p-3 rounded overflow-x-auto border border-gray-300 min-h-[50px]">{protocol.content || "Content not available."}</pre>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                    ) : (
                    <div className="text-center text-gray-500 pt-10">
                        {searchTerm ? "No protocols found matching your search." : "Enter a search term above or switch to chat mode."}
                    </div>
                    )}
                </ScrollArea>
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

