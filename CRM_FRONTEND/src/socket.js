import { io } from 'socket.io-client';
import { apiUrl } from './components/LoginSignup';

// Centralized socket connection for the entire frontend
// Using apiUrl.replace('/api', '') assumes apiUrl is the base URL
const socketUrl = apiUrl.replace('/api', '');
export const socket = io(socketUrl, { autoConnect: false });
