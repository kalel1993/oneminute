'use client';
import Link from 'next/link';
import {Show,UserButton} from '@clerk/nextjs';
export function AuthControls(){return <><Show when="signed-out"><Link href="/sign-in">Log in</Link></Show><Show when="signed-in"><Link href="/account">Account</Link><UserButton/></Show></>}
