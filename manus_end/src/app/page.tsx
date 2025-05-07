"use client";

import { useState, useEffect, useRef } from "react";
import Link from 'next/link'; // Import Link for navigation
import { useChat } from "ai/react";
import Fuse from 'fuse.js';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Loader2, AlertCircle, Filter, XCircle, CalculatorIcon, HelpCircleIcon } from "lucide-react"; // Added HelpCircleIcon for Quiz
import protocolsData from "@/lib/protocols.json";
import { MedicationCalculator } from "@/components/MedicationCalculator";

interface Protocol {
  name: string;
  content: string;
  source_file: string;
  id: string;
  categories?: string[];
}

interface ProtocolData {
  [key: string]: Omit<Protocol, 'id' | 'categories'> & { categories?: string[] };
}

const protocolsList: Protocol[] = Object.entries(protocolsData as ProtocolData).map(([key, protocol]) => ({
    ...protocol,
    id: key,
    categories: protocol.categories || []
}));

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

const CATEGORY_FILTERS = [
    { id: "adult", label: "Adult" },
    { id: "pediatric", label: "Pediatric" },
    { id: "medical", label: "Medical" },
    { id: "trauma", label: "Trauma" },
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Protocol[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatMode, setIsChatMode] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const { messages, input, handleInputChange: handleChatInputChange, handleSubmit, isLoading: isChatLoading, error: chatError } = useChat({
    api: "/api/chat",
  });

  const applyFiltersAndSearch = () => {
    let filteredByCategories = protocolsList;
    if (activeFilters.length > 0) {
        filteredByCategories = protocolsList.filter(protocol => 
            activeFilters.every(filter => protocol.categories?.includes(filter))
        );
    }
    if (!searchTerm.trim()) {
      setSearchResults(filteredByCategories);
      return;
    }
    setIsSearching(true);
    const fuseInstance = new Fuse(filteredByCategories, fuseOptions);
    const results = fuseInstance.search(searchTerm);
    const finalResults = results.map(result => result.item);
    setSearchResults(finalResults);
    setIsSearching(false);
  };

  useEffect(() => {
    applyFiltersAndSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeFilters]);

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { /* Search is triggered by useEffect */ }
  };

  const toggleFilter = (filterId: string) => {
    setActiveFilters(prevFilters => 
        prevFilters.includes(filterId) 
            ? prevFilters.filter(id => id !== filterId) 
            : [...prevFilters, filterId]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <Card className="w-full max-w-4xl shadow-xl rounded-lg overflow-hidden">
        <CardHeader className="text-center bg-gray-800 text-white p-6">
            <div className="flex justify-between items-center">
                <Link href="/quiz" passHref legacyBehavior>
                    <Button variant="outline" size="icon" title="Open Quiz Section" className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-white">
                        <HelpCircleIcon className="h-5 w-5" />
                    </Button>
                </Link>
                <CardTitle className="text-3xl md:text-4xl font-bold">EMS Protocol Navigator</CardTitle>
                <Button variant="outline" size="icon" onClick={() => setIsCalculatorOpen(true)} title="Open Medication Calculator" className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-white">
                    <CalculatorIcon className="h-5 w-5" />
                </Button>
            </div>
            <CardDescription className="text-gray-300 mt-1">Search protocols, use AI chat, or test your knowledge with a quiz</CardDescription>
        </CardHeader>
        <CardContent className="p-6 bg-white">
            <div className="w-full flex items-center space-x-2 mb-4">
                <Input
                type="text"
                placeholder="Search protocols (e.g., cardiac arrest)..."
                value={searchTerm}
                onChange={handleSearchTermChange}
                onKeyDown={handleSearchKeyDown}
                className="flex-grow border-gray-300 focus:ring-blue-500 focus:border-blue-500 rounded-md shadow-sm text-gray-900"
                />
                <Button variant="outline" onClick={() => setIsChatMode(!isChatMode)} title={isChatMode ? "Switch to Search View" : "Switch to AI Chat"} className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md">
                {isChatMode ? <Search className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />} <span className="ml-2 hidden sm:inline">{isChatMode ? "Search View" : "AI Chat"}</span>
                </Button>
            </div>

            {!isChatMode && (
                <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 mr-2"><Filter className="h-4 w-4 inline-block mr-1 mb-px"/>Filters:</span>
                        {CATEGORY_FILTERS.map(filter => (
                            <Button 
                                key={filter.id} 
                                variant={activeFilters.includes(filter.id) ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleFilter(filter.id)}
                                className={`rounded-full text-xs px-3 py-1 ${activeFilters.includes(filter.id) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                            >
                                {filter.label}
                            </Button>
                        ))}
                        {activeFilters.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-red-500 hover:bg-red-50 rounded-full px-3 py-1">
                                <XCircle className="h-3 w-3 mr-1"/> Clear All
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="w-full h-[60vh] flex flex-col">
                {isChatMode ? (
                <div className="h-full flex flex-col border border-gray-300 rounded-md shadow-inner">
                    <ScrollArea className="flex-grow p-4 bg-white" ref={chatContainerRef}>
                        {messages.map((msg) => (
                        <div key={msg.id} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`p-3 rounded-lg shadow-md max-w-[80%] ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                        ))}
                        {chatError && (
                             <div className="flex justify-start mb-3">
                                <div className="bg-red-100 text-red-700 p-3 rounded-lg shadow-md inline-flex items-center max-w-[80%]">
                                    <AlertCircle className="inline-block h-4 w-4 mr-2 flex-shrink-0"/>
                                    <p className="text-sm whitespace-pre-wrap">Sorry, an error occurred: {chatError.message}</p>
                                </div>
                            </div>
                        )}
                        {isChatLoading && messages[messages.length -1]?.role === 'user' && (
                            <div className="flex justify-start mb-3">
                                <div className="bg-gray-200 text-gray-700 p-3 rounded-lg shadow-md inline-flex items-center">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Thinking...
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    <form onSubmit={handleSubmit} className="flex items-center space-x-2 p-3 border-t border-gray-200 bg-gray-50 rounded-b-md">
                        <Input
                        placeholder="Ask the AI about protocols..."
                        value={input}
                        onChange={handleChatInputChange}
                        disabled={isChatLoading}
                        className="flex-grow border-gray-300 focus:ring-blue-500 focus:border-blue-500 rounded-md shadow-sm text-gray-900"
                        />
                        <Button type="submit" disabled={isChatLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md">
                        {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                        </Button>
                    </form>
                </div>
                ) : (
                <ScrollArea className="h-full border border-gray-300 rounded-md p-4 bg-gray-50 shadow-inner">
                    {isSearching && (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            <p className="ml-2 text-gray-600">Searching...</p>
                        </div>
                    )}
                    {!isSearching && searchResults.length > 0 ? (
                    <div className="space-y-4">
                        {searchResults.map((protocol) => (
                                <Card key={protocol.id} className="shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg overflow-hidden">
                                    <CardHeader className="bg-gray-100 p-4 border-b border-gray-200">
                                    <CardTitle className="text-lg font-semibold text-blue-700">{protocol.name} <span className="text-xs text-gray-500 font-mono">({protocol.id})</span></CardTitle>
                                    <CardDescription className="text-xs text-gray-500">Source: {protocol.source_file}</CardDescription>
                                    {protocol.categories && protocol.categories.length > 0 && (
                                        <div className="mt-1">
                                            {protocol.categories.map(cat => (
                                                <span key={cat} className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2 py-0.5 rounded-full">{cat}</span>
                                            ))}
                                        </div>
                                    )}
                                    </CardHeader>
                                    <CardContent className="p-4 bg-white">
                                    <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 text-gray-800 p-3 rounded-md overflow-x-auto border border-gray-200 min-h-[50px]">{protocol.content || "Content not available."}</pre>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                    ) : (
                    !isSearching && (
                        <div className="text-center text-gray-500 pt-16">
                            <Search className="h-12 w-12 mx-auto text-gray-400 mb-2"/>
                            {(searchTerm || activeFilters.length > 0) ? "No protocols found matching your criteria." : "Enter a search term or select filters to begin."}
                        </div>
                    )
                    )}
                </ScrollArea>
                )}
            </div>
        </CardContent>
      </Card>
      <MedicationCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>EMS Protocol Navigator & AI Assistant</p>
      </footer>
    </div>
  );
}

