import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, Trash2, Copy, Check, Bot, User, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// CodeAlpha Logo SVG Component
const CodeAlphaLogo = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" className={className}>
    <rect width="300" height="300" fill="#ffffff"/>
    <g transform="translate(15, 50)">
      <defs>
        <pattern id="dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="3.5" fill="#001489" />
        </pattern>
        <radialGradient id="fade" cx="15%" cy="50%" r="85%">
          <stop offset="40%" stopColor="white" stopOpacity="0" />
          <stop offset="95%" stopColor="white" stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="75" cy="100" r="65" fill="url(#dots)" />
      <circle cx="75" cy="100" r="66" fill="url(#fade)" />
      <text x="145" y="95" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="64" fill="#001489" letterSpacing="-1">CODE</text>
      <text x="150" y="145" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="40" fill="#001489" letterSpacing="1">ALPHA</text>
      <line x1="150" y1="155" x2="265" y2="155" stroke="#001489" strokeWidth="4" />
    </g>
  </svg>
);

// Initialize Gemini AI with the provided API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the structure of a chat message
type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  suggestedQuestions?: string[];
};

// System instruction to guide the AI's behavior and knowledge base
const SYSTEM_INSTRUCTION = `
You are a highly intelligent FAQ chatbot assistant for the CodeAlpha internship.

Your role:
- Answer user questions based ONLY on the provided FAQ knowledge base.
- Understand user questions even if phrased differently (use semantic similarity).
- Support short queries like "duration?", "fee?", "tasks?".
- Handle variations intelligently (e.g., "fees", "cost", "price" -> ₹99; "certificate cost" -> ₹99; "linkedin compulsory?" -> Yes).
- If no match is found, respond EXACTLY with: "Sorry, I couldn't find an answer. Please check official CodeAlpha resources."

Knowledge Base (CodeAlpha Internship FAQs):
Q1: What is CodeAlpha internship?
A: CodeAlpha offers remote, project-based internships for students and freshers to gain real-world experience.
Q2: What is the duration of the internship?
A: The internship duration is typically 1 month or 3 months.
Q3: Is the internship remote?
A: Yes, it is completely remote/virtual.
Q4: How many tasks do I need to complete?
A: You must complete at least 2 or 3 tasks to receive the certificate.
Q5: What happens if I complete only one task?
A: You will not receive the internship certificate.
Q6: Is it mandatory to post on LinkedIn?
A: Yes, you must update LinkedIn with your offer letter and project status.
Q7: Is posting a video on LinkedIn mandatory?
A: Posting a video explanation is optional but recommended.
Q8: Do I need to upload projects to GitHub?
A: Yes, uploading your source code to GitHub is required.
Q9: What is the certification fee?
A: The certification fee is ₹99.
Q10: What domains are available?
A: CodeAlpha offers 30+ domains including AI, Web Development, Data Science, Python, Java, Cybersecurity, Cloud Computing, and more.
Q11: What are the main domains in CodeAlpha?
A: Main domains include AI/ML, Data Science, Web Development, App Development, and Programming.
Q12: What skills will I gain?
A: You will gain practical experience in real-world projects, coding, and problem-solving.
Q13: Who can apply?
A: Students and freshers interested in technology can apply.
Q14: How do I apply?
A: You can apply through LinkedIn or the official registration links.
Q15: What kind of projects will I build?
A: Projects include chatbots, websites, apps, data models, and automation tools.
Q16: Will I get a certificate?
A: Yes, after completing required tasks and paying ₹99 certification fee.
Q17: Is there any stipend?
A: No, this is an unpaid internship focused on learning.
Q18: What are the perks?
A: Perks include certificate, project experience, and portfolio building.
Q19: Will I get a letter of recommendation?
A: Yes, based on performance.
Q20: How should I name my GitHub repo?
A: Use the format CodeAlpha_ProjectName.
Q21: What technologies are used?
A: Technologies include Python, JavaScript, React, ML libraries, and more.
Q22: What is the main goal of this internship?
A: To provide hands-on experience and improve practical skills.
Q23: Can beginners join?
A: Yes, it is beginner-friendly.
Q24: How many domains are there?
A: There are 30+ domains available.
Q25: What type of internship is this?
A: It is a task-based virtual internship.

Behavior rules:
- Be friendly, professional, and concise.
- Highlight important words using **bold** formatting (e.g., **₹99**, **1 month or 3 months**, **GitHub**).
- Add emojis where useful (✅, 💡, 🤖, etc.).
- Never hallucinate or make up answers.
- Combine similar questions intelligently if the user asks a broad question.

Output format:
Return a JSON object with the following structure:
{
  "answer": "The answer to the user's question, with bolding and emojis.",
  "suggestedQuestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}
Always provide 2-3 suggested related questions from the knowledge base.
`;

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  text: 'Hello! 🤖 I am the **CodeAlpha FAQ Assistant**. I can answer questions about internships, tasks, fees, and more. How can I help you today? 💡',
  timestamp: new Date(),
  suggestedQuestions: [
    'What is CodeAlpha internship?',
    'What domains are available?',
    'Will I get a certificate?'
  ]
};

