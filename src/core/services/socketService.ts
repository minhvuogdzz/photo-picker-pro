import { io, Socket } from 'socket.io-client';
import { AuthSession } from '@/core/types/auth';
import { logout } from './authApi';
import { useAuthStore } from '@/core/stores/useAuthStore';
import { API_BASE_URL } from './apiClient';

class SocketService {
  private socket: Socket | null = null;
  private isConnecting: boolean = false;

  public connect(session: AuthSession) {
    if (this.socket?.connected || this.isConnecting) return;
    this.isConnecting = true;

    // Connect to the same host as API_BASE_URL but we need the base url, API_BASE_URL might have /api
    const url = new URL(API_BASE_URL);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    this.socket = io(baseUrl, {
      transports: ['websocket'],
      auth: {
        token: session.accessToken,
      },
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.socket?.emit('register', {
        userId: session.userId,
        token: session.accessToken,
      });
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
    });

    // Listen to real-time sync events
    this.socket.on('forceLogout', (data: { deviceId: string }) => {
      // If we are the device being kicked or it's 'all'
      if (data.deviceId === session.deviceId || data.deviceId === 'all') {
        useAuthStore.getState().setSessionExpiredByOtherDevice(true);
      }
    });

    this.socket.on('accountSuspended', () => {
      useAuthStore.getState().setAccountSuspended(true);
    });

    this.socket.on('subscriptionExpired', () => {
      useAuthStore.getState().setSubscriptionExpired(true);
    });

    this.socket.on('copyrightWarning', (data: { message: string }) => {
      useAuthStore.getState().setCopyrightWarningMessage(data.message);
    });

    this.socket.on('trialExpiringSoon', (data: { daysRemaining: number; message: string }) => {
      useAuthStore.getState().setExpiringSoonMessage(data.message);
    });

    this.socket.on('activeExpiringSoon', (data: { daysRemaining: number; message: string }) => {
      useAuthStore.getState().setExpiringSoonMessage(data.message);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }
}

export const socketService = new SocketService();
