'use client';
import Link from 'next/link';
import {SignedIn,SignedOut,UserButton} from '@clerk/nextjs';
export function AuthControls(){return <><SignedOut><Link href="/sign-in">Log in</Link></SignedOut><SignedIn><Link href="/account">Account</Link><UserButton/></SignedIn></>}
