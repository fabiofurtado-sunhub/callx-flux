import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { Phone, PhoneOff, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function VoiceAgentButton() {
  const [isConnecting, setIsConnecting] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      toast.success("Conectado ao agente de voz");
    },
    onDisconnect: () => {
      toast.info("Chamada encerrada");
    },
    onError: (error) => {
      console.error("Voice agent error:", error);
      toast.error("Erro na conexão de voz");
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "Falha ao obter token");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start conversation:", err);
      toast.error(err.message || "Erro ao iniciar chamada");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isConnected = conversation.status === "connected";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {isConnected && (
        <div className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-1.5">
            {conversation.isSpeaking ? (
              <Volume2 className="w-4 h-4 text-primary animate-pulse" />
            ) : (
              <Mic className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {conversation.isSpeaking ? "Agente falando..." : "Ouvindo..."}
            </span>
          </div>
        </div>
      )}

      <Button
        size="lg"
        onClick={isConnected ? stopConversation : startConversation}
        disabled={isConnecting}
        className={`rounded-full w-14 h-14 shadow-lg ${
          isConnected
            ? "bg-destructive hover:bg-destructive/90"
            : "bg-primary hover:bg-primary/90"
        }`}
      >
        {isConnecting ? (
          <Phone className="w-6 h-6 animate-pulse" />
        ) : isConnected ? (
          <PhoneOff className="w-6 h-6" />
        ) : (
          <Phone className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
