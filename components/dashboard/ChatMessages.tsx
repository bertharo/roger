'use client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-4 space-y-4 border-b border-gray-100/50">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
