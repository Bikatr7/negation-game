import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DialogProps } from "@radix-ui/react-dialog";
import { FC, useState, useRef, useEffect } from "react";
import { ArrowLeftIcon, SendIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PointCard } from "./PointCard";
import { chat, ChatResponse } from "@/actions/chat";
import { usePrivy } from "@privy-io/react-auth";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Loader } from "@/components/ui/loader";

type SuggestedPoint = NonNullable<ChatResponse["suggestedPoints"]>[number] & {
  createdAt: Date;
};

type Message = {
  role: "assistant" | "user";
  content: string;
  suggestedPoints?: SuggestedPoint[];
  isLoading?: boolean;
};

export const ChatDialog: FC<DialogProps> = ({ open, onOpenChange, ...props }) => {
  const { user } = usePrivy();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I can help you find points to endorse or suggest new perspectives. What topics interest you?",
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const { mutateAsync: sendMessage, isPending } = useMutation({
    mutationFn: async (content: string) => {
      const newMessages = [...messages, { role: "user" as const, content }];
      setMessages(newMessages);
      
      setMessages([...newMessages, { role: "assistant", content: "", isLoading: true }]);
      
      const stream = await chat(newMessages);
      const reader = stream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        setMessages([...newMessages, {
          role: "assistant",
          content: value.content,
          suggestedPoints: value.suggestedPoints?.map(point => ({
            ...point,
            createdAt: new Date()
          }))
        }]);
      }
      
      reader.releaseLock();
    }
  });

  const handleSend = async () => {
    if (!input.trim() || isPending) return;
    
    const content = input.trim();
    setInput("");
    
    await sendMessage(content);
  };

  return (
    <Dialog {...props} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:top-xl flex flex-col overflow-hidden sm:translate-y-0 h-full rounded-none sm:rounded-md sm:h-[80vh] gap-0 bg-background p-4 sm:p-8 shadow-sm w-full max-w-xl">
        <div className="w-full flex items-center justify-between mb-xl">
          <DialogTitle className="text-lg font-semibold">AI Assistant</DialogTitle>
          <button className="text-primary" onClick={() => onOpenChange?.(false)}>
            <VisuallyHidden>Close dialog</VisuallyHidden>
            <ArrowLeftIcon aria-hidden />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto flex flex-col gap-md px-2">
          {messages.map((message, i) => (
            <div key={i} className="flex flex-col gap-sm">
              <div
                className={`flex ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "assistant"
                      ? "bg-accent"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {message.isLoading ? (
                    <Loader className="size-4" />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
              
              {message.suggestedPoints && message.suggestedPoints.length > 0 && (
                <div className="flex flex-col gap-sm mt-sm">
                  <span className="text-sm text-muted-foreground">Suggested points:</span>
                  {message.suggestedPoints.map((point) => (
                    <PointCard
                      key={point.pointId}
                      className="border rounded-md p-2"
                      pointId={point.pointId}
                      content={point.content}
                      cred={point.cred}
                      favor={point.favor}
                      amountSupporters={point.amountSupporters}
                      amountNegations={point.amountNegations}
                      createdAt={point.createdAt}
                      viewerContext={{ viewerCred: 0 }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-sm mt-md">
          <input
            className="flex-grow rounded-md border p-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!input.trim() || isPending}
            onClick={handleSend}
          >
            <VisuallyHidden>Send message</VisuallyHidden>
            <SendIcon aria-hidden />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 