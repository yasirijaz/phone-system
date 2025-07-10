import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from '@/lib/axios';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk('auth/loginUser', async (credentials: any, { rejectWithValue }) => {
  try {
    const response = await axios.post('/api/login', credentials);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

export const registerUser = createAsyncThunk('auth/registerUser', async (userData: any, { rejectWithValue }) => {
    try {
        const response = await axios.post('/api/register', userData);
        return response.data;
    } catch (error: any) {
        if (error.response?.data?.errors) {
            return rejectWithValue(Object.values(error.response.data.errors).flat().join(' '));
        }
        return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
});


const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
      state.error = null;
      localStorage.setItem('authToken', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    logoutUser: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    },
    setInitialState: (state) => {
        try {
            const token = localStorage.getItem('authToken');
            const storedUser = localStorage.getItem('user');
            if (token && storedUser && storedUser !== 'undefined') {
                state.user = JSON.parse(storedUser);
                state.token = token;
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error('Failed to parse user from localStorage', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('authToken', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        localStorage.setItem('authToken', action.payload.token);
        localStorage.setItem('user', JSON.stringify(action.payload.user));
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setUser, logoutUser, setInitialState } = authSlice.actions;

export default authSlice.reducer;