const QUICK_ACTIONS = ["Fee?", "Duration?", "Tasks?", "Stipend?"];

export default function App() {
  // State for chat messages, starting with a welcome message
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Handle sending a new message
  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    // Add user message to chat
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build chat history for context, formatting it for the Gemini API
      const contents = messages.map(m => ({
        role: m.role === 'bot' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMsg.text }] });

      // Call Gemini API with structured JSON output schema
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview', // Using pro for better semantic matching
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING, description: 'The answer to the user query' },
              suggestedQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 related questions from the FAQ'
              }
            },
            required: ['answer', 'suggestedQuestions']
          }
        }
      });

      const responseText = response.text || '{}';
      const data = JSON.parse(responseText);

      // Add bot response to chat
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.answer || "Sorry, I couldn't process that.",
        timestamp: new Date(),
        suggestedQuestions: data.suggestedQuestions || []
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Error generating response:', error);
      // Handle errors gracefully
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: "Sorry, I encountered an error. Please try again later.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Clear chat history and reset to welcome message
  const handleClearChat = () => {
    setMessages([{ ...INITIAL_MESSAGE, timestamp: new Date() }]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 shadow-sm z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shadow-md overflow-hidden">
            <CodeAlphaLogo />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">CodeAlpha Assistant</h1>
            <p className="text-xs text-green-400 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-full transition-colors"
          title="Clear Chat"
        >
          <Trash2 size={20} />
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto relative bg-[#0a0a0a]">
        {/* Subtle Background Image Overlay */}
        <div 
          className="absolute inset-0 z-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url('/bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        
        <div className="relative z-10 p-4 sm:p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onSuggestClick={handleSend} />
            ))}
            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-start gap-3 max-w-[85%]"
              >
                <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm overflow-hidden">
                  <CodeAlphaLogo />
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-gray-900 border-t border-gray-800 flex flex-col relative z-20">
        {/* Quick Actions Bar */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-800 bg-gray-900/50">
          {QUICK_ACTIONS.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(action)}
              disabled={isTyping}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-full hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50 shadow-sm"
            >
              <Zap size={14} className="text-yellow-500" />
              {action}
            </button>
          ))}
        </div>

        {/* Input Field */}
        <div className="p-4">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(input);
              }}
              placeholder="Ask a question about the internship..."
              className="w-full pl-4 pr-12 py-3 bg-gray-800 text-white border-transparent focus:bg-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 rounded-full outline-none transition-all placeholder-gray-400"
              disabled={isTyping}
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-xs text-gray-500">Powered by Gemini AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for rendering individual chat bubbles
function MessageBubble({ message, onSuggestClick }: { message: Message; onSuggestClick: (text: string) => void }) {
  const isBot = message.role === 'bot';
  const [copied, setCopied] = useState(false);

  // Handle copying message text to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format timestamp
  const timeString = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(message.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} gap-1`}
    >
      <div className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm overflow-hidden
          ${isBot ? 'bg-gray-800 border border-gray-700' : 'bg-blue-600 text-white'}`}
        >
          {isBot ? (
            <CodeAlphaLogo />
          ) : (
            <User size={18} />
          )}
        </div>

        {/* Bubble */}
        <div className="flex flex-col gap-1 group">
          <div className={`px-4 py-3 shadow-sm relative
            ${isBot 
              ? 'bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-none text-gray-100' 
              : 'bg-blue-600 text-white rounded-2xl rounded-tr-none'}`}
          >
            {isBot ? (
              <div className="text-sm leading-relaxed text-gray-100 [&>p]:mb-2 last:[&>p]:mb-0 [&_strong]:text-blue-300 [&_strong]:font-semibold [&_a]:text-blue-400">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
            )}
            
            {/* Copy Button (Bot only, visible on hover) */}
            {isBot && (
              <button
                onClick={handleCopy}
                className="absolute -right-10 top-2 p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded-md border border-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            )}
          </div>
          
          {/* Timestamp */}
          <span className={`text-[10px] text-gray-400 font-medium px-1 ${isBot ? 'text-left' : 'text-right'}`}>
            {timeString}
          </span>
        </div>
      </div>

      {/* Suggested Questions (Quick Replies) */}
      {isBot && message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
        <div className="mt-2 ml-11 flex flex-wrap gap-2 max-w-[85%]">
          {message.suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onSuggestClick(q)}
              className="text-xs px-3 py-1.5 bg-gray-800/80 backdrop-blur-sm text-blue-400 border border-gray-700 rounded-full hover:bg-gray-700 hover:text-blue-300 transition-colors flex items-center gap-1 shadow-sm"
            >
              <Sparkles size={12} className="text-blue-400" />
              {q}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
