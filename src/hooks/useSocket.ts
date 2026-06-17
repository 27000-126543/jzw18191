import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  const getSocket = useCallback((): Socket => {
    if (!socketRef.current) {
      socketRef.current = io({ transports: ["websocket", "polling"] });
    }
    return socketRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return { socket: getSocket(), getSocket };
}
