import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Alert, Transaction } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastAlert, setLastAlert] = useState<Alert | null>(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('transaction', (tx: Transaction) => {
      console.log('📡 New Transaction:', tx);
      setLastTransaction(tx);
    });

    socket.on('alert', (alert: Alert) => {
      console.log('🚨 New Alert:', alert);
      setLastAlert(alert);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    lastTransaction,
    lastAlert
  };
};
