import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, DEMO_MODE } from '../services/firebase'
import type { User, UserRole } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, role?: UserRole) => Promise<void>
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>
  logout: () => Promise<void>
  demoLogin: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const DEMO_USERS: Record<UserRole, User> = {
  doctor: {
    uid: 'demo-doctor-001',
    email: 'dr.rajesh@medtrust.ai',
    displayName: 'Dr. Rajesh Kumar',
    role: 'doctor',
    specialization: 'Internal Medicine',
    licenseNumber: 'TN-MCI-12345',
    department: 'General Medicine',
  },
  patient: {
    uid: 'demo-patient-001',
    email: 'patient@medtrust.ai',
    displayName: 'Arjun Krishnamurthy',
    role: 'patient',
  },
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for demo user
    const savedUser = localStorage.getItem('medtrust_demo_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
      setLoading(false)
      return
    }

    if (DEMO_MODE || !auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch role from Firestore
        try {
          const userDoc = await getDoc(doc(db!, 'users', firebaseUser.uid))
          const userData = userDoc.data()
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || userData?.displayName || '',
            role: userData?.role || 'patient',
            specialization: userData?.specialization,
            licenseNumber: userData?.licenseNumber,
            department: userData?.department,
          })
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const demoLogin = (role: UserRole) => {
    const demoUser = DEMO_USERS[role]
    localStorage.setItem('medtrust_demo_user', JSON.stringify(demoUser))
    setUser(demoUser)
  }

  const login = async (email: string, password: string, role?: UserRole) => {
    if (DEMO_MODE || !auth) {
      demoLogin(role || 'doctor')
      return
    }
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const userDoc = await getDoc(doc(db!, 'users', cred.user.uid))
    const data = userDoc.data()
    setUser({
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: data?.displayName || '',
      role: data?.role || role || 'patient',
      specialization: data?.specialization,
      department: data?.department,
    })
  }

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    if (DEMO_MODE || !auth) {
      demoLogin(role)
      return
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const userData: User = {
      uid: cred.user.uid,
      email,
      displayName: name,
      role,
    }
    await setDoc(doc(db!, 'users', cred.user.uid), userData)
    setUser(userData)
  }

  const logout = async () => {
    localStorage.removeItem('medtrust_demo_user')
    if (!DEMO_MODE && auth) {
      await signOut(auth)
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, demoLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
