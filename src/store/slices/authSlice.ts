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

export const forgotPassword = createAsyncThunk('auth/forgotPassword', async ({ email }: { email: string }, { rejectWithValue }) => {
    try {
        const response = await axios.post('/api/forgot-password', { email });
        return response.data;
    } catch (error: any) {
        return rejectWithValue(error.response?.data?.message || 'Failed to send reset link.');
    }
});

export const resetPassword = createAsyncThunk('auth/resetPassword', async (data: any, { rejectWithValue }) => {
    try {
        const response = await axios.post('/api/reset-password', data);
        return response.data;
    } catch (error: any) {
         if (error.response?.data?.errors) {
            return rejectWithValue(Object.values(error.response.data.errors).flat().join(' '));
        }
        return rejectWithValue(error.response?.data?.message || 'Failed to reset password.');
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
      localStorage.removeItem('impersonation_id');
      localStorage.removeItem('is_impersonating');
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
    },
    updateUser: (state, action: PayloadAction<User>) => {
        console.log("🔄 Updating user in store:", action.payload);
        state.user = action.payload.data.user;
        localStorage.setItem('user', JSON.stringify(action.payload));
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
        // localStorage.setItem('authToken', action.payload.data.token);  // WS Laravel
        // localStorage.setItem('user', JSON.stringify(action.payload.data.user));  // WS Laravel
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
      })
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setUser, logoutUser, setInitialState, updateUser } = authSlice.actions;

export default authSlice.reducer;
